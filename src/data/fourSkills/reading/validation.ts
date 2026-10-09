import { ReadingLesson } from '../types';
import { CEFRLevel } from '../../../types';

export const VALID_CEFR_LEVELS: readonly CEFRLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const;

export const VALID_READING_CATEGORIES = [
  'Tech & AI',
  'Career & Business',
  'Science & Habit',
  'Workplace Culture',
  'Daily Life',
  'Culture & Society',
  'Environment',
  'Education',
] as const;

export type ReadingCategory = typeof VALID_READING_CATEGORIES[number];

export const VALID_QUESTION_TYPES = [
  'main_idea',
  'detail',
  'vocab_context',
  'negative_fact',
  'inference',
] as const;

export interface WordCountTarget {
  targetMin: number;
  targetMax: number;
  /** Minimum allowable before triggering severe deviation */
  lenientMin: number;
  /** Maximum allowable before triggering severe deviation */
  lenientMax: number;
}

export const READING_WORD_COUNT_TARGETS: Record<CEFRLevel, WordCountTarget> = {
  A1: { targetMin: 80, targetMax: 140, lenientMin: 65, lenientMax: 180 },
  A2: { targetMin: 120, targetMax: 200, lenientMin: 95, lenientMax: 250 },
  B1: { targetMin: 200, targetMax: 320, lenientMin: 160, lenientMax: 380 },
  B2: { targetMin: 300, targetMax: 450, lenientMin: 240, lenientMax: 520 },
  C1: { targetMin: 450, targetMax: 650, lenientMin: 350, lenientMax: 750 },
  C2: { targetMin: 600, targetMax: 850, lenientMin: 480, lenientMax: 980 },
};

export interface ValidationIssue {
  lessonId: string;
  questionId?: string;
  field: string;
  message: string;
  severity?: 'error' | 'warning';
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
}

export interface DistributionValidationResult {
  valid: boolean;
  total: number;
  expectedTotal: number;
  counts: Record<CEFRLevel, number>;
  expectedPerBand: number;
  missingPerBand: Partial<Record<CEFRLevel, number>>;
  issues: string[];
}

export interface ValidateReadingOptions {
  /**
   * 'strict': word counts must stay close to target ranges (within ~15-20%)
   * 'lenient': word counts only flag severe deviations (e.g. A1 with 600 words)
   */
  wordCountMode?: 'strict' | 'lenient';
  /**
   * If true, also runs distribution check (24 lessons, 4 per level)
   */
  requireFullDistribution?: boolean;
}

/**
 * Counts actual words in a reading passage content array or string.
 */
