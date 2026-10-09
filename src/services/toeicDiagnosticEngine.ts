// src/services/toeicDiagnosticEngine.ts
import {
  ToeicQuestion,
  ToeicQuestionGroup,
  ToeicPart,
  ToeicDifficulty,
  ToeicAdaptiveState,
  INITIAL_ADAPTIVE_STATE,
} from '../types/toeic';
import { toeicQuestionIndex, ToeicQuestionIndex } from './toeicIndex';
import { createExamRng } from './examGenerator';
import { TOEIC_QUESTION_BANK, TOEIC_QUESTION_GROUPS } from '../data/toeicQuestionsData';

export type { ToeicAdaptiveState };
export { INITIAL_ADAPTIVE_STATE };

/**
 * Ngưỡng streak chuyển đổi difficulty (Deterministic rule: N = 2 câu liên tiếp)
 */
export const ADAPTIVE_STREAK_THRESHOLD = 2;

/**
 * Thứ tự phân cấp độ khó
 */
const DIFFICULTY_LEVELS: Record<ToeicDifficulty, number> = {
  easy: 1,
  medium: 2,
  hard: 3,
};

function getDifficultyDistance(a: ToeicDifficulty, b: ToeicDifficulty): number {
  return Math.abs(DIFFICULTY_LEVELS[a] - DIFFICULTY_LEVELS[b]);
}

/**
 * Hàm thuần túy đánh giá đáp án và cập nhật trạng thái thích ứng (Deterministic CAT Rule)
 * Quy tắc:
 * - N = 2 câu đúng liên tiếp -> tăng 1 cấp (easy -> medium, medium -> hard)
 * - N = 2 câu sai liên tiếp -> giảm 1 cấp (hard -> medium, medium -> easy)
 * - Kết quả xen kẽ (mixed) -> reset chuỗi và giữ nguyên cấp
 * - Bound: easy <-> medium <-> hard (không vượt range)
 */
export function evaluateAdaptiveAnswer(
  currentState: ToeicAdaptiveState,
  isCorrect: boolean,
  questionId?: string,
  questionIndex?: number
): ToeicAdaptiveState {
  let {
    currentDifficulty,
    recentCorrectStreak,
    recentWrongStreak,
    questionsAnswered,
    highestDifficultyReached,
    difficultyHistory,
  } = currentState;

  questionsAnswered += 1;

  if (isCorrect) {
    recentCorrectStreak += 1;
    recentWrongStreak = 0;

    if (recentCorrectStreak >= ADAPTIVE_STREAK_THRESHOLD) {
      if (currentDifficulty === 'easy') {
        currentDifficulty = 'medium';
        recentCorrectStreak = 0;
      } else if (currentDifficulty === 'medium') {
        currentDifficulty = 'hard';
        recentCorrectStreak = 0;
      } else {
        // hard + correct -> vẫn hard
        currentDifficulty = 'hard';
      }
    }
  } else {
    recentWrongStreak += 1;
    recentCorrectStreak = 0;

    if (recentWrongStreak >= ADAPTIVE_STREAK_THRESHOLD) {
      if (currentDifficulty === 'hard') {
        currentDifficulty = 'medium';
        recentWrongStreak = 0;
      } else if (currentDifficulty === 'medium') {
        currentDifficulty = 'easy';
        recentWrongStreak = 0;
      } else {
        // easy + wrong -> vẫn easy
        currentDifficulty = 'easy';
      }
    }
  }

  // Cập nhật cấp cao nhất từng chạm tới
  if (DIFFICULTY_LEVELS[currentDifficulty] > DIFFICULTY_LEVELS[highestDifficultyReached]) {
    highestDifficultyReached = currentDifficulty;
  }

  const updatedHistory = [...(difficultyHistory || [])];
  if (questionId) {
    updatedHistory.push({
      questionIndex: questionIndex ?? questionsAnswered - 1,
      questionId,
      difficulty: currentState.currentDifficulty,
      isCorrect,
    });
  }

  return {
    currentDifficulty,
    recentCorrectStreak,
    recentWrongStreak,
    questionsAnswered,
    highestDifficultyReached,
    difficultyHistory: updatedHistory,
  };
}

