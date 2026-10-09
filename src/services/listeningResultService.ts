import type { ListeningLesson } from '../data/fourSkills/types';

export type ListeningAttemptState = 'in-progress' | 'completed' | 'reviewing';

export type ListeningPerformanceLevel = 'Excellent' | 'Good' | 'Needs Practice';

export interface QuestionBreakdown {
  id: string;
  questionIndex: number;
  questionText: string;
  type?: string;
  selectedOptionIndex: number | undefined;
  selectedOptionText: string | null;
  correctOptionIndex: number;
  correctOptionText: string;
  options: string[];
  isCorrect: boolean;
  explanation: string;
}

export interface ListeningFeedbackModel {
  title: string;
  message: string;
  actionHint: string;
}

export interface ListeningResultModel {
  correctCount: number;
  incorrectCount: number;
  totalQuestions: number;
  accuracy: number; // 0 - 100 integer
  score: number; // 0 - 100 integer
  lessonTitle: string;
  cefrLevel: string;
  classification: ListeningPerformanceLevel;
  feedback: ListeningFeedbackModel;
  wrongQuestionIndexes: number[];
  questionBreakdowns: QuestionBreakdown[];
}

/**
 * Deterministically classifies performance based on accuracy percentage:
 * - 90–100% -> Excellent
 * - 75–89%  -> Good
 * - <75%    -> Needs Practice
 */
export function getListeningClassification(accuracy: number): ListeningPerformanceLevel {
  if (typeof accuracy !== 'number' || isNaN(accuracy) || accuracy < 0) {
    return 'Needs Practice';
  }
  if (accuracy >= 90) return 'Excellent';
  if (accuracy >= 75) return 'Good';
  return 'Needs Practice';
}

/**
 * Deterministically derives rule-based feedback without calling any external LLM/Gemini API:
 * - 90–100%: Excellent listening comprehension
 * - 75–89%:  Good work. Review the questions you missed
 * - <75%:    Review the transcript and replay difficult sections
 */
export function getListeningFeedback(accuracy: number): ListeningFeedbackModel {
  if (typeof accuracy !== 'number' || isNaN(accuracy) || accuracy < 0) {
    return {
      title: 'Cần Luyện Tập Thêm (Needs Practice)',
      message: 'Hãy nghe lại bài nghe và xem kỹ phần giải thích chi tiết của từng câu hỏi để nắm bắt từ khóa.',
      actionHint: 'Nên nghe lại transcript và tập trung vào các đoạn hội thoại có tốc độ nhanh.',
    };
  }
  if (accuracy >= 90) {
    return {
      title: 'Khả Năng Nghe Hiểu Xuất Sắc! (Excellent Comprehension)',
      message: 'Bạn đã nắm bắt trọn vẹn cả ý chính lẫn các chi tiết quan trọng và cấu trúc từ vựng trong bài nghe.',
      actionHint: 'Rất ấn tượng! Bạn đã sẵn sàng để thử sức với các bài nghe ở cấp độ CEFR cao hơn.',
    };
  }
  if (accuracy >= 75) {
    return {
      title: 'Làm Bài Rất Tốt! (Good Work)',
      message: 'Bạn hiểu rất tốt nội dung chính của bài nghe. Hãy rà soát lại các câu chưa chính xác để củng cố ngữ cảnh và từ vựng.',
      actionHint: 'Xem phần câu hỏi cần ôn tập bên dưới để nắm rõ các điểm thông tin bị bỏ sót.',
    };
  }
  return {
    title: 'Cần Luyện Tập Thêm (Needs Practice)',
    message: 'Nội dung bài nghe có một số phân đoạn phức tạp hoặc từ vựng mới khiến bạn chưa bắt kịp tốc độ.',
    actionHint: 'Hãy nghe lại transcript và chú ý các phân đoạn hội thoại tương ứng với câu trả lời đúng.',
  };
}

/**
 * Pure calculation function deriving ListeningResultModel from lesson and answers.
 * Zero-crash safety: strictly guards against null/undefined lesson, 0 questions, NaN,
 * negative numbers, and missing explanations.
 */
export function calculateListeningResult(
  lesson: ListeningLesson | null | undefined,
  answers: Record<string, number> = {}
): ListeningResultModel {
  const safeTitle = lesson?.title || '';
  const safeLevel = lesson?.level || 'A1';

  if (!lesson || !Array.isArray(lesson.questions) || lesson.questions.length === 0) {
    return {
      correctCount: 0,
      incorrectCount: 0,
      totalQuestions: 0,
      accuracy: 0,
      score: 0,
      lessonTitle: safeTitle,
      cefrLevel: safeLevel,
      classification: 'Needs Practice',
      feedback: getListeningFeedback(0),
      wrongQuestionIndexes: [],
      questionBreakdowns: [],
    };
  }

  const totalQuestions = lesson.questions.length;
  let correctCount = 0;
  const wrongQuestionIndexes: number[] = [];
  const questionBreakdowns: QuestionBreakdown[] = [];

  lesson.questions.forEach((q, idx) => {
    const selectedOptIdx = answers[q.id];
    const isCorrect = typeof selectedOptIdx === 'number' && selectedOptIdx === q.correctIndex;
    const options = Array.isArray(q.options) ? [...q.options] : [];
    const selectedOptionText = typeof selectedOptIdx === 'number' && options[selectedOptIdx] ? options[selectedOptIdx] : null;
    const correctOptionText = options[q.correctIndex] || '';

    if (isCorrect) {
      correctCount++;
    } else {
      wrongQuestionIndexes.push(idx);
    }

    const safeExplanation =
      typeof q.explanation === 'string' && q.explanation.trim().length > 0
        ? q.explanation.trim()
        : 'Không có giải thích chi tiết cho câu hỏi này.';

    questionBreakdowns.push({
      id: q.id,
      questionIndex: idx,
      questionText: q.question || '',
      type: q.type,
      selectedOptionIndex: selectedOptIdx,
      selectedOptionText,
      correctOptionIndex: q.correctIndex,
      correctOptionText,
      options,
      isCorrect,
      explanation: safeExplanation,
    });
  });

  const incorrectCount = totalQuestions - correctCount;
  const rawPct = totalQuestions > 0 ? (correctCount / totalQuestions) * 100 : 0;
  const accuracy = Math.max(0, Math.min(100, Math.round(rawPct)));
  const score = accuracy;
  const classification = getListeningClassification(accuracy);
  const feedback = getListeningFeedback(accuracy);

  return {
    correctCount,
    incorrectCount,
    totalQuestions,
    accuracy,
    score,
    lessonTitle: safeTitle,
    cefrLevel: safeLevel,
    classification,
    feedback,
    wrongQuestionIndexes,
    questionBreakdowns,
  };
}