export function countPassageWords(content: readonly string[] | string): number {
  const text = typeof content === 'string' ? content : content.join(' ');
  if (!text || !text.trim()) return 0;
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/**
 * Validates a dataset of ReadingLessons against strict pedagogical and architectural invariants.
 */
export function validateReadingDataset(
  lessons: readonly ReadingLesson[],
  options: ValidateReadingOptions = {}
): ValidationResult {
  const { wordCountMode = 'lenient', requireFullDistribution = false } = options;
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];
  const seenLessonIds = new Set<string>();
  const seenQuestionIds = new Set<string>();

  for (let lIdx = 0; lIdx < lessons.length; lIdx++) {
    const lesson = lessons[lIdx];
    const lessonId = lesson.id?.trim() || `[index_${lIdx}]`;

    // 1. Duplicate / empty lesson ID
    if (!lesson.id || !lesson.id.trim()) {
      errors.push({
        lessonId,
        field: 'id',
        message: `Bài đọc tại vị trí ${lIdx} có ID rỗng.`,
        severity: 'error',
      });
    } else if (seenLessonIds.has(lesson.id.trim())) {
      errors.push({
        lessonId,
        field: 'id',
        message: `Trùng lặp ID bài đọc: "${lesson.id}".`,
        severity: 'error',
      });
    } else {
      seenLessonIds.add(lesson.id.trim());
    }

    // 2. Title non-empty
    if (!lesson.title || !lesson.title.trim()) {
      errors.push({
        lessonId,
        field: 'title',
        message: 'Tiêu đề bài đọc (title) bị rỗng.',
        severity: 'error',
      });
    }

    // 3. Category valid
    if (!lesson.category || !VALID_READING_CATEGORIES.includes(lesson.category as any)) {
      errors.push({
        lessonId,
        field: 'category',
        message: `Category "${lesson.category}" không nằm trong danh mục hợp lệ: ${VALID_READING_CATEGORIES.join(', ')}.`,
        severity: 'error',
      });
    }

    // 4. CEFR level valid
    if (!VALID_CEFR_LEVELS.includes(lesson.level)) {
      errors.push({
        lessonId,
        field: 'level',
        message: `Cấp độ CEFR "${lesson.level}" không hợp lệ. Phải là một trong: ${VALID_CEFR_LEVELS.join(', ')}.`,
        severity: 'error',
      });
    }

    // 5. Summary non-empty
    if (!lesson.summary || !lesson.summary.trim()) {
      errors.push({
        lessonId,
        field: 'summary',
        message: 'Tóm tắt bài đọc (summary) bị rỗng.',
        severity: 'error',
      });
    }

    // 6. Content paragraphs
    if (!Array.isArray(lesson.content) || lesson.content.length === 0) {
      errors.push({
        lessonId,
        field: 'content',
        message: 'Nội dung bài đọc (content) rỗng, phải có ít nhất 1 đoạn văn.',
        severity: 'error',
      });
    } else {
      lesson.content.forEach((paragraph, pIdx) => {
        if (!paragraph || !paragraph.trim()) {
          errors.push({
            lessonId,
            field: `content[${pIdx}]`,
            message: `Đoạn văn tại vị trí ${pIdx} bị rỗng hoặc chỉ chứa khoảng trắng.`,
            severity: 'error',
          });
        }
      });
    }

    // 7. Word count validation & deviation detection
    const actualWordCount = countPassageWords(lesson.content || []);
    if (VALID_CEFR_LEVELS.includes(lesson.level)) {
      const target = READING_WORD_COUNT_TARGETS[lesson.level];
      if (wordCountMode === 'strict') {
        if (actualWordCount < target.targetMin || actualWordCount > target.targetMax) {
          errors.push({
            lessonId,
            field: 'wordCount',
            message: `Số từ thực tế (${actualWordCount}) nằm ngoài khoảng mục tiêu cho ${lesson.level} [${target.targetMin}–${target.targetMax} từ].`,
            severity: 'error',
          });
        }
      } else {
        // Lenient: detect large/severe deviation
        if (actualWordCount < target.lenientMin) {
          errors.push({
            lessonId,
            field: 'wordCount',
            message: `Độ lệch số từ quá lớn cho ${lesson.level}: thực tế ${actualWordCount} từ < giới hạn tối thiểu ${target.lenientMin} từ (Mục tiêu: ${target.targetMin}–${target.targetMax}).`,
            severity: 'error',
          });
        } else if (actualWordCount > target.lenientMax) {
          errors.push({
            lessonId,
            field: 'wordCount',
            message: `Độ lệch số từ quá lớn cho ${lesson.level}: thực tế ${actualWordCount} từ > giới hạn tối đa ${target.lenientMax} từ (Mục tiêu: ${target.targetMin}–${target.targetMax}).`,
            severity: 'error',
          });
        } else if (actualWordCount < target.targetMin || actualWordCount > target.targetMax) {
          warnings.push({
            lessonId,
            field: 'wordCount',
            message: `Số từ (${actualWordCount}) hơi lệch khỏi khung mục tiêu ${lesson.level} [${target.targetMin}–${target.targetMax} từ] nhưng nằm trong biên độ chấp nhận.`,
            severity: 'warning',
          });
        }
      }
    }

    // Declared wordCount consistency check
    if (typeof lesson.wordCount === 'number' && actualWordCount > 0) {
      const diffRatio = Math.abs(lesson.wordCount - actualWordCount) / actualWordCount;
      if (diffRatio > 0.35) {
        warnings.push({
          lessonId,
          field: 'wordCount',
          message: `Số từ khai báo (wordCount: ${lesson.wordCount}) lệch đáng kể so với thực tế đếm được (${actualWordCount} từ).`,
          severity: 'warning',
        });
      }
    }

    // 8. Key Vocab validation
    if (!Array.isArray(lesson.keyVocab) || lesson.keyVocab.length === 0) {
      warnings.push({
        lessonId,
        field: 'keyVocab',
        message: 'Bài đọc không có danh sách keyVocab nổi bật.',
        severity: 'warning',
      });
    } else {
      lesson.keyVocab.forEach((kv, kvIdx) => {
        if (!kv.word || !kv.word.trim()) {
          errors.push({
            lessonId,
            field: `keyVocab[${kvIdx}].word`,
            message: `Từ vựng trọng tâm tại vị trí ${kvIdx} bị rỗng.`,
            severity: 'error',
          });
        }
        if (!kv.ipa || !kv.ipa.trim()) {
          errors.push({
            lessonId,
            field: `keyVocab[${kvIdx}].ipa`,
            message: `Phiên âm IPA của từ "${kv.word || kvIdx}" bị rỗng.`,
            severity: 'error',
          });
        }
        if (!kv.meaning || !kv.meaning.trim()) {
          errors.push({
            lessonId,
            field: `keyVocab[${kvIdx}].meaning`,
            message: `Nghĩa tiếng Việt của từ "${kv.word || kvIdx}" bị rỗng.`,
            severity: 'error',
          });
        }
      });
    }

    // 9. Questions validation
    if (!Array.isArray(lesson.questions) || lesson.questions.length === 0) {
      errors.push({
        lessonId,
        field: 'questions',
        message: 'Bài đọc không có câu hỏi kiểm tra nào (questions rỗng).',
        severity: 'error',
      });
    } else {
      for (let qIdx = 0; qIdx < lesson.questions.length; qIdx++) {
        const q = lesson.questions[qIdx];
        const questionId = q.id?.trim() || `[q_index_${qIdx}]`;

        // 9a. Duplicate question ID / empty
        if (!q.id || !q.id.trim()) {
          errors.push({
            lessonId,
            questionId,
            field: 'questions.id',
            message: `Câu hỏi tại vị trí ${qIdx} có ID rỗng.`,
            severity: 'error',
          });
        } else if (seenQuestionIds.has(q.id.trim())) {
          errors.push({
            lessonId,
            questionId,
            field: 'questions.id',
            message: `Trùng lặp ID câu hỏi: "${q.id}".`,
            severity: 'error',
          });
        } else {
          seenQuestionIds.add(q.id.trim());
        }

        // 9b. Question text
        if (!q.question || !q.question.trim()) {
          errors.push({
            lessonId,
            questionId,
            field: 'questions.question',
            message: 'Nội dung câu hỏi rỗng.',
            severity: 'error',
          });
        }

        // 9c. Question options
        if (!Array.isArray(q.options) || q.options.length < 2) {
          errors.push({
            lessonId,
            questionId,
            field: 'questions.options',
            message: `Câu hỏi phải có ít nhất 2 options (hiện có ${q.options?.length || 0}).`,
            severity: 'error',
          });
        } else {
          const trimmedOptions = q.options.map((opt) => (opt || '').trim());

          // Empty option check
          if (trimmedOptions.some((opt) => opt.length === 0)) {
            errors.push({
              lessonId,
              questionId,
              field: 'questions.options',
              message: 'Có ít nhất một option bị rỗng trong câu hỏi.',
              severity: 'error',
            });
          }

          // Duplicate option check (case-insensitive)
          const lowerOptions = trimmedOptions.map((o) => o.toLowerCase());
          const uniqueOptions = new Set(lowerOptions);
          if (uniqueOptions.size !== q.options.length) {
            errors.push({
              lessonId,
              questionId,
              field: 'questions.options',
              message: 'Tồn tại các lựa chọn options trùng lặp trong cùng một câu hỏi.',
              severity: 'error',
            });
          }

          // 9d. correctIndex range & correct answer existence
          if (
            typeof q.correctIndex !== 'number' ||
            !Number.isInteger(q.correctIndex) ||
            q.correctIndex < 0 ||
            q.correctIndex >= q.options.length
          ) {
            errors.push({
              lessonId,
              questionId,
              field: 'questions.correctIndex',
              message: `correctIndex ${q.correctIndex} nằm ngoài phạm vi options [0..${q.options.length - 1}].`,
              severity: 'error',
            });
          } else {
            const correctOpt = q.options[q.correctIndex];
            if (!correctOpt || !correctOpt.trim()) {
              errors.push({
                lessonId,
                questionId,
                field: 'questions.correctIndex',
                message: 'Đáp án đúng tương ứng với correctIndex bị rỗng.',
                severity: 'error',
              });
            }
          }
        }

        // 9e. Explanation non-empty
        if (!q.explanation || !q.explanation.trim()) {
          errors.push({
            lessonId,
            questionId,
            field: 'questions.explanation',
            message: 'Lời giải thích (explanation) bị rỗng.',
            severity: 'error',
          });
        }

        // 9f. Question type if present
        if (q.type && !VALID_QUESTION_TYPES.includes(q.type as any)) {
          warnings.push({
            lessonId,
            questionId,
            field: 'questions.type',
            message: `Question type "${q.type}" không thuộc danh sách chuẩn: ${VALID_QUESTION_TYPES.join(', ')}.`,
            severity: 'warning',
          });
        }
      }
    }
  }

  // 10. Optional full distribution verification
  if (requireFullDistribution) {
    const distResult = validateReadingDistribution(lessons);
    if (!distResult.valid) {
      distResult.issues.forEach((issue) => {
        errors.push({
          lessonId: '[dataset_distribution]',
          field: 'distribution',
          message: issue,
          severity: 'error',
        });
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Asserts that the dataset is valid; throws an Error with details if any invariant fails.
 */
export function assertReadingDatasetValid(
  lessons: readonly ReadingLesson[],
  options?: ValidateReadingOptions
): void {
  const result = validateReadingDataset(lessons, options);
  if (!result.valid) {
    const errorDetails = result.errors
      .map(
        (e) =>
          `[${e.lessonId}${e.questionId ? ` / ${e.questionId}` : ''}] ${e.field}: ${e.message}`
      )
      .join('\n');
    throw new Error(
      `[ReadingDatasetValidationError] Dataset vi phạm các ràng buộc dữ liệu:\n${errorDetails}`
    );
  }
}

/**
 * Checks whether the dataset satisfies the target 24 lessons distribution (4 lessons per CEFR band: A1–C2).
 */
export function validateReadingDistribution(
  lessons: readonly ReadingLesson[],
  expectedPerBand = 4
): DistributionValidationResult {
  const counts: Record<CEFRLevel, number> = {
    A1: 0,
    A2: 0,
    B1: 0,
    B2: 0,
    C1: 0,
    C2: 0,
  };

  lessons.forEach((l) => {
    if (l.level in counts) {
      counts[l.level]++;
    }
  });

  const expectedTotal = expectedPerBand * VALID_CEFR_LEVELS.length;
  const issues: string[] = [];
  const missingPerBand: Partial<Record<CEFRLevel, number>> = {};

  if (lessons.length !== expectedTotal) {
    issues.push(`Tổng số bài đọc hiện tại (${lessons.length}) khác mục tiêu chuẩn (${expectedTotal}).`);
  }

  VALID_CEFR_LEVELS.forEach((level) => {
    const actual = counts[level] || 0;
    if (actual !== expectedPerBand) {
      const diff = expectedPerBand - actual;
      missingPerBand[level] = diff;
      issues.push(`Cấp độ ${level}: có ${actual}/${expectedPerBand} bài (cần bổ sung: ${diff > 0 ? diff : 0}).`);
    }
  });

  return {
    valid: issues.length === 0,
    total: lessons.length,
    expectedTotal,
    counts,
    expectedPerBand,
    missingPerBand,
    issues,
  };
}