/**
 * Lựa chọn câu hỏi đơn lẻ hoặc nhóm câu hỏi phù hợp với targetDifficulty
 * Ưu tiên: targetDifficulty -> khoảng cách gần nhất -> anti-repeat -> PRNG seed
 * Không bao giờ phá vỡ tính nguyên khối (atomic) của Group
 */
export function selectDiagnosticItemOrGroup(params: {
  part: ToeicPart;
  targetDifficulty: ToeicDifficulty;
  seed: number | string;
  excludeQuestionIds: Set<string>;
  excludeGroupIds: Set<string>;
  recentQuestionIds?: string[];
  recentGroupIds?: string[];
  customIndex?: ToeicQuestionIndex;
}): {
  questions: ToeicQuestion[];
  group?: ToeicQuestionGroup;
} {
  const {
    part,
    targetDifficulty,
    seed,
    excludeQuestionIds,
    excludeGroupIds,
    recentQuestionIds = [],
    recentGroupIds = [],
    customIndex,
  } = params;

  const index = customIndex || toeicQuestionIndex;
  const isGroupedPart = ['part3_conv', 'part4_talks', 'part6_text', 'part7_reading'].includes(part);
  const { next: rng } = createExamRng(seed);

  const qRecencyMap = new Map<string, number>();
  recentQuestionIds.forEach((id, idx) => qRecencyMap.set(id, idx));

  const gRecencyMap = new Map<string, number>();
  recentGroupIds.forEach((id, idx) => gRecencyMap.set(id, idx));

  if (isGroupedPart) {
    // 1. Tuyển chọn group câu hỏi nguyên khối
    const availableGroups = index.getGroupsByPart(part).filter((g) => !excludeGroupIds.has(g.id));

    if (availableGroups.length === 0) {
      // Fallback: nếu đã dùng hết group chưa chọn, chấp nhận group ít gặp nhất
      const allGroups = index.getGroupsByPart(part);
      if (allGroups.length > 0) {
        const sorted = [...allGroups].sort((a, b) => {
          const distA = getDifficultyDistance(targetDifficulty, a.difficulty || 'medium');
          const distB = getDifficultyDistance(targetDifficulty, b.difficulty || 'medium');
          return distA - distB;
        });
        const chosen = sorted[0];
        const questions = chosen.questionIds
          .map((qId) => index.getQuestionById(qId))
          .filter((q): q is ToeicQuestion => !!q);
        return { questions, group: chosen };
      }
      return { questions: [] };
    }

    // Sắp xếp ứng viên group theo tiêu chí:
    // (1) Khoảng cách độ khó so với target (0: khớp tuyệt đối, 1: cận kề)
    // (2) Chống lặp (chưa gặp trong recent -> gặp lâu nhất)
    // (3) PRNG tie-breaking
    const scoredGroups = availableGroups.map((g) => {
      const gDiff = g.difficulty || 'medium';
      const distance = getDifficultyDistance(targetDifficulty, gDiff);
      const isRecent = gRecencyMap.has(g.id);
      const recencyScore = isRecent ? gRecencyMap.get(g.id)! : -1;
      const jitter = rng();

      return { group: g, distance, isRecent, recencyScore, jitter };
    });

    scoredGroups.sort((a, b) => {
      if (a.distance !== b.distance) return a.distance - b.distance;
      if (a.isRecent !== b.isRecent) return a.isRecent ? 1 : -1;
      if (a.recencyScore !== b.recencyScore) return a.recencyScore - b.recencyScore;
      return a.jitter - b.jitter;
    });

    const chosenGroup = scoredGroups[0].group;
    const questions = chosenGroup.questionIds
      .map((qId) => index.getQuestionById(qId))
      .filter((q): q is ToeicQuestion => !!q);

    return { questions, group: chosenGroup };
  } else {
    // 2. Tuyển chọn câu hỏi đơn lẻ (Part 1, 2, 5, etc.)
    const availableQuestions = index
      .getQuestionsByPart(part)
      .filter((q) => !q.groupId && !excludeQuestionIds.has(q.id));

    if (availableQuestions.length === 0) {
      // Fallback an toàn nếu bank quá ít câu
      const allStandalone = index.getQuestionsByPart(part).filter((q) => !q.groupId);
      if (allStandalone.length > 0) {
        const sorted = [...allStandalone].sort((a, b) => {
          const distA = getDifficultyDistance(targetDifficulty, a.difficulty || 'medium');
          const distB = getDifficultyDistance(targetDifficulty, b.difficulty || 'medium');
          return distA - distB;
        });
        return { questions: [sorted[0]] };
      }
      return { questions: [] };
    }

    const scoredQuestions = availableQuestions.map((q) => {
      const qDiff = q.difficulty || 'medium';
      const distance = getDifficultyDistance(targetDifficulty, qDiff);
      const isRecent = qRecencyMap.has(q.id);
      const recencyScore = isRecent ? qRecencyMap.get(q.id)! : -1;
      const jitter = rng();

      return { question: q, distance, isRecent, recencyScore, jitter };
    });

    scoredQuestions.sort((a, b) => {
      if (a.distance !== b.distance) return a.distance - b.distance;
      if (a.isRecent !== b.isRecent) return a.isRecent ? 1 : -1;
      if (a.recencyScore !== b.recencyScore) return a.recencyScore - b.recencyScore;
      return a.jitter - b.jitter;
    });

    return { questions: [scoredQuestions[0].question] };
  }
}

