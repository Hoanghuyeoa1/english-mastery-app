// src/services/toeicAttemptAnalytics.ts
import {
  ToeicQuestion,
  ToeicPart,
  ToeicSkill,
  ToeicDifficulty,
  ToeicExperienceMode,
  ToeicSkillScope,
  ToeicAttemptAnalytics,
  ToeicOverallAnalytics,
  ToeicSkillAnalytics,
  ToeicSkillAnalyticsObjective,
  ToeicSkillAnalyticsOpenEnded,
  ToeicPartAnalytics,
  ToeicSubSkillAnalytics,
  ToeicDifficultyAnalytics,
  ToeicExperienceSemantics,
} from '../types/toeic';
import { ToeicScoreEvaluation } from './toeicScoring';

export interface ToeicAttemptAnalyticsInput {
  attemptId: string;
  experienceMode: ToeicExperienceMode;
  skillScope: ToeicSkillScope;
  completedAt?: number;
  questions?: ToeicQuestion[];
  userAnswers?: Record<string, string>;
  firstAttemptAnswers?: Record<string, string>;
  timeSpentSeconds?: number;
  durationMinutes?: number;
  scoreEvaluation?: ToeicScoreEvaluation;
  speakingTranscript?: string;
  writingText?: string;
}

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

const DIFFICULTY_NUMERIC_MAP: Record<ToeicDifficulty, number> = {
  easy: 1,
  medium: 2,
  hard: 3,
};

function isObjectiveQuestion(q: ToeicQuestion): boolean {
  return q.skill === 'listening' || q.skill === 'reading' || Boolean(q.correctAnswer);
}

