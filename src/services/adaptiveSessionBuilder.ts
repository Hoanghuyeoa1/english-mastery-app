// src/services/adaptiveSessionBuilder.ts

import {
  AdaptiveExercise,
  AdaptiveLearningSession,
  MistakeRecord,
  AdaptiveMistakeProfile,
  MistakeType,
  PracticeModuleId,
} from '../types';
import {
  toAdaptiveProfile,
  calculateAdaptiveScore,
  getMistakeRecurrenceLevel,
  calculateWeaknessSummary,
} from './adaptiveMistakeService';
import { routeMistakeToModule } from './adaptivePracticeRouter';

export interface AdaptiveSessionBuildOptions {
  maxItems?: number;
  targetMinutes?: number;
  filterType?: MistakeType;
  targetModule?: PracticeModuleId;
  includeResolved?: boolean;
  now?: number;
}

export const SESSION_HARD_LIMITS = {
  MIN_ITEMS: 1,
  DEFAULT_ITEMS: 8,
  MAX_ITEMS: 15,
  DEFAULT_MINUTES: 10,
  MAX_MINUTES: 25,
} as const;

/**
 * Ước tính thời gian (phút) trung bình cho từng loại bài tập theo module.
 */
const MODULE_ESTIMATED_MINUTES: Record<PracticeModuleId, number> = {
  flashcard: 0.8,
  classic_quiz: 1.0,
  word_scramble: 1.2,
  dictation: 1.5,
  listening: 1.5,
  speaking: 1.5,
  pronunciation: 1.2,
  shadowing: 1.5,
  collocation: 1.0,
  cloze: 1.0,
  reading: 2.0,
  writing: 2.5,
  toeic: 2.0,
  tutor: 2.0,
};

/**
 * Pure Function: Xây dựng một phiên học thích ứng cân bằng (Adaptive Learning Session)
 * dựa trên độ ưu tiên lỗi sai, thời điểm gần nhất, tần suất tái diễn và độ phân bổ cân đối.
 * Tuyệt đối không làm thay đổi (mutate) bất kỳ dữ liệu đầu vào nào.
 */