/**
 * Cập nhật động các câu hỏi / nhóm câu hỏi sắp tới chưa được làm theo targetDifficulty mới
 * Đảm bảo:
 * 1. KHÔNG thay đổi bất kỳ câu nào đã được trả lời (Không thay câu đã trả lời)
 * 2. KHÔNG thay đổi độ khó giữa chừng trong một Group đang làm dở (Group integrity)
 * 3. Chỉ hoán đổi các slot tương lai chưa chạm tới
 */
export function adaptUpcomingDiagnosticSlots(params: {
  currentQuestions: ToeicQuestion[];
  currentGroups: ToeicQuestionGroup[];
  userAnswers: Record<string, string>;
  activeQuestionIndex: number;
  targetDifficulty: ToeicDifficulty;
  seed: number | string;
  recentQuestionIds?: string[];
  recentGroupIds?: string[];
}): {
  questions: ToeicQuestion[];
  groups: ToeicQuestionGroup[];
  hasAdapted: boolean;
} {
  const {
    currentQuestions,
    currentGroups,
    userAnswers,
    activeQuestionIndex,
    targetDifficulty,
    seed,
    recentQuestionIds,
    recentGroupIds,
  } = params;

  // Tìm vị trí slot câu hỏi tiếp theo chưa được trả lời và không nằm trong group hiện tại
  const activeQ = currentQuestions[activeQuestionIndex];
  const activeGroupId = activeQ?.groupId;

  // Tập hợp các ID đã sử dụng (bao gồm các câu đã trả lời hoặc câu trong group hiện tại)
  const usedQuestionIds = new Set<string>();
  const usedGroupIds = new Set<string>();

  currentQuestions.forEach((q, idx) => {
    const isAnswered = !!userAnswers[q.id];
    const isCurrentGroup = activeGroupId && q.groupId === activeGroupId;
    const isPastOrCurrent = idx <= activeQuestionIndex;

    if (isAnswered || isCurrentGroup || isPastOrCurrent) {
      usedQuestionIds.add(q.id);
      if (q.groupId) usedGroupIds.add(q.groupId);
    }
  });

  let hasAdapted = false;
  const newQuestions = [...currentQuestions];
  let newGroups = [...currentGroups];

  // Duyệt qua các câu hỏi phía sau câu hiện tại
  let i = activeQuestionIndex + 1;
  while (i < newQuestions.length) {
    const q = newQuestions[i];

    // Nếu câu hỏi đã được trả lời hoặc cùng group với câu đang làm -> tuyệt đối giữ nguyên
    if (userAnswers[q.id] || (activeGroupId && q.groupId === activeGroupId)) {
      usedQuestionIds.add(q.id);
      if (q.groupId) usedGroupIds.add(q.groupId);
      i++;
      continue;
    }

    if (q.groupId) {
      // Đây là một Group chưa trả lời
      const g = currentGroups.find((grp) => grp.id === q.groupId);
      if (g) {
        const currentGDiff = g.difficulty || 'medium';
        // Nếu độ khó group chưa khớp target và có thể đổi sang group phù hợp hơn
        if (currentGDiff !== targetDifficulty) {
          const candidate = selectDiagnosticItemOrGroup({
            part: g.part,
            targetDifficulty,
            seed: `${seed}_slot_g_${g.id}_${i}`,
            excludeQuestionIds: usedQuestionIds,
            excludeGroupIds: usedGroupIds,
            recentQuestionIds,
            recentGroupIds,
          });

          if (candidate.group && candidate.questions.length === g.questionIds.length) {
            // Thay thế trọn vẹn toàn bộ câu hỏi của Group này (Atomic replacement)
            const groupStartIndex = i;
            const groupLen = g.questionIds.length;

            newQuestions.splice(groupStartIndex, groupLen, ...candidate.questions);
            newGroups = newGroups.filter((grp) => grp.id !== g.id);
            newGroups.push(candidate.group);

            candidate.questions.forEach((cq) => usedQuestionIds.add(cq.id));
            usedGroupIds.add(candidate.group.id);
            hasAdapted = true;

            i += groupLen;
            continue;
          }
        }

        // Nếu không thay đổi, bảo toàn và bỏ qua toàn bộ câu của group này
        usedGroupIds.add(g.id);
        g.questionIds.forEach((id) => usedQuestionIds.add(id));
        i += g.questionIds.length;
        continue;
      }
    } else {
      // Câu hỏi đơn lẻ (Part 1, 2, 5)
      const currentQDiff = q.difficulty || 'medium';
      if (currentQDiff !== targetDifficulty) {
        const candidate = selectDiagnosticItemOrGroup({
          part: q.part,
          targetDifficulty,
          seed: `${seed}_slot_q_${q.id}_${i}`,
          excludeQuestionIds: usedQuestionIds,
          excludeGroupIds: usedGroupIds,
          recentQuestionIds,
          recentGroupIds,
        });

        if (candidate.questions.length > 0) {
          newQuestions[i] = candidate.questions[0];
          usedQuestionIds.add(candidate.questions[0].id);
          hasAdapted = true;
        }
      }
    }

    i++;
  }

  return {
    questions: newQuestions,
    groups: newGroups,
    hasAdapted,
  };
}