function countWords(text?: string): number {
  if (!text) return 0;
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/**
 * Pure function: Tạo analytics snapshot toàn diện cho một bài thi TOEIC đã hoàn thành.
 * Tuyệt đối không sinh NaN, Infinity hay division by zero.
 * Tuyệt đối không giả mạo accuracy cho các kỹ năng tự luận mở Speaking / Writing.
 */
export function buildToeicAttemptAnalytics(input: ToeicAttemptAnalyticsInput): ToeicAttemptAnalytics {
  const {
    attemptId,
    experienceMode,
    skillScope,
    completedAt = Date.now(),
    questions = [],
    userAnswers = {},
    firstAttemptAnswers,
    timeSpentSeconds = 0,
    durationMinutes = 15,
    scoreEvaluation,
    speakingTranscript = '',
    writingText = '',
  } = input;

  // Single Source of Truth cho bằng chứng khách quan:
  // Trong Practice mode hoặc khi có firstAttemptAnswers, đánh giá luôn dùng first attempt
  const hasFirstAttempt = Boolean(firstAttemptAnswers && Object.keys(firstAttemptAnswers).length > 0);
  const authoritativeAnswers = hasFirstAttempt ? firstAttemptAnswers! : userAnswers;

  // 1. Phân loại câu hỏi
  const objectiveQuestions: ToeicQuestion[] = [];
  const openEndedQuestions: ToeicQuestion[] = [];

  questions.forEach((q) => {
    if (isObjectiveQuestion(q)) {
      objectiveQuestions.push(q);
    } else {
      openEndedQuestions.push(q);
    }
  });

  // 2. Thống kê cấp độ toàn cục (Overall)
  let totalAttempted = 0;
  let totalUnanswered = 0;
  let objectiveCorrect = 0;
  let objectiveIncorrect = 0;

  questions.forEach((q) => {
    const isObj = isObjectiveQuestion(q);
    if (isObj) {
      const ans = authoritativeAnswers[q.id];
      const hasAnswered = typeof ans === 'string' && ans.trim() !== '' && ans !== 'SKIPPED';
      if (hasAnswered) {
        totalAttempted++;
        if (q.correctAnswer && ans === q.correctAnswer) {
          objectiveCorrect++;
        } else {
          objectiveIncorrect++;
        }
      } else {
        totalUnanswered++;
      }
    } else {
      // Open-ended (speaking / writing)
      if (q.skill === 'speaking') {
        const words = countWords(speakingTranscript);
        if (words > 0 && speakingTranscript.trim() !== 'SKIPPED') {
          totalAttempted++;
        } else {
          totalUnanswered++;
        }
      } else if (q.skill === 'writing') {
        const words = countWords(writingText);
        if (words > 0 && writingText.trim() !== 'SKIPPED') {
          totalAttempted++;
        } else {
          totalUnanswered++;
        }
      } else {
        totalUnanswered++;
      }
    }
  });

  const objectiveCount = objectiveQuestions.length;
  const openEndedCount = openEndedQuestions.length;
  const totalItems = questions.length;

  const overallAccuracy = objectiveCount > 0
    ? Math.round((objectiveCorrect / objectiveCount) * 100)
    : 0;

  const completionRate = totalItems > 0
    ? Math.round((totalAttempted / totalItems) * 100)
    : 0;

  const durationSeconds = Math.max(0, durationMinutes * 60);

  const overall: ToeicOverallAnalytics = {
    totalItems,
    objectiveCount,
    openEndedCount,
    attemptedCount: totalAttempted,
    unansweredCount: totalUnanswered,
    correctCount: objectiveCorrect,
    incorrectCount: objectiveIncorrect,
    accuracy: overallAccuracy,
    scaledScoreLR: scoreEvaluation?.totalScore,
    scaledScoreSW: scoreEvaluation?.totalSWScore,
    listeningScore: scoreEvaluation?.listeningScore,
    readingScore: scoreEvaluation?.readingScore,
    speakingScore: scoreEvaluation?.speakingScore,
    writingScore: scoreEvaluation?.writingScore,
    totalScore: scoreEvaluation?.totalScore,
    durationSeconds,
    timeSpentSeconds: Math.max(0, timeSpentSeconds),
    completionRate,
  };

  // 3. Phân tích theo từng Kỹ Năng (bySkill)
  // Listening
  const listeningQs = questions.filter((q) => q.skill === 'listening');
  let listeningAttempted = 0;
  let listeningCorrect = 0;
  let listeningIncorrect = 0;
  let listeningUnanswered = 0;

  listeningQs.forEach((q) => {
    const ans = authoritativeAnswers[q.id];
    const hasAns = typeof ans === 'string' && ans.trim() !== '' && ans !== 'SKIPPED';
    if (hasAns) {
      listeningAttempted++;
      if (q.correctAnswer && ans === q.correctAnswer) {
        listeningCorrect++;
      } else {
        listeningIncorrect++;
      }
    } else {
      listeningUnanswered++;
    }
  });

  const listeningAnalytics: ToeicSkillAnalyticsObjective = {
    skill: 'listening',
    isObjective: true,
    questionsSeen: listeningQs.length,
    attempted: listeningAttempted,
    correct: listeningCorrect,
    incorrect: listeningIncorrect,
    unanswered: listeningUnanswered,
    accuracy: listeningQs.length > 0 ? Math.round((listeningCorrect / listeningQs.length) * 100) : 0,
    evidenceCount: listeningQs.length,
    scaledScore: scoreEvaluation?.listeningScore,
  };

  // Reading
  const readingQs = questions.filter((q) => q.skill === 'reading');
  let readingAttempted = 0;
  let readingCorrect = 0;
  let readingIncorrect = 0;
  let readingUnanswered = 0;

  readingQs.forEach((q) => {
    const ans = authoritativeAnswers[q.id];
    const hasAns = typeof ans === 'string' && ans.trim() !== '' && ans !== 'SKIPPED';
    if (hasAns) {
      readingAttempted++;
      if (q.correctAnswer && ans === q.correctAnswer) {
        readingCorrect++;
      } else {
        readingIncorrect++;
      }
    } else {
      readingUnanswered++;
    }
  });

  const readingAnalytics: ToeicSkillAnalyticsObjective = {
    skill: 'reading',
    isObjective: true,
    questionsSeen: readingQs.length,
    attempted: readingAttempted,
    correct: readingCorrect,
    incorrect: readingIncorrect,
    unanswered: readingUnanswered,
    accuracy: readingQs.length > 0 ? Math.round((readingCorrect / readingQs.length) * 100) : 0,
    evidenceCount: readingQs.length,
    scaledScore: scoreEvaluation?.readingScore,
  };

  // Speaking (Open-ended)
  const speakingQs = questions.filter((q) => q.skill === 'speaking');
  const speakingWordCount = countWords(speakingTranscript);
  const speakingHasEvidence = speakingWordCount > 0 && speakingTranscript.trim() !== 'SKIPPED';
  const speakingRubric = scoreEvaluation?.speakingEvaluation
    ? {
        pronunciationScore: scoreEvaluation.speakingEvaluation.pronunciationScore,
        fluencyScore: scoreEvaluation.speakingEvaluation.fluencyScore,
        contentScore: scoreEvaluation.speakingEvaluation.contentScore,
      }
    : undefined;

  const speakingAnalytics: ToeicSkillAnalyticsOpenEnded = {
    skill: 'speaking',
    isObjective: false,
    questionsSeen: speakingQs.length,
    hasEvidence: speakingHasEvidence,
    evidenceCount: speakingQs.length,
    score: scoreEvaluation?.speakingScore,
    wordCount: speakingWordCount,
    rubricScores: speakingRubric,
    feedback: scoreEvaluation?.speakingFeedback,
    accuracy: null, // Không bao giờ giả accuracy
  };

  // Writing (Open-ended)
  const writingQs = questions.filter((q) => q.skill === 'writing');
  const writingWordCount = countWords(writingText);
  const writingHasEvidence = writingWordCount > 0 && writingText.trim() !== 'SKIPPED';
  const writingRubric = scoreEvaluation?.writingEvaluation
    ? {
        grammarScore: scoreEvaluation.writingEvaluation.grammarScore,
        organizationScore: scoreEvaluation.writingEvaluation.organizationScore,
        vocabularyScore: scoreEvaluation.writingEvaluation.vocabularyScore,
      }
    : undefined;

  const writingAnalytics: ToeicSkillAnalyticsOpenEnded = {
    skill: 'writing',
    isObjective: false,
    questionsSeen: writingQs.length,
    hasEvidence: writingHasEvidence,
    evidenceCount: writingQs.length,
    score: scoreEvaluation?.writingScore,
    wordCount: writingWordCount,
    rubricScores: writingRubric,
    feedback: scoreEvaluation?.writingFeedback,
    accuracy: null, // Không bao giờ giả accuracy
  };

  const bySkill: ToeicAttemptAnalytics['bySkill'] = {
    listening: listeningAnalytics,
    reading: readingAnalytics,
    speaking: speakingAnalytics,
    writing: writingAnalytics,
  };

  // 4. Phân tích chi tiết từng Part (byPart)
  const byPart: Partial<Record<ToeicPart, ToeicPartAnalytics>> = {};

  // Gom câu hỏi theo từng part
  const partGroupMap = new Map<ToeicPart, ToeicQuestion[]>();
  questions.forEach((q) => {
    if (!partGroupMap.has(q.part)) {
      partGroupMap.set(q.part, []);
    }
    partGroupMap.get(q.part)!.push(q);
  });

  partGroupMap.forEach((pQuestions, part) => {
    const isObj = pQuestions.some(isObjectiveQuestion);
    let attempted = 0;
    let correct = 0;
    let incorrect = 0;
    let unanswered = 0;
    let diffNumericSum = 0;
    let estDiffSum = 0;
    let estDiffCount = 0;

    const diffDist: Record<ToeicDifficulty, number> = { easy: 0, medium: 0, hard: 0 };

    pQuestions.forEach((q) => {
      const diff: ToeicDifficulty = q.difficulty || 'medium';
      diffDist[diff]++;
      diffNumericSum += DIFFICULTY_NUMERIC_MAP[diff] || 2;

      if (typeof q.estimatedDifficulty === 'number') {
        estDiffSum += q.estimatedDifficulty;
        estDiffCount++;
      }

      if (isObj) {
        const ans = authoritativeAnswers[q.id];
        const hasAns = typeof ans === 'string' && ans.trim() !== '' && ans !== 'SKIPPED';
        if (hasAns) {
          attempted++;
          if (q.correctAnswer && ans === q.correctAnswer) {
            correct++;
          } else {
            incorrect++;
          }
        } else {
          unanswered++;
        }
      }
    });

    const questionsSeen = pQuestions.length;
    const averageDifficultyLevel = questionsSeen > 0
      ? Number((diffNumericSum / questionsSeen).toFixed(2))
      : 0;
    const averageEstimatedDifficulty = estDiffCount > 0
      ? Math.round(estDiffSum / estDiffCount)
      : 0;

    const accuracy = isObj
      ? (questionsSeen > 0 ? Math.round((correct / questionsSeen) * 100) : 0)
      : null;

    byPart[part] = {
      part,
      partName: PART_NAMES[part] || part,
      skill: pQuestions[0]?.skill || 'listening',
      isObjective: isObj,
      questionsSeen,
      attempted,
      correct,
      incorrect,
      unanswered,
      accuracy,
      averageDifficultyLevel,
      averageEstimatedDifficulty,
      difficultyDistribution: diffDist,
    };
  });

  // 5. Phân tích Sub-Skill (bySubSkill) - Derive trực tiếp từ Question Bank metadata
  const bySubSkill: Record<string, ToeicSubSkillAnalytics> = {};
  const subSkillMap = new Map<string, ToeicQuestion[]>();

  questions.forEach((q) => {
    const subSkillKey = q.subSkill ? q.subSkill.trim().toLowerCase() : 'general_comprehension';
    if (!subSkillMap.has(subSkillKey)) {
      subSkillMap.set(subSkillKey, []);
    }
    subSkillMap.get(subSkillKey)!.push(q);
  });

  subSkillMap.forEach((subQuestions, subKey) => {
    const isObj = subQuestions.some(isObjectiveQuestion);
    let attempted = 0;
    let correct = 0;
    let incorrect = 0;
    let unanswered = 0;
    const qTypesSet = new Set<string>();

    subQuestions.forEach((q) => {
      if (q.questionType) qTypesSet.add(q.questionType);
      if (isObj) {
        const ans = authoritativeAnswers[q.id];
        const hasAns = typeof ans === 'string' && ans.trim() !== '' && ans !== 'SKIPPED';
        if (hasAns) {
          attempted++;
          if (q.correctAnswer && ans === q.correctAnswer) {
            correct++;
          } else {
            incorrect++;
          }
        } else {
          unanswered++;
        }
      }
    });

    const questionsSeen = subQuestions.length;
    const accuracy = isObj
      ? (questionsSeen > 0 ? Math.round((correct / questionsSeen) * 100) : 0)
      : null;

    bySubSkill[subKey] = {
      subSkill: subKey,
      skill: subQuestions[0]?.skill || 'listening',
      isObjective: isObj,
      questionsSeen,
      attempted,
      correct,
      incorrect,
      unanswered,
      accuracy,
      evidenceCount: questionsSeen,
      questionTypes: Array.from(qTypesSet),
    };
  });

  // 6. Phân tích Độ Khó (byDifficulty)
  const diffLevels: ToeicDifficulty[] = ['easy', 'medium', 'hard'];
  const byDifficulty: Record<ToeicDifficulty, ToeicDifficultyAnalytics> = {
    easy: {
      difficulty: 'easy',
      difficultyLevel: 1,
      questionsSeen: 0,
      attempted: 0,
      correct: 0,
      incorrect: 0,
      unanswered: 0,
      accuracy: 0,
    },
    medium: {
      difficulty: 'medium',
      difficultyLevel: 2,
      questionsSeen: 0,
      attempted: 0,
      correct: 0,
      incorrect: 0,
      unanswered: 0,
      accuracy: 0,
    },
    hard: {
      difficulty: 'hard',
      difficultyLevel: 3,
      questionsSeen: 0,
      attempted: 0,
      correct: 0,
      incorrect: 0,
      unanswered: 0,
      accuracy: 0,
    },
  };

  questions.forEach((q) => {
    const diff: ToeicDifficulty = q.difficulty || 'medium';
    const target = byDifficulty[diff] || byDifficulty.medium;
    target.questionsSeen++;

    if (isObjectiveQuestion(q)) {
      const ans = authoritativeAnswers[q.id];
      const hasAns = typeof ans === 'string' && ans.trim() !== '' && ans !== 'SKIPPED';
      if (hasAns) {
        target.attempted++;
        if (q.correctAnswer && ans === q.correctAnswer) {
          target.correct++;
        } else {
          target.incorrect++;
        }
      } else {
        target.unanswered++;
      }
    }
  });

  diffLevels.forEach((level) => {
    const item = byDifficulty[level];
    item.accuracy = item.questionsSeen > 0
      ? Math.round((item.correct / item.questionsSeen) * 100)
      : 0;
  });

  // 7. Experience Semantics
  let evidenceSource: ToeicExperienceSemantics['evidenceSource'] = 'strict_exam';
  if (experienceMode === 'diagnostic') {
    evidenceSource = 'estimate_adaptive';
  } else if (experienceMode === 'practice') {
    evidenceSource = 'first_attempt_learning';
  }

  // Đo đếm Retry trong Practice
  let practiceRetriesPerformed = 0;
  let practiceRetriesCorrect = 0;
  if (hasFirstAttempt) {
    questions.forEach((q) => {
      const firstAns = firstAttemptAnswers![q.id];
      const finalAns = userAnswers[q.id];
      if (finalAns && finalAns !== firstAns) {
        practiceRetriesPerformed++;
        if (q.correctAnswer && finalAns === q.correctAnswer && firstAns !== q.correctAnswer) {
          practiceRetriesCorrect++;
        }
      }
    });
  }

  const experienceSemantics: ToeicExperienceSemantics = {
    experienceMode,
    evidenceSource,
    isFirstAttemptEvidence: hasFirstAttempt || experienceMode === 'practice',
    diagnosticConfidence: scoreEvaluation?.diagnosticReport?.confidence,
    estimatedToeicRange: scoreEvaluation?.diagnosticReport?.estimatedToeicRange,
    practiceRetriesPerformed: hasFirstAttempt ? practiceRetriesPerformed : undefined,
    practiceRetriesCorrect: hasFirstAttempt ? practiceRetriesCorrect : undefined,
  };

  return {
    attemptId,
    experienceMode,
    skillScope,
    completedAt,
    overall,
    bySkill,
    byPart,
    bySubSkill,
    byDifficulty,
    experienceSemantics,
  };
}
