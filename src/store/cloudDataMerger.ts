import type {
  AppStoreState,
  VocabWord,
  CollocationItem,
  SRSReviewEvent,
  SRSAlgorithmType,
  MistakeRecord,
  MistakeType,
  CanonicalMistakeSource,
} from '../types';
import { calculateLevelFromXp } from '../utils/userRank';
import { composeVocabularyList } from './vocabularyComposer';
import {
  toCanonicalSource,
  canonicalizeSourceCounts,
} from '../services/adaptiveMistakeService';
import {
  mergeSkillScores,
  sanitizeStringIds,
  mergeFourSkillsCompletionProgress,
  mergeLevelCertifications,
  mergeCheckpointHistory,
  pruneFinalizedCheckpointResumes,
} from './fourSkillsSanitizers';
import {
  EMPTY_FOUR_SKILLS_EVIDENCE,
  mergeEvidenceArrays,
} from '../services/competencyEvidenceService';
import {
  mergeWordLearningStats,
  sanitizeWordLearningStats,
} from '../services/wordUsageTelemetry';
import {
  mergeAdaptiveQuizTelemetryState,
} from '../services/adaptiveQuizTelemetryService';
import {
  mergeResumeActivities,
} from '../services/learningContinuityService';
import { getVietnamDateString } from '../services/leaderboardLearningMetrics';

/**
 * Pure reducer function to compute merged cloud state with local state.
 * Preserves monotonicity, conflict resolution, and deterministic deduplication.
 */