/**
 * Độ tin cậy của bài khảo sát chẩn đoán (Diagnostic Confidence)
 */
export type DiagnosticConfidenceLevel = 'Low' | 'Medium' | 'High';

/**
 * Kết quả đánh giá chẩn đoán năng lực TOEIC (Diagnostic Proficiency Report)
 */
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

const PART_NAMES_MAP: Record<ToeicPart, string> = {
  part1_photos: 'Part 1: Photographs',
  part2_qna: 'Part 2: Question & Response',
  part3_conv: 'Part 3: Short Conversations',
  part4_talks: 'Part 4: Short Talks',
  part5_grammar: 'Part 5: Incomplete Sentences',
  part6_text: 'Part 6: Text Completion',
  part7_reading: 'Part 7: Reading Comprehension',
  speaking_read: 'Speaking',
  writing_email: 'Writing',
};

/**
 * Sinh báo cáo Chẩn Đoán chuyên biệt dựa 100% trên bằng chứng thực tế
 * Không bao giờ bịa đặt điểm yếu nếu người dùng chưa gặp đủ câu hỏi tương ứng
 */
export function generateDiagnosticReport(params: {
  questions: ToeicQuestion[];
  userAnswers: Record<string, string>;
  adaptiveState?: ToeicAdaptiveState;
}): ToeicDiagnosticReport {
  const { questions, userAnswers, adaptiveState } = params;

  let listeningCorrect = 0;
  let listeningTotal = 0;
  let readingCorrect = 0;
  let readingTotal = 0;
  let answeredCount = 0;

  // Thống kê theo Part
  const partStats = new Map<ToeicPart, { correct: number; total: number }>();

  // Thống kê theo Grammar Tags & Vocab Tags
  const grammarStats = new Map<string, { errors: number; total: number }>();
  const vocabStats = new Map<string, { errors: number; total: number }>();

  questions.forEach((q) => {
    const userChoice = userAnswers[q.id];
    const isAnswered = !!userChoice && userChoice.trim() !== '' && userChoice !== 'SKIPPED';
    const isCorrect = isAnswered && userChoice === q.correctAnswer;

    if (isAnswered) answeredCount++;

    if (q.skill === 'listening') {
      listeningTotal++;
      if (isCorrect) listeningCorrect++;
    } else if (q.skill === 'reading') {
      readingTotal++;
      if (isCorrect) readingCorrect++;
    }

    // Part aggregation
    if (!partStats.has(q.part)) {
      partStats.set(q.part, { correct: 0, total: 0 });
    }
    const pStat = partStats.get(q.part)!;
    pStat.total++;
    if (isCorrect) pStat.correct++;

    // Grammar tags aggregation (chỉ đếm câu đã làm)
    if (isAnswered && q.grammarTags && q.grammarTags.length > 0) {
      q.grammarTags.forEach((tag) => {
        if (!grammarStats.has(tag)) {
          grammarStats.set(tag, { errors: 0, total: 0 });
        }
        const gStat = grammarStats.get(tag)!;
        gStat.total++;
        if (!isCorrect) gStat.errors++;
      });
    }

    // Vocabulary tags aggregation (chỉ đếm câu đã làm)
    if (isAnswered && q.vocabularyTags && q.vocabularyTags.length > 0) {
      q.vocabularyTags.forEach((tag) => {
        if (!vocabStats.has(tag)) {
          vocabStats.set(tag, { errors: 0, total: 0 });
        }
        const vStat = vocabStats.get(tag)!;
        vStat.total++;
        if (!isCorrect) vStat.errors++;
      });
    }
  });

  const listeningAcc = listeningTotal > 0 ? Math.round((listeningCorrect / listeningTotal) * 100) : 0;
  const readingAcc = readingTotal > 0 ? Math.round((readingCorrect / readingTotal) * 100) : 0;

  // Tính điểm ước lượng trung tâm (Estimated Center)
  // Base Listening: 5 - 495
  const baseL = Math.round((listeningAcc / 100) * 440) + 55;
  // Base Reading: 5 - 495
  const baseR = Math.round((readingAcc / 100) * 440) + 55;

  // Hiệu chỉnh độ khó thích ứng (CAT bonus / penalty)
  const highestDiff = adaptiveState?.highestDifficultyReached || 'medium';
  let catBonus = 0;
  if (highestDiff === 'hard') catBonus += 30;
  if (highestDiff === 'easy') catBonus -= 30;

  const centerScore = Math.max(20, Math.min(980, baseL + baseR + catBonus));

  // Dải điểm: +/- 50 điểm
  const minScore = Math.max(10, Math.round((centerScore - 50) / 10) * 10);
  const maxScore = Math.min(990, Math.round((centerScore + 50) / 10) * 10);
  const displayRange = `${minScore} – ${maxScore}`;

  // Listening Sub-Range
  const minL = Math.max(5, Math.round((baseL - 30) / 5) * 5);
  const maxL = Math.min(495, Math.round((baseL + 30) / 5) * 5);

  // Reading Sub-Range
  const minR = Math.max(5, Math.round((baseR - 30) / 5) * 5);
  const maxR = Math.min(495, Math.round((baseR + 30) / 5) * 5);

  // Quy chuẩn trình độ tương đương
  let proficiency = 'Sơ cấp (Beginner - CEFR A1/A2)';
  if (centerScore >= 785) proficiency = 'Cao cấp (Advanced - CEFR C1)';
  else if (centerScore >= 550) proficiency = 'Trung cấp (Intermediate - CEFR B2)';
  else if (centerScore >= 350) proficiency = 'Sơ trung cấp (Pre-Intermediate - CEFR B1)';

  // Độ tin cậy (Confidence) dựa trên deterministic rules
  let confidence: DiagnosticConfidenceLevel = 'Medium';
  let confidenceReason = 'Đã hoàn thành phần lớn câu hỏi khảo sát chẩn đoán.';

  if (answeredCount < 6) {
    confidence = 'Low';
    confidenceReason = 'Số lượng câu trả lời quá ít (< 6 câu), chưa đủ bằng chứng để ước lượng chắc chắn.';
  } else if (answeredCount >= 9 && listeningTotal >= 4 && readingTotal >= 4) {
    confidence = 'High';
    confidenceReason = 'Hoàn thành trọn vẹn cả 2 kỹ năng Nghe & Đọc theo chuẩn phân tầng thích ứng.';
  }

  // Strongest / Weakest Parts (Chỉ từ evidence thật)
  const partPerformanceList = Array.from(partStats.entries())
    .filter(([_, stat]) => stat.total > 0)
    .map(([part, stat]) => ({
      part,
      name: PART_NAMES_MAP[part] || part,
      accuracy: Math.round((stat.correct / stat.total) * 100),
      correct: stat.correct,
      total: stat.total,
    }));

  const strongestParts = partPerformanceList
    .filter((p) => p.accuracy >= 60)
    .sort((a, b) => b.accuracy - a.accuracy)
    .slice(0, 3);

  const weakestParts = partPerformanceList
    .filter((p) => p.accuracy < 100)
    .sort((a, b) => a.accuracy - b.accuracy)
    .slice(0, 3);

  // Điểm yếu Ngữ Pháp (Chỉ ghi nhận khi có câu sai thực tế, tuyệt đối không bịa synthetic weakness)
  const grammarWeaknesses = Array.from(grammarStats.entries())
    .filter(([_, stat]) => stat.errors > 0 && stat.total > 0)
    .map(([tag, stat]) => ({
      tag,
      errorCount: stat.errors,
      testedCount: stat.total,
      accuracy: Math.round(((stat.total - stat.errors) / stat.total) * 100),
      description: `Sai ${stat.errors}/${stat.total} câu liên quan đến chủ điểm "${tag}"`,
    }))
    .sort((a, b) => b.errorCount - a.errorCount);

  // Điểm yếu Từ Vựng (Chỉ ghi nhận khi có câu sai thực tế)
  const vocabularyWeaknesses = Array.from(vocabStats.entries())
    .filter(([_, stat]) => stat.errors > 0 && stat.total > 0)
    .map(([tag, stat]) => ({
      tag,
      errorCount: stat.errors,
      testedCount: stat.total,
      accuracy: Math.round(((stat.total - stat.errors) / stat.total) * 100),
      description: `Gặp khó khăn ở ${stat.errors}/${stat.total} từ vựng thuộc nhóm "${tag}"`,
    }))
    .sort((a, b) => b.errorCount - a.errorCount);

  // Lộ trình khuyến nghị tiếp theo
  let recommendedNextStep = 'Tiếp tục luyện tập ở chế độ Practice để làm quen với toàn bộ 7 Part.';
  if (grammarWeaknesses.length > 0 && readingAcc < 60) {
    recommendedNextStep = `Tập trung củng cố ngữ pháp Part 5 & 6, đặc biệt là chủ điểm "${grammarWeaknesses[0].tag}".`;
  } else if (listeningAcc < readingAcc) {
    recommendedNextStep = 'Luyện nghe phản xạ Part 2 & Part 3 trong phòng Nghe (Listening Lab) và shadowing các đoạn hội thoại.';
  } else if (centerScore >= 700) {
    recommendedNextStep = 'Bạn đã có nền tảng vững vàng, nên thử sức với chế độ Thi Thử Chuẩn (Mock Test) 4 Kỹ Năng để kiểm tra tốc độ làm bài.';
  }

  return {
    isDiagnostic: true,
    estimatedToeicRange: {
      min: minScore,
      max: maxScore,
      display: displayRange,
    },
    estimatedProficiency: proficiency,
    confidence,
    confidenceReason,
    listeningStrength: {
      scoreEstimate: baseL,
      rangeDisplay: `${minL} – ${maxL}`,
      correctCount: listeningCorrect,
      totalCount: listeningTotal,
      accuracyPercent: listeningAcc,
      level: listeningAcc >= 80 ? 'Tốt' : listeningAcc >= 50 ? 'Khá' : 'Cần rèn luyện thêm',
    },
    readingStrength: {
      scoreEstimate: baseR,
      rangeDisplay: `${minR} – ${maxR}`,
      correctCount: readingCorrect,
      totalCount: readingTotal,
      accuracyPercent: readingAcc,
      level: readingAcc >= 80 ? 'Tốt' : readingAcc >= 50 ? 'Khá' : 'Cần rèn luyện thêm',
    },
    strongestParts,
    weakestParts,
    grammarWeaknesses,
    vocabularyWeaknesses,
    adaptiveProgression: {
      startDifficulty: 'medium',
      finalDifficulty: adaptiveState?.currentDifficulty || 'medium',
      highestDifficultyReached: highestDiff,
      questionsAnswered: answeredCount,
    },
    recommendedNextStep,
  };
}
