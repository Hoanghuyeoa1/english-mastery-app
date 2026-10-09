// src/services/examGenerator.ts
import {
  ToeicQuestion,
  ToeicQuestionGroup,
  ToeicPart,
  ToeicSkill,
  ToeicDifficulty,
  ExamModeConfig,
  ExamModeType,
  ToeicExamSnapshot,
  GenerateExamOptions,
  RecentExamHistory,
  EXAM_MODE_CONFIGS,
  ToeicExperienceMode,
  ToeicSkillScope,
  ExamExperienceConfig,
  ToeicAdaptiveState,
  INITIAL_ADAPTIVE_STATE,
  resolveExperienceAndSkillScope,
  isCombinationSupported,
} from '../types/toeic';
import {
  TOEIC_QUESTION_BANK,
  TOEIC_QUESTION_GROUPS,
} from '../data/toeicQuestionsData';
import { toeicQuestionIndex, ToeicQuestionIndex } from './toeicIndex';

/**
 * 32-bit Mulberry32 PRNG cho khả năng tái lập kết quả sinh đề hoàn toàn (Deterministic Seed).
 */
export function createExamRng(seed?: number | string): { next: () => number; seed: number } {
  let s: number;

  if (typeof seed === 'string') {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < seed.length; i++) {
      h = Math.imul(h ^ seed.charCodeAt(i), 16777619);
    }
    s = h >>> 0;
  } else if (typeof seed === 'number' && Number.isFinite(seed)) {
    s = (seed >>> 0) || 1337;
  } else {
    s = Math.floor(Math.random() * 2147483647);
  }

  const numericSeed = s;

  const next = function (): number {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  return { next, seed: numericSeed };
}

/**
 * Danh sách các Part tổ chức theo Group (Part 3, 4, 6, 7)
 */
export const GROUPED_PARTS: Set<ToeicPart> = new Set<ToeicPart>([
  'part3_conv',
  'part4_talks',
  'part6_text',
  'part7_reading',
]);

/**
 * Chuẩn hóa recentHistory từ nhiều định dạng đầu vào khác nhau
 */
function normalizeRecentHistory(
  recentHistory?: RecentExamHistory | string[]
): {
  recentQuestionIds: string[];
  recentGroupIds: string[];
  qRecencyMap: Map<string, number>;
  gRecencyMap: Map<string, number>;
} {
  let recentQuestionIds: string[] = [];
  let recentGroupIds: string[] = [];

  if (Array.isArray(recentHistory)) {
    recentQuestionIds = recentHistory;
  } else if (recentHistory && typeof recentHistory === 'object') {
    recentQuestionIds = recentHistory.recentQuestionIds || [];
    recentGroupIds = recentHistory.recentGroupIds || [];
  }

  const qRecencyMap = new Map<string, number>();
  recentQuestionIds.forEach((id, idx) => {
    qRecencyMap.set(id, idx);
  });

  const gRecencyMap = new Map<string, number>();
  recentGroupIds.forEach((id, idx) => {
    gRecencyMap.set(id, idx);
  });

  return { recentQuestionIds, recentGroupIds, qRecencyMap, gRecencyMap };
}

/**
 * Tính điểm khoảng cách difficulty khi cần nới lỏng (relaxation)
 */
function getDifficultyDistance(target: ToeicDifficulty, candidate: ToeicDifficulty): number {
  const levels: Record<ToeicDifficulty, number> = {
    easy: 1,
    medium: 2,
    hard: 3,
  };
  return Math.abs(levels[target] - levels[candidate]);
}

/**
 * Service sinh đề thi TOEIC độc lập, hỗ trợ rule-based config, cân bằng difficulty,
 * bảo toàn trọn vẹn Group (atomic), chống lặp (anti-repeat) và đảm bảo seed determinism.
 */