export function applyCloudDataMerge(
  state: AppStoreState,
  payload: any
): Partial<AppStoreState> {
  const {
    cloudProfile,
    cloudSrsList,
    cloudDailyLogs,
    cloudCustomWords,
    userCustomWords: altCustomWords,
    cloudCollocations,
    userCollocations: altCollocations,
    cloudMistakeBank,
    cloudMistakes,
    mistakeBank: altMistakeBank,
  } = payload;

  // 1. Merge Profile
  let nextProfile = { ...state.profile };
  if (cloudProfile && typeof cloudProfile === 'object') {
    const localXp = state.profile.xp || 0;
    const remoteXp = typeof cloudProfile.xp === 'number' ? cloudProfile.xp : 0;
    const mergedXp = Math.max(localXp, remoteXp);
    const calculatedLevel = calculateLevelFromXp(mergedXp);
    const mergedLevel = Math.max(
      calculatedLevel,
      typeof cloudProfile.level === 'number' ? cloudProfile.level : 1,
      state.profile.level || 1
    );
    const localStreak = state.profile.streak || 0;
    const remoteStreak = typeof cloudProfile.streak === 'number' ? cloudProfile.streak : 0;
    const mergedStreak = Math.max(localStreak, remoteStreak);
    const mergedName = state.profile.name || cloudProfile.display_name || cloudProfile.displayName || cloudProfile.name || '';

    // Date reconciliation: Chọn mốc ngày mới nhất để chống lùi thời gian
    const localLastStudy = state.profile.lastStudyDate || null;
    const remoteLastStudy = cloudProfile.last_study_date || cloudProfile.lastStudyDate || null;
    let mergedLastStudy = localLastStudy;
    if (remoteLastStudy && (!localLastStudy || remoteLastStudy > localLastStudy)) {
      mergedLastStudy = remoteLastStudy;
    }

    const localLastActive = state.profile.lastActiveDate || null;
    const remoteLastActive = cloudProfile.last_active_date || cloudProfile.lastActiveDate || null;
    let mergedLastActive = localLastActive;
    if (remoteLastActive && (!localLastActive || remoteLastActive > localLastActive)) {
      mergedLastActive = remoteLastActive;
    }

    // Settings reconciliation
    const mergedTargetGoal = cloudProfile.targetGoal || cloudProfile.target_goal || state.profile.targetGoal;
    const mergedTargetDailyWords = typeof cloudProfile.targetDailyNewWords === 'number' && cloudProfile.targetDailyNewWords > 0
      ? cloudProfile.targetDailyNewWords
      : (typeof cloudProfile.target_daily_new_words === 'number' && cloudProfile.target_daily_new_words > 0
        ? cloudProfile.target_daily_new_words
        : state.profile.targetDailyNewWords);

    // API Key reconciliation: Preserve local key if set; otherwise fallback to cloud key
    const localApiKey = state.geminiApiKey || state.profile.geminiApiKey || '';
    const cloudApiKey = cloudProfile.geminiApiKey || cloudProfile.gemini_api_key || '';
    const mergedApiKey = localApiKey || cloudApiKey;

    // Frame rewards reconciliation
    const remoteEquippedFrame = cloudProfile.equipped_frame !== undefined ? cloudProfile.equipped_frame : cloudProfile.equippedFrame;
    const mergedEquippedFrame = state.profile.equippedFrame || remoteEquippedFrame || null;

    const localUnlockedFrames = state.profile.unlockedFrames || [];
    const rawRemoteUnlocked = cloudProfile.unlocked_frames || cloudProfile.unlockedFrames || [];
    const remoteUnlockedFrames = Array.isArray(rawRemoteUnlocked) ? rawRemoteUnlocked : [];
    const mergedUnlockedFrames = Array.from(new Set([...localUnlockedFrames, ...remoteUnlockedFrames]));

    nextProfile = {
      ...nextProfile,
      name: mergedName,
      xp: mergedXp,
      level: mergedLevel,
      streak: mergedStreak,
      lastStudyDate: mergedLastStudy,
      lastActiveDate: mergedLastActive,
      targetGoal: mergedTargetGoal,
      targetDailyNewWords: mergedTargetDailyWords,
      geminiApiKey: mergedApiKey,
      isOnboarded: Boolean(mergedName || nextProfile.isOnboarded),
      equippedFrame: mergedEquippedFrame,
      unlockedFrames: mergedUnlockedFrames,
    };
  }

  // 2. Merge FourSkillsScores: Gộp an toàn các mảng điểm số với sequence reconciliation, không nhân bản điểm khi trùng
  let nextSkillsScores = { ...state.fourSkillsScores };
  let rawSkills = cloudProfile?.four_skills_scores || cloudProfile?.fourSkillsScores || cloudProfile?.fourSkillsScoresJson || payload.fourSkillsScores || payload.cloudFourSkillsScores;
  if (typeof rawSkills === 'string') {
    try {
      rawSkills = JSON.parse(rawSkills);
    } catch {}
  }
  if (rawSkills && typeof rawSkills === 'object') {
    nextSkillsScores = {
      listening: mergeSkillScores(state.fourSkillsScores?.listening, rawSkills.listening),
      reading: mergeSkillScores(state.fourSkillsScores?.reading, rawSkills.reading),
      speaking: mergeSkillScores(state.fourSkillsScores?.speaking, rawSkills.speaking),
      writing: mergeSkillScores(state.fourSkillsScores?.writing, rawSkills.writing),
    };
  }

  // 2c. Merge FourSkillsEvidence
  let nextSkillsEvidence = { ...(state.fourSkillsEvidence || EMPTY_FOUR_SKILLS_EVIDENCE) };
  const rawEvidence =
    cloudProfile?.four_skills_evidence ||
    cloudProfile?.fourSkillsEvidence ||
    (cloudProfile?.four_skills_scores as any)?.four_skills_evidence ||
    (cloudProfile?.fourSkillsScores as any)?.four_skills_evidence ||
    payload.fourSkillsEvidence;
  if (rawEvidence && typeof rawEvidence === 'object') {
    nextSkillsEvidence = {
      listening: mergeEvidenceArrays(state.fourSkillsEvidence?.listening || [], rawEvidence.listening || []),
      reading: mergeEvidenceArrays(state.fourSkillsEvidence?.reading || [], rawEvidence.reading || []),
      speaking: mergeEvidenceArrays(state.fourSkillsEvidence?.speaking || [], rawEvidence.speaking || []),
      writing: mergeEvidenceArrays(state.fourSkillsEvidence?.writing || [], rawEvidence.writing || []),
    };
  }

  // 2b. Merge Completed Listening Lessons: Monotonic union without duplicates
  const rawCompleted =
    cloudProfile?.completed_listening_lessons ||
    cloudProfile?.completedListeningLessonIds ||
    payload?.completedListeningLessonIds ||
    payload?.completed_listening_lessons ||
    (rawSkills as any)?.completed_listening_lessons ||
    (rawSkills as any)?.completedListeningLessonIds;

  let nextCompletedListeningIds = [...(state.completedListeningLessonIds || [])];
  if (Array.isArray(rawCompleted)) {
    const cloudIds = sanitizeStringIds(rawCompleted);
    nextCompletedListeningIds = Array.from(new Set([...nextCompletedListeningIds, ...cloudIds]));
  }

  // 2d. Merge FourSkillsCompletionProgress: Monotonic union without duplicates
  const rawCloudProgress =
    cloudProfile?.four_skills_completion_progress ||
    cloudProfile?.fourSkillsCompletionProgress ||
    (rawSkills as any)?.four_skills_completion_progress ||
    (rawSkills as any)?.fourSkillsCompletionProgress ||
    payload?.fourSkillsCompletionProgress ||
    payload?.four_skills_completion_progress ||
    {
      reading:
        cloudProfile?.completed_reading_lessons ||
        (rawSkills as any)?.completed_reading_lessons ||
        payload?.completed_reading_lessons,
      speaking:
        cloudProfile?.completed_speaking_prompts ||
        (rawSkills as any)?.completed_speaking_prompts ||
        payload?.completed_speaking_prompts,
      writing:
        cloudProfile?.completed_writing_prompts ||
        (rawSkills as any)?.completed_writing_prompts ||
        payload?.completed_writing_prompts,
    };

  const nextCompletionProgress = mergeFourSkillsCompletionProgress(
    state.fourSkillsCompletionProgress,
    rawCloudProgress
  );

  // 3. Merge hasLearnedNightOwl: Dùng phép toán OR logic (local || cloud)
  const nextNightOwl = Boolean(state.hasLearnedNightOwl || cloudProfile?.has_learned_night_owl || cloudProfile?.hasLearnedNightOwl);

  // 4. Merge Custom Words with Deduplication (by id & normalized word)
  const incomingWords = cloudCustomWords || altCustomWords;
  const wordMap = new Map<string, VocabWord>();
  for (const w of (state.userCustomWords || [])) {
    if (w && w.word) {
      wordMap.set((w.id || w.word).toLowerCase().trim(), w);
    }
  }
  if (Array.isArray(incomingWords)) {
    for (const cw of incomingWords) {
      if (!cw || !cw.word) continue;
      const idKey = (cw.id || '').toLowerCase().trim();
      const wordNorm = cw.word.toLowerCase().trim();
      const existsById = idKey ? wordMap.has(idKey) : false;
      const existsByWord = Array.from(wordMap.values()).some(
        (existing) => existing.word?.toLowerCase().trim() === wordNorm
      );
      if (!existsById && !existsByWord) {
        wordMap.set(idKey || wordNorm, cw);
      } else {
        const existingWord = (idKey ? wordMap.get(idKey) : undefined) || Array.from(wordMap.values()).find(
          (existing) => existing.word?.toLowerCase().trim() === wordNorm
        );
        if (existingWord && Array.isArray(cw.sources)) {
          existingWord.sources = Array.from(new Set([...(existingWord.sources || []), ...cw.sources]));
        }
      }
    }
  }
  const nextCustomWords = Array.from(wordMap.values());

  // 5. Merge Collocations with Deduplication (by id & normalized phrase)
  const incomingCollocs = cloudCollocations || altCollocations;
  const collocMap = new Map<string, CollocationItem>();
  for (const c of (state.userCollocations || [])) {
    if (c && c.phrase) {
      collocMap.set((c.id || c.phrase).toLowerCase().trim(), c);
    }
  }
  if (Array.isArray(incomingCollocs)) {
    for (const cc of incomingCollocs) {
      if (!cc || !cc.phrase) continue;
      const idKey = (cc.id || '').toLowerCase().trim();
      const phraseNorm = cc.phrase.toLowerCase().trim();
      const existsById = idKey ? collocMap.has(idKey) : false;
      const existsByPhrase = Array.from(collocMap.values()).some(
        (existing) => existing.phrase?.toLowerCase().trim() === phraseNorm
      );
      if (!existsById && !existsByPhrase) {
        collocMap.set(idKey || phraseNorm, cc);
      } else {
        const existingColloc = (idKey ? collocMap.get(idKey) : undefined) || Array.from(collocMap.values()).find(
          (existing) => existing.phrase?.toLowerCase().trim() === phraseNorm
        );
        if (existingColloc && Array.isArray(cc.sources)) {
          existingColloc.sources = Array.from(new Set([...(existingColloc.sources || []), ...cc.sources]));
        }
      }
    }
  }
  const nextCollocations = Array.from(collocMap.values());

  // 6. Merge SRS Progress Map: Reconcile conflict by higher srsLevel or longer interval
  const nextSrsMap = { ...state.srsProgressMap };
  const rawSrsItems = Array.isArray(cloudSrsList)
    ? cloudSrsList
    : (payload.cloudSrsMap && typeof payload.cloudSrsMap === 'object' && !Array.isArray(payload.cloudSrsMap)
        ? Object.entries(payload.cloudSrsMap).map(([k, v]: [string, any]) => ({ word_id: k, ...(v || {}) }))
        : []);

  for (const item of rawSrsItems) {
    if (!item || typeof item !== 'object') continue;
    const wordId = item.word_id || item.wordId || item.id;
    if (!wordId || typeof wordId !== 'string') continue;

    const cloudRep = typeof item.repetition === 'number'
      ? item.repetition
      : (typeof item.srsLevel === 'number' ? item.srsLevel : 0);
    const cloudInterval = typeof item.interval === 'number' ? item.interval : 0;
    const cloudEase = typeof item.ease_factor === 'number'
      ? item.ease_factor
      : (typeof item.easeFactor === 'number' ? item.easeFactor : 2.5);
    const cloudNextReview = item.next_review_date || item.nextReviewDate;
    const cloudLastReview = item.last_reviewed_date || item.lastReviewedDate;
    const cloudFavorite = Boolean(item.is_favorite ?? item.isFavorite);
    const cloudFsrs = item.fsrs || item.fsrs_state || item.fsrsState;
    const cloudSources: string[] = Array.isArray(item.sources)
      ? item.sources
      : (item.source && typeof item.source === 'string' ? [item.source] : []);

    const existing = nextSrsMap[wordId];
    if (!existing) {
      nextSrsMap[wordId] = {
        srsLevel: cloudRep,
        interval: cloudInterval,
        easeFactor: cloudEase,
        nextReviewDate: cloudNextReview || new Date().toISOString(),
        lastReviewedDate: cloudLastReview || new Date().toISOString(),
        isFavorite: cloudFavorite,
        ...(cloudFsrs ? { fsrs: cloudFsrs } : {}),
        ...(cloudSources.length > 0 ? { sources: cloudSources } : {}),
      };
    } else {
      const existingRep = existing.srsLevel ?? 0;
      const existingInterval = existing.interval ?? 0;
      const cloudWins = cloudRep > existingRep || (cloudRep === existingRep && cloudInterval > existingInterval);
      const mergedSources = Array.from(new Set([...(existing.sources || []), ...cloudSources]));

      let mergedFsrs = existing.fsrs;
      if (cloudFsrs) {
        if (!existing.fsrs) {
          mergedFsrs = cloudFsrs;
        } else {
          const cloudFsrsReps = cloudFsrs.reps ?? 0;
          const existingFsrsReps = existing.fsrs.reps ?? 0;
          if (cloudFsrsReps > existingFsrsReps || cloudWins) {
            mergedFsrs = cloudFsrs;
          }
        }
      }

      if (cloudWins) {
        nextSrsMap[wordId] = {
          srsLevel: cloudRep,
          interval: cloudInterval,
          easeFactor: cloudEase,
          nextReviewDate: cloudNextReview || existing.nextReviewDate || new Date().toISOString(),
          lastReviewedDate: cloudLastReview || existing.lastReviewedDate || new Date().toISOString(),
          isFavorite: existing.isFavorite || cloudFavorite,
          ...(mergedFsrs ? { fsrs: mergedFsrs } : {}),
          ...(mergedSources.length > 0 ? { sources: mergedSources } : {}),
        };
      } else {
        nextSrsMap[wordId] = {
          ...existing,
          isFavorite: existing.isFavorite || cloudFavorite,
          ...(mergedFsrs ? { fsrs: mergedFsrs } : {}),
          ...(mergedSources.length > 0 ? { sources: mergedSources } : {}),
        };
      }
    }
  }

  // 7. Merge Mistake Bank: If either is resolved, resolved: true wins
  const nextMistakeBank = { ...state.mistakeBank };
  const rawMistakes = cloudMistakeBank || cloudMistakes || altMistakeBank;
  if (rawMistakes && typeof rawMistakes === 'object') {
    const mistakeList: MistakeRecord[] = Array.isArray(rawMistakes)
      ? rawMistakes
      : Object.values(rawMistakes);

    for (const m of mistakeList) {
      if (!m || typeof m !== 'object' || (!m.id && !m.word)) continue;
      const mIdLower = (m.id || '').trim().toLowerCase();
      const mWordLower = (m.word || '').trim().toLowerCase();

      // Tìm bản ghi tương ứng trong nextMistakeBank theo key, id hoặc word
      const matchedEntry = Object.entries(nextMistakeBank).find(
        ([k, item]) => {
          const kLower = k.toLowerCase().trim();
          const itemIdLower = (item?.id || '').toLowerCase().trim();
          const itemWordLower = (item?.word || '').toLowerCase().trim();
          return (
            (mIdLower && (kLower === mIdLower || itemIdLower === mIdLower)) ||
            (mWordLower && (kLower === mWordLower || itemWordLower === mWordLower))
          );
        }
      );

      if (!matchedEntry) {
        const targetKey =
          mIdLower && (mIdLower.startsWith('grammar_') || mIdLower.startsWith('colloc_') || mIdLower.startsWith('pron_'))
            ? mIdLower
            : mWordLower || mIdLower;
        const canonSource = toCanonicalSource(m.source);
        nextMistakeBank[targetKey] = {
          ...m,
          source: canonSource,
          sourceCounts: canonicalizeSourceCounts(m.sourceCounts),
        };
      } else {
        const [foundKey, existing] = matchedEntry;

        // Reconcile Resolved Status deterministically (accounting for local/cloud reopens)
        let isResolved = false;
        if (existing.resolved && m.resolved) {
          isResolved = true;
        } else if (!existing.resolved && !m.resolved) {
          isResolved = false;
        } else {
          const unresolvedItem = !existing.resolved ? existing : m;
          const resolvedItem = existing.resolved ? existing : m;
          const unresolvedTime = unresolvedItem.lastMistakeAt ? Date.parse(unresolvedItem.lastMistakeAt) : 0;
          const resolvedTime = resolvedItem.resolvedDate ? Date.parse(resolvedItem.resolvedDate) : 0;

          const hasHigherReopen = (unresolvedItem.reopenCount ?? 0) > (resolvedItem.reopenCount ?? 0);
          const hasLaterMistakeAfterResolution = Boolean(
            resolvedItem.resolvedDate &&
            !Number.isNaN(unresolvedTime) &&
            !Number.isNaN(resolvedTime) &&
            unresolvedTime > resolvedTime
          );

          if (hasHigherReopen || hasLaterMistakeAfterResolution) {
            isResolved = false;
          } else {
            isResolved = true;
          }
        }

        const mergedTypeCounts = { ...(existing.typeCounts || {}) };
        if (m.typeCounts) {
          for (const [t, c] of Object.entries(m.typeCounts)) {
            mergedTypeCounts[t as MistakeType] = Math.max(
              mergedTypeCounts[t as MistakeType] || 0,
              c || 0
            );
          }
        }

        const canonExistingSourceCounts = canonicalizeSourceCounts(existing.sourceCounts);
        const canonCloudSourceCounts = canonicalizeSourceCounts(m.sourceCounts);
        const mergedSourceCounts: Partial<Record<CanonicalMistakeSource, number>> = {
          ...canonExistingSourceCounts,
        };
        for (const [s, c] of Object.entries(canonCloudSourceCounts)) {
          const srcKey = s as CanonicalMistakeSource;
          mergedSourceCounts[srcKey] = Math.max(
            mergedSourceCounts[srcKey] || 0,
            c || 0
          );
        }

        let mergedTypeResolutionMap: Partial<Record<MistakeType, any>> | undefined;
        if (existing.typeResolutionMap || m.typeResolutionMap) {
          mergedTypeResolutionMap = { ...(existing.typeResolutionMap || {}) };
          if (m.typeResolutionMap) {
            for (const [tKey, cloudState] of Object.entries(m.typeResolutionMap)) {
              if (!cloudState) continue;
              const t = tKey as MistakeType;
              const localState = mergedTypeResolutionMap[t];
              if (!localState) {
                mergedTypeResolutionMap[t] = { ...cloudState };
              } else {
                let typeResolved = false;
                if (localState.resolved && cloudState.resolved) {
                  typeResolved = true;
                } else if (!localState.resolved && !cloudState.resolved) {
                  typeResolved = false;
                } else {
                  const unresolvedType = !localState.resolved ? localState : cloudState;
                  const resolvedType = localState.resolved ? localState : cloudState;
                  const unresTime = unresolvedType.lastMistakeAt ? Date.parse(unresolvedType.lastMistakeAt) : 0;
                  const resTime = resolvedType.resolvedAt ? Date.parse(resolvedType.resolvedAt) : 0;
                  const hasTypeReopen = (unresolvedType.reopenCount ?? 0) > (resolvedType.reopenCount ?? 0);
                  const hasLaterTypeMistake = Boolean(
                    resolvedType.resolvedAt &&
                    !Number.isNaN(unresTime) &&
                    !Number.isNaN(resTime) &&
                    unresTime > resTime
                  );
                  if (hasTypeReopen || hasLaterTypeMistake) {
                    typeResolved = false;
                  } else {
                    typeResolved = true;
                  }
                }

                mergedTypeResolutionMap[t] = {
                  mistakeCount: Math.max(localState.mistakeCount || 0, cloudState.mistakeCount || 0),
                  consecutiveCorrect: typeResolved
                    ? Math.max(localState.consecutiveCorrect || 0, cloudState.consecutiveCorrect || 0, 2)
                    : (!localState.resolved ? localState.consecutiveCorrect : cloudState.consecutiveCorrect) || 0,
                  resolved: typeResolved,
                  reopenCount: Math.max(localState.reopenCount || 0, cloudState.reopenCount || 0),
                  lastMistakeAt: (localState.lastMistakeAt && cloudState.lastMistakeAt)
                    ? (localState.lastMistakeAt > cloudState.lastMistakeAt ? localState.lastMistakeAt : cloudState.lastMistakeAt)
                    : (localState.lastMistakeAt || cloudState.lastMistakeAt),
                  resolvedAt: typeResolved
                    ? (localState.resolvedAt || cloudState.resolvedAt || new Date().toISOString())
                    : undefined,
                };
              }
            }
          }

          // Reconcile word-level resolved status if all individual types are resolved
          const typeEntries = Object.values(mergedTypeResolutionMap);
          if (typeEntries.length > 0 && typeEntries.every((ts) => ts && ts.resolved)) {
            isResolved = true;
          }
        }

        const mergedLastMistakeAt = (existing.lastMistakeAt && m.lastMistakeAt)
          ? (existing.lastMistakeAt > m.lastMistakeAt ? existing.lastMistakeAt : m.lastMistakeAt)
          : (existing.lastMistakeAt || m.lastMistakeAt);

        nextMistakeBank[foundKey] = {
          ...existing,
          ...m,
          resolved: isResolved,
          lastMistakeAt: mergedLastMistakeAt,
          consecutiveCorrect: isResolved
            ? Math.max(existing.consecutiveCorrect || 0, m.consecutiveCorrect || 0, 2)
            : (!existing.resolved ? existing.consecutiveCorrect : m.consecutiveCorrect) || 0,
          wrongCount: Math.max(
            existing.wrongCount || 0,
            m.wrongCount || 0,
            (existing as any).mistakeCount || 0,
            (m as any).mistakeCount || 0
          ),
          mistakeCount: Math.max(
            (existing as any).mistakeCount || 0,
            (m as any).mistakeCount || 0,
            existing.wrongCount || 0,
            m.wrongCount || 0
          ),
          reopenCount: Math.max(existing.reopenCount || 0, m.reopenCount || 0),
          typeCounts: mergedTypeCounts,
          sourceCounts: mergedSourceCounts,
          typeResolutionMap: mergedTypeResolutionMap,
          resolvedDate: isResolved
            ? (existing.resolvedDate || m.resolvedDate || new Date().toISOString())
            : undefined,
        };
      }
    }
  }

  // 8. Merge Daily History
  const nextDailyHistory = { ...state.dailyHistory };
  const effectiveDailyLogs = Array.isArray(cloudDailyLogs)
    ? cloudDailyLogs
    : Array.isArray(payload.dailyLogs)
    ? payload.dailyLogs
    : payload.dailyLog && typeof payload.dailyLog === 'object'
    ? [payload.dailyLog]
    : [];

  if (effectiveDailyLogs.length > 0) {
    const defaultToday = getVietnamDateString();
    for (const log of effectiveDailyLogs) {
      if (!log || typeof log !== 'object') continue;
      const logDate = log.date || defaultToday;
      const existing = nextDailyHistory[logDate];
      const rawLearned = typeof log.words_learned === 'number'
        ? log.words_learned
        : (typeof log.wordsLearned === 'number' ? log.wordsLearned : 0);
      const safeLearned = rawLearned > 100 ? 0 : Math.max(0, rawLearned);
      const safeXp = typeof log.xp_earned === 'number'
        ? Math.max(0, log.xp_earned)
        : (typeof log.xpEarned === 'number' ? Math.max(0, log.xpEarned) : 0);
      const cloudQuizzes = typeof log.quizzes_completed === 'number'
        ? Math.max(0, log.quizzes_completed)
        : (typeof log.quizzesCompleted === 'number' ? Math.max(0, log.quizzesCompleted) : 0);

      if (!existing) {
        nextDailyHistory[logDate] = {
          date: logDate,
          wordsReviewed: safeLearned,
          newWordsLearned: 0,
          quizzesCompleted: cloudQuizzes,
          pronunciationsMastered: 0,
          xpGained: safeXp,
        };
      } else {
        const localTotal = (existing.wordsReviewed || 0) + (existing.newWordsLearned || 0);
        const wordsDelta = Math.max(0, safeLearned - localTotal);
        nextDailyHistory[logDate] = {
          ...existing,
          wordsReviewed: (existing.wordsReviewed || 0) + wordsDelta,
          quizzesCompleted: Math.max(existing.quizzesCompleted || 0, cloudQuizzes),
          xpGained: Math.max(existing.xpGained || 0, safeXp),
        };
      }
    }
  }

  const nextVocabList = composeVocabularyList(nextSrsMap, nextCustomWords);

  const rawAlgorithm = payload.srsAlgorithm || payload.cloudSrsAlgorithm;
  const nextAlgorithm: SRSAlgorithmType =
    rawAlgorithm === 'fsrs' || rawAlgorithm === 'sm2' ? rawAlgorithm : state.srsAlgorithm || 'sm2';

  const rawFsrsSettings = payload.fsrsSettings || payload.cloudFsrsSettings;
  const nextFsrsSettings =
    rawFsrsSettings && typeof rawFsrsSettings === 'object'
      ? { ...state.fsrsSettings, ...rawFsrsSettings }
      : state.fsrsSettings;

  // 9. Merge Recent Review Events: Deduplicate by ID, sort descending by timestamp, keep newest 200
  const localEvents = state.recentReviewEvents || [];
  const cloudEvents = Array.isArray(payload.recentReviewEvents)
    ? payload.recentReviewEvents
    : (Array.isArray(payload.cloudRecentReviewEvents) ? payload.cloudRecentReviewEvents : []);
  const eventMap = new Map<string, SRSReviewEvent>();
  for (const ev of cloudEvents) {
    if (ev && typeof ev === 'object' && ev.id) {
      eventMap.set(ev.id, ev);
    }
  }
  for (const ev of localEvents) {
    if (ev && typeof ev === 'object' && ev.id) {
      eventMap.set(ev.id, ev);
    }
  }
  const nextRecentEvents = Array.from(eventMap.values())
    .sort((a, b) => {
      const timeA = typeof a.timestamp === 'string' ? Date.parse(a.timestamp) : 0;
      const timeB = typeof b.timestamp === 'string' ? Date.parse(b.timestamp) : 0;
      return (Number.isNaN(timeB) ? 0 : timeB) - (Number.isNaN(timeA) ? 0 : timeA);
    })
    .slice(0, 200);

  const incomingStats = (payload as any)?.wordLearningStats || (payload as any)?.cloudWordLearningStats;
  const nextWordLearningStats = incomingStats
    ? mergeWordLearningStats(state.wordLearningStats || {}, sanitizeWordLearningStats(incomingStats))
    : (state.wordLearningStats || {});

  const incomingTelemetry = (payload as any)?.adaptiveQuizTelemetry || (payload as any)?.cloudAdaptiveQuizTelemetry;
  const nextAdaptiveQuizTelemetry = incomingTelemetry
    ? mergeAdaptiveQuizTelemetryState(state.adaptiveQuizTelemetry, incomingTelemetry)
    : state.adaptiveQuizTelemetry;

  const incomingCerts =
    rawSkills?.level_certifications ||
    rawSkills?.levelCertifications ||
    cloudProfile?.level_certifications ||
    cloudProfile?.levelCertifications ||
    payload.levelCertifications ||
    payload.cloudLevelCertifications;
  const nextLevelCertifications = mergeLevelCertifications(state.levelCertifications, incomingCerts);

  const incomingHistory =
    rawSkills?.checkpoint_history ||
    rawSkills?.checkpointHistory ||
    cloudProfile?.checkpoint_history ||
    cloudProfile?.checkpointHistory ||
    payload.checkpointHistory ||
    payload.cloudCheckpointHistory;
  const nextCheckpointHistory = mergeCheckpointHistory(state.checkpointHistory, incomingHistory);

  const incomingResume = (payload as any)?.cloudResumeActivities || (payload as any)?.resumeActivities;
  let nextResumeActivities = incomingResume
    ? mergeResumeActivities(state.resumeActivities, incomingResume)
    : (state.resumeActivities || {});
  // Invariant: Completed Always Wins!
  // Any finalized attempt in nextCheckpointHistory must never be resurrected as in-progress.
  nextResumeActivities = pruneFinalizedCheckpointResumes(nextResumeActivities, nextCheckpointHistory);

  return {
    profile: nextProfile,
    geminiApiKey: state.geminiApiKey || state.profile.geminiApiKey || nextProfile.geminiApiKey || '',
    userCustomWords: nextCustomWords,
    userCollocations: nextCollocations,
    srsProgressMap: nextSrsMap,
    mistakeBank: nextMistakeBank,
    dailyHistory: nextDailyHistory,
    vocabularyList: nextVocabList,
    fourSkillsScores: nextSkillsScores,
    fourSkillsEvidence: nextSkillsEvidence,
    completedListeningLessonIds: nextCompletedListeningIds,
    fourSkillsCompletionProgress: nextCompletionProgress,
    hasLearnedNightOwl: nextNightOwl,
    srsAlgorithm: nextAlgorithm,
    fsrsSettings: nextFsrsSettings,
    recentReviewEvents: nextRecentEvents,
    wordLearningStats: nextWordLearningStats,
    adaptiveQuizTelemetry: nextAdaptiveQuizTelemetry,
    resumeActivities: nextResumeActivities,
    levelCertifications: nextLevelCertifications,
    checkpointHistory: nextCheckpointHistory,
  };
}
