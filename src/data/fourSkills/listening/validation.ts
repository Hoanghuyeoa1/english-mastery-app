import { ListeningLesson } from '../types';
import { CEFRLevel } from '../../../types';
import { resolveListeningQuestionTarget } from '../../../services/adaptiveMistakeService';

export const VALID_CEFR_LEVELS: readonly CEFRLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const;

export interface ValidationIssue {
  lessonId: string;
  questionId?: string;
  field: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationIssue[];
}

/**
 * Validates a dataset of ListeningLessons against strict pedagogical and architectural invariants.
 */
export function validateListeningDataset(lessons: readonly ListeningLesson[]): ValidationResult {
  const errors: ValidationIssue[] = [];
  const seenLessonIds = new Set<string>();
  const seenQuestionIds = new Set<string>();

  for (let lIdx = 0; lIdx < lessons.length; lIdx++) {
    const lesson = lessons[lIdx];
    const lessonId = lesson.id?.trim() || `[index_${lIdx}]`;

    // 1. Duplicate lesson IDs / empty lesson ID
    if (!lesson.id || !lesson.id.trim()) {
      errors.push({
        lessonId,
        field: 'id',
        message: `Bài nghe tại vị trí ${lIdx} có ID rỗng.`,
      });
    } else if (seenLessonIds.has(lesson.id.trim())) {
      errors.push({
        lessonId,
        field: 'id',
        message: `Trùng lặp ID bài nghe: "${lesson.id}".`,
      });
    } else {
      seenLessonIds.add(lesson.id.trim());
    }

    // 2. CEFR level valid
    if (!VALID_CEFR_LEVELS.includes(lesson.level)) {
      errors.push({
        lessonId,
        field: 'level',
        message: `Cấp độ CEFR "${lesson.level}" không hợp lệ. Phải là một trong: ${VALID_CEFR_LEVELS.join(', ')}.`,
      });
    }

    // 3. AudioText rỗng
    if (!lesson.audioText || !lesson.audioText.trim()) {
      errors.push({
        lessonId,
        field: 'audioText',
        message: 'audioText rỗng hoặc chỉ chứa khoảng trắng.',
      });
    }

    // 4. Transcript / Sentences rỗng
    if (!Array.isArray(lesson.sentences) || lesson.sentences.length === 0) {
      errors.push({
        lessonId,
        field: 'sentences',
        message: 'Transcript sentences rỗng (phải có ít nhất 1 câu).',
      });
    } else {
      lesson.sentences.forEach((sent, sIdx) => {
        if (!sent.en || !sent.en.trim()) {
          errors.push({
            lessonId,
            field: `sentences[${sIdx}].en`,
            message: `Câu tiếng Anh tại vị trí ${sIdx} bị rỗng.`,
          });
        }
        if (!sent.vi || !sent.vi.trim()) {
          errors.push({
            lessonId,
            field: `sentences[${sIdx}].vi`,
            message: `Câu dịch tiếng Việt tại vị trí ${sIdx} bị rỗng.`,
          });
        }
      });
    }

    // 5. Lesson không có questions
    if (!Array.isArray(lesson.questions) || lesson.questions.length === 0) {
      errors.push({
        lessonId,
        field: 'questions',
        message: 'Bài nghe không có câu hỏi kiểm tra nào (questions rỗng).',
      });
    } else {
      for (let qIdx = 0; qIdx < lesson.questions.length; qIdx++) {
        const q = lesson.questions[qIdx];
        const questionId = q.id?.trim() || `[q_index_${qIdx}]`;

        // Duplicate question IDs
        if (!q.id || !q.id.trim()) {
          errors.push({
            lessonId,
            questionId,
            field: 'questions.id',
            message: `Câu hỏi tại vị trí ${qIdx} có ID rỗng.`,
          });
        } else if (seenQuestionIds.has(q.id.trim())) {
          errors.push({
            lessonId,
            questionId,
            field: 'questions.id',
            message: `Trùng lặp ID câu hỏi: "${q.id}".`,
          });
        } else {
          seenQuestionIds.add(q.id.trim());
        }

        // Question text
        if (!q.question || !q.question.trim()) {
          errors.push({
            lessonId,
            questionId,
            field: 'questions.question',
            message: 'Nội dung câu hỏi rỗng.',
          });
        }

        // Question options
        if (!Array.isArray(q.options) || q.options.length < 2) {
          errors.push({
            lessonId,
            questionId,
            field: 'questions.options',
            message: `Câu hỏi phải có ít nhất 2 options (hiện có ${q.options?.length || 0}).`,
          });
        } else {
          // Duplicate options
          const trimmedOptions = q.options.map((opt) => (opt || '').trim());
          const uniqueOptions = new Set(trimmedOptions);
          if (uniqueOptions.size !== q.options.length) {
            errors.push({
              lessonId,
              questionId,
              field: 'questions.options',
              message: 'Tồn tại các lựa chọn options trùng lặp trong cùng một câu hỏi.',
            });
          }

          // Options non-empty
          if (trimmedOptions.some((opt) => opt.length === 0)) {
            errors.push({
              lessonId,
              questionId,
              field: 'questions.options',
              message: 'Có ít nhất một option bị rỗng trong câu hỏi.',
            });
          }

          // correctIndex ngoài phạm vi
          if (
            typeof q.correctIndex !== 'number' ||
            q.correctIndex < 0 ||
            q.correctIndex >= q.options.length
          ) {
            errors.push({
              lessonId,
              questionId,
              field: 'questions.correctIndex',
              message: `correctIndex ${q.correctIndex} nằm ngoài phạm vi options [0..${q.options.length - 1}].`,
            });
          } else {
            // Missing correct answer content
            const correctOpt = q.options[q.correctIndex];
            if (!correctOpt || !correctOpt.trim()) {
              errors.push({
                lessonId,
                questionId,
                field: 'questions.correctIndex',
                message: 'Đáp án đúng tương ứng với correctIndex bị rỗng.',
              });
            }
          }
        }

        // Explanation
        if (!q.explanation || !q.explanation.trim()) {
          errors.push({
            lessonId,
            questionId,
            field: 'questions.explanation',
            message: 'Lời giải thích (explanation) bị rỗng.',
          });
        }

        // Target word relevance validation (for vocab questions)
        if (q.type === 'vocab_context') {
          const targetRes = resolveListeningQuestionTarget(q, lesson.title, []);
          if (targetRes.isVocabTarget) {
            const word = targetRes.targetWord.toLowerCase().trim();
            const inAudio = (lesson.audioText || '').toLowerCase().includes(word);
            const inSentences = (lesson.sentences || []).some((s) =>
              (s.en || '').toLowerCase().includes(word)
            );

            if (!inAudio && !inSentences) {
              errors.push({
                lessonId,
                questionId,
                field: 'questions.targetWord',
                message: `Từ vựng mục tiêu "${targetRes.targetWord}" không xuất hiện trong transcript hay audioText của bài nghe.`,
              });
            }
          }
        }
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Asserts that the dataset is valid; throws an Error with details if any invariant fails.
 */
export function assertListeningDatasetValid(lessons: readonly ListeningLesson[]): void {
  const result = validateListeningDataset(lessons);
  if (!result.valid) {
    const errorDetails = result.errors
      .map((e) => `[${e.lessonId}${e.questionId ? ` / ${e.questionId}` : ''}] ${e.field}: ${e.message}`)
      .join('\n');
    throw new Error(`[ListeningDatasetValidationError] Dataset vi phạm các ràng buộc dữ liệu:\n${errorDetails}`);
  }
}