export function generateToeicExam(options: GenerateExamOptions): ToeicExamSnapshot {
  const {
    mode: rawMode,
    experienceMode: inputExpMode,
    skillScope: inputSkillScope,
    config: customConfig,
    questionBank,
    questionGroups,
    recentHistory,
    seed,
    difficultyProfile,
    weakAreas = [],
  } = options;

  // Phân giải hai chiều: experienceMode & skillScope
  const {
    experienceMode,
    skillScope,
    resolvedExamMode,
    experienceConfig,
  } = resolveExperienceAndSkillScope({
    experienceMode: inputExpMode,
    skillScope: inputSkillScope,
    mode: rawMode,
  });

  // Mock Test mô phỏng chuẩn ETS: tuyệt đối không ưu tiên hay làm lệch đề theo weakAreas cá nhân
  const effectiveWeakAreas = experienceMode === 'mock' ? [] : weakAreas;

  const warnings: string[] = [];

  // Kiểm tra ma trận hỗ trợ tổ hợp
  const combinationCheck = isCombinationSupported(experienceMode, skillScope);
  if (!combinationCheck.supported && combinationCheck.reason) {
    warnings.push(`Tổ hợp không khuyến nghị: ${combinationCheck.reason}`);
  }

  // 1. Xác định cấu hình Mode
  const effectiveMode = rawMode || resolvedExamMode;
  const baseConfig: ExamModeConfig =
    customConfig ||
    EXAM_MODE_CONFIGS[effectiveMode as ExamModeType] ||
    EXAM_MODE_CONFIGS[resolvedExamMode] ||
    EXAM_MODE_CONFIGS['2skills_full'];

  const config: ExamModeConfig = {
    ...baseConfig,
    ...(customConfig || {}),
  };

  // Áp dụng difficultyProfile tùy biến nếu có
  if (difficultyProfile) {
    config.difficultyDistribution = {
      easy: difficultyProfile.easy ?? config.difficultyDistribution.easy,
      medium: difficultyProfile.medium ?? config.difficultyDistribution.medium,
      hard: difficultyProfile.hard ?? config.difficultyDistribution.hard,
    };
  }

  // 2. Khởi tạo PRNG
  const { next: rng, seed: resolvedSeed } = createExamRng(seed);

  // 3. Khởi tạo Index (tận dụng O(1) in-memory index)
  let index: ToeicQuestionIndex;
  if (questionBank || questionGroups) {
    index = new ToeicQuestionIndex();
    index.buildIndex(
      questionBank || TOEIC_QUESTION_BANK,
      questionGroups || TOEIC_QUESTION_GROUPS
    );
  } else {
    index = toeicQuestionIndex;
  }

  // 4. Chuẩn hóa lịch sử làm bài (Anti-repeat)
  const { recentQuestionIds, recentGroupIds, qRecencyMap, gRecencyMap } =
    normalizeRecentHistory(recentHistory);

  const selectedQuestionIds = new Set<string>();
  const selectedGroupIds = new Set<string>();
  const selectedQuestions: ToeicQuestion[] = [];
  const selectedGroups: ToeicQuestionGroup[] = [];

  // 5. Tính toán chỉ tiêu Difficulty (Quotas)
  const totalQuestions = config.totalQuestions;
  const targetEasy = Math.round(totalQuestions * config.difficultyDistribution.easy);
  const targetMedium = Math.round(totalQuestions * config.difficultyDistribution.medium);
  const targetHard = Math.max(0, totalQuestions - targetEasy - targetMedium);

  const remainingDifficultyQuota: Record<ToeicDifficulty, number> = {
    easy: targetEasy,
    medium: targetMedium,
    hard: targetHard,
  };

  let relaxedHistoryUsed = false;
  let relaxedDifficultyUsed = false;

  // 6. Duyệt qua từng Part theo đúng thứ tự cấu hình chuẩn của Mode
  const partsToProcess = config.parts || Object.keys(config.partCounts) as ToeicPart[];

  for (const part of partsToProcess) {
    const isGrouped = GROUPED_PARTS.has(part);

    if (isGrouped) {
      // -----------------------------------------------------------------------
      // A. GROUP SELECTION (Part 3, 4, 6, 7) - Atomic Invariant
      // -----------------------------------------------------------------------
      let neededGroups = config.groupCounts?.[part];
      const targetQCount = config.partCounts[part] ?? 0;

      if (neededGroups === undefined || (customConfig?.partCounts?.[part] !== undefined && targetQCount % 3 !== 0)) {
        if (targetQCount <= 0) {
          neededGroups = 0;
        } else {
          // Tính số group tương ứng với targetQCount (mặc định mỗi group 3 câu)
          const strategy = config.groupRoundingStrategy || 'ceiling';
          if (strategy === 'ceiling') {
            neededGroups = Math.ceil(targetQCount / 3);
          } else if (strategy === 'floor') {
            neededGroups = Math.max(1, Math.floor(targetQCount / 3));
          } else {
            neededGroups = Math.max(1, Math.round(targetQCount / 3));
          }

          if (targetQCount % 3 !== 0) {
            warnings.push(
              `Part ${part}: target câu là ${targetQCount}, tự động điều chỉnh chọn ${neededGroups} group nguyên vẹn (atomic invariant).`
            );
          }
        }
      } else if (targetQCount > 0 && targetQCount % 3 !== 0) {
        warnings.push(
          `Part ${part}: target câu là ${targetQCount}, tự động điều chỉnh chọn ${neededGroups} group nguyên vẹn (atomic invariant).`
        );
      }

      if (neededGroups <= 0) continue;

      // Tìm các ứng viên group hợp lệ chưa chọn
      const candidateGroups = index
        .getGroupsByPart(part)
        .filter((g) => {
          if (selectedGroupIds.has(g.id)) return false;
          // Không được trùng bất kỳ câu hỏi nào đã chọn trong đề
          return g.questionIds.every((qId) => !selectedQuestionIds.has(qId));
        });

      if (candidateGroups.length < neededGroups) {
        warnings.push(
          `Part ${part}: Không đủ group duy nhất trong ngân hàng (cần ${neededGroups}, có ${candidateGroups.length}).`
        );
      }

      // Cảnh báo nếu toàn bộ candidate groups đều đã xuất hiện trong recent history
      const hasUnseenGroups = candidateGroups.some(
        (g) => !recentGroupIds.includes(g.id) && g.questionIds.every((id) => !recentQuestionIds.includes(id))
      );
      if (!hasUnseenGroups && candidateGroups.length > 0) {
        warnings.push(
          `Part ${part}: Toàn bộ group khả dụng đã xuất hiện trong lịch sử làm bài gần đây; đang tái sử dụng theo chiến lược Least Recently Seen.`
        );
      }

      // Đánh giá và xếp hạng ứng viên group
      for (let gIdx = 0; gIdx < neededGroups && candidateGroups.length > 0; gIdx++) {
        const scoredCandidates = candidateGroups.map((group) => {
          let score = 0;
          let isSeen = false;
          let isDifficultyRelaxed = false;

          // 1. Anti-repeat score (Tier 1: Unseen, Tier 2: Oldest seen)
          const isGroupSeen =
            recentGroupIds.includes(group.id) ||
            group.questionIds.some((id) => recentQuestionIds.includes(id));

          if (!isGroupSeen) {
            score += 10000; // Unseen group ưu tiên cao nhất
          } else {
            isSeen = true;
            // Tính mức độ cũ của group (chỉ số recency nhỏ nhất = đã làm lâu nhất)
            const minQIdx = Math.min(
              ...group.questionIds.map((id) => qRecencyMap.get(id) ?? Number.MAX_SAFE_INTEGER)
            );
            const gIdxRecency = gRecencyMap.get(group.id) ?? Number.MAX_SAFE_INTEGER;
            const earliestSeen = Math.min(minQIdx, gIdxRecency);
            score += Math.max(0, 5000 - earliestSeen);
          }

          // 2. Difficulty fit score
          const gDiff = group.difficulty || 'medium';
          if (remainingDifficultyQuota[gDiff] > 0) {
            score += 2000 + remainingDifficultyQuota[gDiff] * 200;
          } else {
            isDifficultyRelaxed = true;
            // Tìm khoảng cách tới difficulty còn thiếu
            let bestDistance = 999;
            (['easy', 'medium', 'hard'] as ToeicDifficulty[]).forEach((d) => {
              if (remainingDifficultyQuota[d] > 0) {
                const dist = getDifficultyDistance(d, gDiff);
                if (dist < bestDistance) bestDistance = dist;
              }
            });
            score += Math.max(0, 1000 - bestDistance * 300);
          }

          // 3. Weak areas preference (khi có bằng chứng thực tế, tăng ưu tiên tuyển chọn - bỏ qua trong Mock)
          if (effectiveWeakAreas.length > 0) {
            const matchesWeak = effectiveWeakAreas.some(
              (w) =>
                (w.part && w.part === group.part) ||
                (w.topic && w.topic === group.topic) ||
                (w.grammarTag && group.grammarTags?.includes(w.grammarTag))
            );
            if (matchesWeak) {
              score += 1500;
            }
          }

          // 4. Deterministic tie-break
          score += rng() * 10;

          return { group, score, isSeen, isDifficultyRelaxed };
        });

        // Chọn group có điểm cao nhất
        scoredCandidates.sort((a, b) => b.score - a.score);
        const topCandidate = scoredCandidates[0];
        const chosen = topCandidate.group;

        if (topCandidate.isSeen) {
          relaxedHistoryUsed = true;
        }
        if (topCandidate.isDifficultyRelaxed) {
          relaxedDifficultyUsed = true;
        }

        // Lưu group vào danh sách
        selectedGroupIds.add(chosen.id);
        selectedGroups.push(chosen);

        // Đưa toàn bộ câu hỏi của group vào đề thi (Atomic bundling)
        const groupQuestions = index.getQuestionsByGroupId(chosen.id);
        for (const q of groupQuestions) {
          selectedQuestionIds.add(q.id);
          selectedQuestions.push(q);

          const qDiff = q.difficulty || chosen.difficulty || 'medium';
          if (remainingDifficultyQuota[qDiff] > 0) {
            remainingDifficultyQuota[qDiff]--;
          }
        }

        // Loại bỏ group đã chọn khỏi candidates
        const chosenIndex = candidateGroups.findIndex((g) => g.id === chosen.id);
        if (chosenIndex >= 0) {
          candidateGroups.splice(chosenIndex, 1);
        }
      }
    } else {
      // -----------------------------------------------------------------------
      // B. DISCRETE QUESTION SELECTION (Part 1, 2, 5, Speaking, Writing)
      // -----------------------------------------------------------------------
      const neededCount = config.partCounts[part] ?? 0;
      if (neededCount <= 0) continue;

      // Lấy danh sách câu hỏi độc lập của part
      const candidateQuestions = index
        .getQuestionsByPart(part)
        .filter((q) => !selectedQuestionIds.has(q.id) && !q.groupId);

      if (candidateQuestions.length < neededCount) {
        warnings.push(
          `Part ${part}: Không đủ câu hỏi duy nhất trong ngân hàng (cần ${neededCount}, có ${candidateQuestions.length}).`
        );
      }

      // Cảnh báo nếu toàn bộ candidates của part đều đã gặp trong recent history
      const hasUnseenQuestions = candidateQuestions.some((q) => !recentQuestionIds.includes(q.id));
      if (!hasUnseenQuestions && candidateQuestions.length > 0) {
        warnings.push(
          `Part ${part}: Toàn bộ câu hỏi khả dụng đã xuất hiện trong lịch sử làm bài gần đây; đang tái sử dụng theo chiến lược Least Recently Seen.`
        );
      }

      for (let qIdx = 0; qIdx < neededCount && candidateQuestions.length > 0; qIdx++) {
        const scoredCandidates = candidateQuestions.map((q) => {
          let score = 0;
          let isSeen = false;
          let isDifficultyRelaxed = false;

          // 1. Anti-repeat score
          const isQSeen = recentQuestionIds.includes(q.id);
          if (!isQSeen) {
            score += 10000; // Unseen ưu tiên cao nhất
          } else {
            isSeen = true;
            const seenIndex = qRecencyMap.get(q.id) ?? Number.MAX_SAFE_INTEGER;
            score += Math.max(0, 5000 - seenIndex); // Lâu chưa gặp được ưu tiên hơn
          }

          // 2. Difficulty fit score
          const qDiff = q.difficulty || 'medium';
          if (remainingDifficultyQuota[qDiff] > 0) {
            score += 2000 + remainingDifficultyQuota[qDiff] * 200;
          } else {
            isDifficultyRelaxed = true;
            let bestDistance = 999;
            (['easy', 'medium', 'hard'] as ToeicDifficulty[]).forEach((d) => {
              if (remainingDifficultyQuota[d] > 0) {
                const dist = getDifficultyDistance(d, qDiff);
                if (dist < bestDistance) bestDistance = dist;
              }
            });
            score += Math.max(0, 1000 - bestDistance * 300);
          }

          // 3. Weak areas preference (khi có bằng chứng thực tế, tăng ưu tiên tuyển chọn - bỏ qua trong Mock)
          if (effectiveWeakAreas.length > 0) {
            const matchesWeak = effectiveWeakAreas.some(
              (w) =>
                (w.part && w.part === q.part) ||
                (w.topic && w.topic === q.topic) ||
                (w.grammarTag && q.grammarTags?.includes(w.grammarTag))
            );
            if (matchesWeak) {
              score += 1500;
            }
          }

          // 4. Deterministic tie-break
          score += rng() * 10;

          return { q, score, isSeen, isDifficultyRelaxed };
        });

        // Chọn câu hỏi có điểm cao nhất
        scoredCandidates.sort((a, b) => b.score - a.score);
        const topCandidate = scoredCandidates[0];
        const chosenQ = topCandidate.q;

        if (topCandidate.isSeen) {
          relaxedHistoryUsed = true;
        }
        if (topCandidate.isDifficultyRelaxed) {
          relaxedDifficultyUsed = true;
        }

        selectedQuestionIds.add(chosenQ.id);
        selectedQuestions.push(chosenQ);

        const qDiff = chosenQ.difficulty || 'medium';
        if (remainingDifficultyQuota[qDiff] > 0) {
          remainingDifficultyQuota[qDiff]--;
        }

        // Loại bỏ câu hỏi đã chọn khỏi candidates
        const chosenIndex = candidateQuestions.findIndex((q) => q.id === chosenQ.id);
        if (chosenIndex >= 0) {
          candidateQuestions.splice(chosenIndex, 1);
        }
      }
    }
  }

  // 7. Thống kê kết quả thi thực tế
  const actualPartCounts: Record<ToeicPart, number> = {
    part1_photos: 0,
    part2_qna: 0,
    part3_conv: 0,
    part4_talks: 0,
    part5_grammar: 0,
    part6_text: 0,
    part7_reading: 0,
    speaking_read: 0,
    writing_email: 0,
  };

  const difficultyBreakdown = {
    easy: 0,
    medium: 0,
    hard: 0,
  };

  const skillBreakdown = {
    listening: 0,
    reading: 0,
    speaking: 0,
    writing: 0,
  };

  selectedQuestions.forEach((q) => {
    actualPartCounts[q.part]++;

    const diff = q.difficulty || 'medium';
    difficultyBreakdown[diff]++;

    skillBreakdown[q.skill]++;
  });

  // Tạo Snapshot ID định danh duy nhất
  const snapshotId = `toeic_exam_${config.mode}_s${resolvedSeed}_${Date.now()}`;

  return {
    id: snapshotId,
    mode: config.mode,
    experienceMode,
    skillScope,
    experienceConfig,
    adaptiveState:
      options.adaptiveState ||
      (experienceMode === 'diagnostic' ? { ...INITIAL_ADAPTIVE_STATE } : undefined),
    title: config.name,
    seed: resolvedSeed,
    totalQuestions: selectedQuestions.length,
    durationMinutes: config.durationMinutes,
    questions: selectedQuestions,
    groups: selectedGroups,
    partCounts: actualPartCounts,
    difficultyBreakdown,
    skillBreakdown,
    diagnostics: {
      relaxedHistory: relaxedHistoryUsed,
      relaxedDifficulty: relaxedDifficultyUsed,
      warnings,
      selectedGroupIds: Array.from(selectedGroupIds),
      selectedQuestionIds: Array.from(selectedQuestionIds),
    },
    createdAt: new Date().toISOString(),
  };
}