export function buildAdaptiveLearningSession(
  mistakes: Record<string, MistakeRecord> | MistakeRecord[] | AdaptiveMistakeProfile[],
  options?: AdaptiveSessionBuildOptions
): AdaptiveLearningSession {
  const now = options?.now ?? Date.now();
  const rawMaxItems = options?.maxItems ?? SESSION_HARD_LIMITS.DEFAULT_ITEMS;
  // Áp dụng hard limit để không bao giờ tạo phiên học quá dài
  const maxItems = Math.max(
    SESSION_HARD_LIMITS.MIN_ITEMS,
    Math.min(SESSION_HARD_LIMITS.MAX_ITEMS, rawMaxItems)
  );
  const includeResolved = Boolean(options?.includeResolved);

  // 1. Chuẩn hóa danh sách đầu vào và clone an toàn
  const list = (Array.isArray(mistakes) ? mistakes : Object.values(mistakes || {}))
    .filter((item): item is MistakeRecord | AdaptiveMistakeProfile => Boolean(item));

  const totalValidItems = list.length;
  const unresolvedItems = list.filter((item) => !item.resolved);
  const candidatePool = includeResolved ? list : unresolvedItems;

  const sessionId = `session_${now}_${Math.random().toString(36).substring(2, 8)}`;

  // 2. Kiểm tra Low-Data / Empty Guard
  if (candidatePool.length === 0) {
    return {
      id: sessionId,
      title: 'Phiên Luyện Tập Thích Ứng',
      estimatedMinutes: 0,
      totalExercises: 0,
      exercises: [],
      focusWeakness: null,
      moduleDistribution: {},
      generatedAt: now,
      hasInsufficientData: true,
    };
  }

  // 3. Chấm điểm ưu tiên (Priority Scoring) và định tuyến cho từng item
  interface ScoredCandidate {
    item: MistakeRecord | AdaptiveMistakeProfile;
    targetId: string;
    word: string;
    meaning?: string;
    priority: number;
    mistakeType: MistakeType;
    recommendedModule: PracticeModuleId;
    reason: string;
    reopenCount: number;
    lastMistakeTime: number;
    mistakeCount: number;
  }

  const scoredCandidates: ScoredCandidate[] = [];

  for (const item of candidatePool) {
    const targetId: string = item.id || ('word' in item && item.word ? item.word : 'unknown_item');
    const word: string = ('word' in item && item.word) ? item.word : (item.id || '');
    const meaning: string | undefined = 'meaning' in item ? (item as MistakeRecord).meaning : undefined;

    // Lấy recommendation và profile
    const rec = routeMistakeToModule(item, { context: { now } });

    if (options?.filterType && rec.mistakeType !== options.filterType) {
      continue;
    }
    if (options?.targetModule && rec.recommendedModule !== options.targetModule) {
      continue;
    }

    const profile = 'totalMistakes' in item ? item : toAdaptiveProfile(item, now);
    let score = calculateAdaptiveScore(profile, { now });

    const reopenCount = 'reopenCount' in item ? (item.reopenCount ?? 0) : 0;
    const recurrence = 'recurrenceLevel' in item && item.recurrenceLevel
      ? item.recurrenceLevel
      : getMistakeRecurrenceLevel(item);

    // Ưu tiên cao: reopened + chronic + recent
    if (reopenCount > 0) score += 15;
    if (recurrence === 'chronic') score += 20;

    const rawLastMistake = item.lastMistakeAt;
    const lastMistakeTime = typeof rawLastMistake === 'number'
      ? rawLastMistake
      : rawLastMistake ? new Date(rawLastMistake).getTime() : 0;
    const isRecent = (now - lastMistakeTime) < 24 * 60 * 60 * 1000;
    if (isRecent) score += 10;

    const mistakeCount = 'totalMistakes' in item
      ? (item.totalMistakes ?? 0)
      : (item.mistakeCount ?? item.wrongCount ?? 0);

    scoredCandidates.push({
      item,
      targetId,
      word,
      meaning,
      priority: Math.min(100, Math.max(5, Math.round(score))),
      mistakeType: rec.mistakeType,
      recommendedModule: rec.recommendedModule,
      reason: rec.reason,
      reopenCount,
      lastMistakeTime,
      mistakeCount,
    });
  }

  if (scoredCandidates.length === 0) {
    return {
      id: sessionId,
      title: 'Phiên Luyện Tập Thích Ứng',
      estimatedMinutes: 0,
      totalExercises: 0,
      exercises: [],
      focusWeakness: null,
      moduleDistribution: {},
      generatedAt: now,
      hasInsufficientData: true,
    };
  }

  // Sắp xếp deterministic: priority giảm dần -> mistakeCount giảm dần -> thời gian gần nhất -> ID alphabet
  scoredCandidates.sort((a, b) => {
    if (b.priority !== a.priority) return b.priority - a.priority;
    if (b.mistakeCount !== a.mistakeCount) return b.mistakeCount - a.mistakeCount;
    if (b.lastMistakeTime !== a.lastMistakeTime) return b.lastMistakeTime - a.lastMistakeTime;
    return a.targetId.localeCompare(b.targetId);
  });

  // 4. Phân bổ cân bằng theo danh mục (Balanced Distribution) & Tránh Duplicate
  // Nhóm theo mistakeType
  const typeBuckets = new Map<MistakeType, ScoredCandidate[]>();
  for (const cand of scoredCandidates) {
    const bucket = typeBuckets.get(cand.mistakeType) || [];
    bucket.push(cand);
    typeBuckets.set(cand.mistakeType, bucket);
  }

  const selectedCandidates: ScoredCandidate[] = [];
  const seenIds = new Set<string>();

  // Helper an toàn thêm ứng viên chống trùng lặp
  const tryAdd = (cand: ScoredCandidate): boolean => {
    const idKey = cand.targetId.toLowerCase().trim();
    const wordKey = cand.word.toLowerCase().trim();
    if (seenIds.has(idKey) || (wordKey && seenIds.has(wordKey))) return false;
    seenIds.add(idKey);
    if (wordKey) seenIds.add(wordKey);
    selectedCandidates.push(cand);
    return true;
  };

  const types = Array.from(typeBuckets.keys());

  // Nếu có nhiều hơn 1 mistake type và đủ ứng viên: Áp dụng Round-Robin chọn lần lượt để cân đối
  if (types.length > 1 && scoredCandidates.length >= 4) {
    // Sắp xếp các loại lỗi theo điểm ưu tiên cao nhất của từng loại
    types.sort((t1, t2) => {
      const top1 = typeBuckets.get(t1)?.[0]?.priority ?? 0;
      const top2 = typeBuckets.get(t2)?.[0]?.priority ?? 0;
      return top2 - top1;
    });

    let addedInRound = true;
    let roundIndex = 0;

    while (selectedCandidates.length < maxItems && addedInRound) {
      addedInRound = false;
      for (const t of types) {
        if (selectedCandidates.length >= maxItems) break;
        const bucket = typeBuckets.get(t);
        if (bucket && roundIndex < bucket.length) {
          const cand = bucket[roundIndex];
          if (tryAdd(cand)) {
            addedInRound = true;
          }
        }
      }
      roundIndex++;
    }

    // Nếu vẫn chưa đủ maxItems (do duplicate hoặc bucket lệch độ dài), lấy thêm từ danh sách chung
    if (selectedCandidates.length < maxItems) {
      for (const cand of scoredCandidates) {
        if (selectedCandidates.length >= maxItems) break;
        tryAdd(cand);
      }
    }
  } else {
    // Trường hợp 1 type hoặc ít data: lấy thẳng top priority
    for (const cand of scoredCandidates) {
      if (selectedCandidates.length >= maxItems) break;
      tryAdd(cand);
    }
  }

  // 5. Chuyển đổi sang danh sách bài tập (AdaptiveExercise)
  let totalEstimatedMinutes = 0;
  const moduleDistribution: Partial<Record<PracticeModuleId, number>> = {};
  const typeCounts: Partial<Record<MistakeType, number>> = {};

  const exercises: AdaptiveExercise[] = selectedCandidates.map((c) => {
    const est = MODULE_ESTIMATED_MINUTES[c.recommendedModule] || 1.0;
    totalEstimatedMinutes += est;

    moduleDistribution[c.recommendedModule] = (moduleDistribution[c.recommendedModule] || 0) + 1;
    typeCounts[c.mistakeType] = (typeCounts[c.mistakeType] || 0) + 1;

    return {
      targetId: c.targetId,
      word: c.word,
      meaning: c.meaning,
      mistakeType: c.mistakeType,
      recommendedModule: c.recommendedModule,
      priority: c.priority,
      reason: c.reason,
      estimatedMinutes: Number(est.toFixed(1)),
    };
  });

  // 6. Xác định Focus Weakness
  let focusWeakness: MistakeType | null = null;
  let maxTypeCount = 0;
  for (const [t, cnt] of Object.entries(typeCounts)) {
    if ((cnt || 0) > maxTypeCount) {
      maxTypeCount = cnt || 0;
      focusWeakness = t as MistakeType;
    }
  }
  if (!focusWeakness) {
    const rawList = (Array.isArray(mistakes) ? mistakes : Object.values(mistakes || {}))
      .filter((item): item is MistakeRecord => Boolean(item) && 'mistakeCount' in item);
    const weaknessSummary = calculateWeaknessSummary(rawList);
    focusWeakness = weaknessSummary.primaryWeaknessType;
  }

  const roundedMinutes = Math.max(1, Math.min(SESSION_HARD_LIMITS.MAX_MINUTES, Math.round(totalEstimatedMinutes)));
  const title = `${roundedMinutes}-phút Luyện Thích Ứng`;

  return {
    id: sessionId,
    title,
    estimatedMinutes: roundedMinutes,
    totalExercises: exercises.length,
    exercises,
    focusWeakness,
    moduleDistribution,
    generatedAt: now,
    hasInsufficientData: totalValidItems < 2,
  };
}