/**
 * Hàm kiểm tra toàn vẹn chất lượng của Exam Snapshot sinh ra
 */
export function validateExamSnapshot(
  snapshot: ToeicExamSnapshot,
  config?: ExamModeConfig
): { isValid: boolean; errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 1. Kiểm tra số lượng câu hỏi
  if (snapshot.questions.length !== snapshot.totalQuestions) {
    errors.push(
      `Snapshot totalQuestions (${snapshot.totalQuestions}) không khớp số câu thực tế (${snapshot.questions.length}).`
    );
  }

  if (config && snapshot.totalQuestions !== config.totalQuestions) {
    warnings.push(
      `Snapshot totalQuestions (${snapshot.totalQuestions}) khác config.totalQuestions (${config.totalQuestions}).`
    );
  }

  // 2. Kiểm tra trùng lặp câu hỏi (No duplicate question)
  const questionIds = new Set<string>();
  for (const q of snapshot.questions) {
    if (questionIds.has(q.id)) {
      errors.push(`Phát hiện câu hỏi trùng lặp trong đề thi: "${q.id}".`);
    }
    questionIds.add(q.id);
  }

  // 3. Kiểm tra trùng lặp group (No duplicate group)
  const groupIds = new Set<string>();
  for (const g of snapshot.groups) {
    if (groupIds.has(g.id)) {
      errors.push(`Phát hiện group trùng lặp trong đề thi: "${g.id}".`);
    }
    groupIds.add(g.id);
  }

  // 4. Kiểm tra tính nguyên khối của Group (Atomic Group Integrity)
  const snapshotGroupMap = new Map<string, ToeicQuestionGroup>();
  snapshot.groups.forEach((g) => snapshotGroupMap.set(g.id, g));

  for (const g of snapshot.groups) {
    const presentQuestionIds = g.questionIds.filter((qId) => questionIds.has(qId));

    if (presentQuestionIds.length !== g.questionIds.length) {
      errors.push(
        `Group "${g.id}" bị cắt xén (chỉ có ${presentQuestionIds.length}/${g.questionIds.length} câu trong đề). Vi phạm atomic group invariant!`
      );
    }
  }

  // Kiểm tra câu hỏi thuộc group phải có group trong snapshot
  for (const q of snapshot.questions) {
    if (q.groupId) {
      if (!snapshotGroupMap.has(q.groupId)) {
        errors.push(
          `Câu hỏi "${q.id}" trỏ tới groupId "${q.groupId}" nhưng group này không có trong snapshot.groups.`
        );
      }
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
}
