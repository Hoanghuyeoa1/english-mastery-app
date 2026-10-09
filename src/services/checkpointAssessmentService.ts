// src/services/checkpointAssessmentService.ts
/**
 * CEFR Checkpoint Assessment Service (Phase 3)
 *
 * Dedicated Assessment Data Foundation for CEFR Checkpoints (A1 -> C2).
 *
 * Invariants:
 * - Semantics independence: Checkpoint data is strictly separate from Lesson Completion.
 * - Assessment context: Evidence is generated in an official assessment session with strict rules.
 * - Assessment-mode restrictions: Policy flags control disabling hints, answer reveals, retries, etc.
 * - Integrity: Fail-safe behavior against missing IDs, broken references, or level mismatches.
 * - Performance: Pre-indexed static maps provide O(1) lookup without scanning full datasets per render.
 * - Zero dataset duplication: References existing high-quality dataset items without duplicating 376 lessons.
 * - Zero crash: Safe, pure, and fail-safe without faking replacement questions at runtime.
 */

import type {
  CefrLevel,
  CheckpointDefinition,
  ResolvedCheckpointAssessment,
  ResolvedListeningSection,
  ResolvedReadingSection,
  ResolvedSpeakingSection,
  ResolvedWritingSection,
  CheckpointValidationResult,
  CheckpointValidationIssue,
} from '../types/checkpointAssessment';
import {
  CHECKPOINT_DATA_SCHEMA_VERSION,
  CHECKPOINT_CONTENT_VERSION,
  DEFAULT_ASSESSMENT_POLICY,
} from '../types/checkpointAssessment';
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
import { resolveLessonCefrLevel } from './learningJourneyService';
import { CEFR_LEVELS_ORDER } from '../types/levelCertification';

// =========================================================================
// 1. HIGH-PERFORMANCE STATIC INDEXES (O(1) CONSTANT TIME LOOKUP)
// =========================================================================

const LISTENING_INDEX = new Map<string, ListeningLesson>();
const READING_INDEX = new Map<string, ReadingLesson>();
const SPEAKING_INDEX = new Map<string, SpeakingPrompt>();
const WRITING_INDEX = new Map<string, WritingPrompt>();

// Populate indexes once on module evaluation
for (const l of LISTENING_LESSONS) {
  if (l && l.id) LISTENING_INDEX.set(l.id, l);
}
for (const r of READING_LESSONS) {
  if (r && r.id) READING_INDEX.set(r.id, r);
}
for (const s of SPEAKING_PROMPTS) {
  if (s && s.id) SPEAKING_INDEX.set(s.id, s);
}
for (const w of WRITING_PROMPTS) {
  if (w && w.id) WRITING_INDEX.set(w.id, w);
}

export function getIndexedListeningLesson(id: string): ListeningLesson | undefined {
  return LISTENING_INDEX.get(id);
}

export function getIndexedReadingLesson(id: string): ReadingLesson | undefined {
  return READING_INDEX.get(id);
}

export function getIndexedSpeakingPrompt(id: string): SpeakingPrompt | undefined {
  return SPEAKING_INDEX.get(id);
}

export function getIndexedWritingPrompt(id: string): WritingPrompt | undefined {
  return WRITING_INDEX.get(id);
}

// =========================================================================
// 2. CANONICAL CHECKPOINT DEFINITIONS REGISTRY (A1 -> C2)
// =========================================================================

/**
 * Static registry of official Checkpoint Definitions across all 6 CEFR bands.
 * Carefully curated to ensure complete 4-skill coverage, valid CEFR mapping,
 * and high diagnostic validity.
 */
export const CHECKPOINT_DEFINITIONS: Record<CefrLevel, CheckpointDefinition> = {
  A1: {
    level: 'A1',
    checkpointId: 'checkpoint_a1',
    title: 'CEFR A1 Beginner Mastery Checkpoint',
    description: 'Bài đánh giá chuẩn mực 4 kỹ năng (Nghe, Đọc, Nói, Viết) cấp độ A1 Khởi đầu.',
    version: CHECKPOINT_CONTENT_VERSION,
    schemaVersion: CHECKPOINT_DATA_SCHEMA_VERSION,
    totalTimeMinutes: 40,
    policy: {
      ...DEFAULT_ASSESSMENT_POLICY,
      timeLimitMinutes: 40,
      maxAudioPlays: 2,
    },
    sections: {
      listening: {
        sectionId: 'sec_chk_a1_listening',
        skill: 'listening',
        level: 'A1',
        title: 'Phần 1: Nghe Hiểu (Listening Comprehension)',
        instructions: 'Nghe đoạn hội thoại và chọn đáp án chính xác cho từng câu hỏi. Audio được phát tối đa 2 lần.',
        sourceLessonId: 'listen_a1_1',
        timeLimitMinutes: 8,
        weightPercent: 25,
        maxAudioPlays: 2,
      },
      reading: {
        sectionId: 'sec_chk_a1_reading',
        skill: 'reading',
        level: 'A1',
        title: 'Phần 2: Đọc Hiểu (Reading Comprehension)',
        instructions: 'Đọc kỹ văn bản và trả lời các câu hỏi trắc nghiệm bên dưới.',
        sourceLessonId: 'read_a1_1',
        timeLimitMinutes: 10,
        weightPercent: 25,
      },
      speaking: {
        sectionId: 'sec_chk_a1_speaking',
        skill: 'speaking',
        level: 'A1',
        title: 'Phần 3: Phản Xạ Nói (Interactive Speaking)',
        instructions: 'Lắng nghe từng lượt đối thoại của đối tác và phản xạ trả lời bằng giọng nói rõ ràng.',
        sourcePromptId: 'sp_a1_1',
        timeLimitMinutes: 7,
        weightPercent: 25,
      },
      writing: {
        sectionId: 'sec_chk_a1_writing',
        skill: 'writing',
        level: 'A1',
        title: 'Phần 4: Viết Đoạn Văn (Writing Assessment)',
        instructions: 'Viết bài theo yêu cầu và hướng dẫn của đề bài. Đảm bảo đúng số lượng từ quy định.',
        sourcePromptId: 'wp_a1_1',
        timeLimitMinutes: 15,
        weightPercent: 25,
        minWords: 40,
        maxWords: 70,
      },
    },
  },

  A2: {
    level: 'A2',
    checkpointId: 'checkpoint_a2',
    title: 'CEFR A2 Elementary Mastery Checkpoint',
    description: 'Bài đánh giá chuẩn mực 4 kỹ năng cấp độ A2 Sơ cấp.',
    version: CHECKPOINT_CONTENT_VERSION,
    schemaVersion: CHECKPOINT_DATA_SCHEMA_VERSION,
    totalTimeMinutes: 45,
    policy: {
      ...DEFAULT_ASSESSMENT_POLICY,
      timeLimitMinutes: 45,
      maxAudioPlays: 2,
    },
    sections: {
      listening: {
        sectionId: 'sec_chk_a2_listening',
        skill: 'listening',
        level: 'A2',
        title: 'Phần 1: Nghe Hiểu (Listening Comprehension)',
        instructions: 'Nghe đoạn hội thoại và chọn đáp án chính xác cho từng câu hỏi.',
        sourceLessonId: 'listen_a2_1',
        timeLimitMinutes: 10,
        weightPercent: 25,
        maxAudioPlays: 2,
      },
      reading: {
        sectionId: 'sec_chk_a2_reading',
        skill: 'reading',
        level: 'A2',
        title: 'Phần 2: Đọc Hiểu (Reading Comprehension)',
        instructions: 'Đọc đoạn văn và chọn đáp án chính xác nhất.',
        sourceLessonId: 'read_a2_1',
        timeLimitMinutes: 10,
        weightPercent: 25,
      },
      speaking: {
        sectionId: 'sec_chk_a2_speaking',
        skill: 'speaking',
        level: 'A2',
        title: 'Phần 3: Phản Xạ Nói (Interactive Speaking)',
        instructions: 'Thực hiện hội thoại đối đáp tình huống theo các lượt quy định.',
        sourcePromptId: 'sp_4',
        timeLimitMinutes: 10,
        weightPercent: 25,
      },
      writing: {
        sectionId: 'sec_chk_a2_writing',
        skill: 'writing',
        level: 'A2',
        title: 'Phần 4: Viết Thư / Tin Nhắn (Writing Assessment)',
        instructions: 'Viết thư hoặc tin nhắn hoàn chỉnh đáp ứng đầy đủ các yêu cầu đề bài.',
        sourcePromptId: 'wp_a2_1',
        timeLimitMinutes: 15,
        weightPercent: 25,
        minWords: 60,
        maxWords: 100,
      },
    },
  },

  B1: {
    level: 'B1',
    checkpointId: 'checkpoint_b1',
    title: 'CEFR B1 Intermediate Mastery Checkpoint',
    description: 'Bài đánh giá năng lực 4 kỹ năng cấp độ B1 Trung cấp.',
    version: CHECKPOINT_CONTENT_VERSION,
    schemaVersion: CHECKPOINT_DATA_SCHEMA_VERSION,
    totalTimeMinutes: 50,
    policy: {
      ...DEFAULT_ASSESSMENT_POLICY,
      timeLimitMinutes: 50,
      maxAudioPlays: 2,
    },
    sections: {
      listening: {
        sectionId: 'sec_chk_b1_listening',
        skill: 'listening',
        level: 'B1',
        title: 'Phần 1: Nghe Hiểu (Listening Comprehension)',
        instructions: 'Nghe bài phỏng vấn / thuyết trình và trả lời câu hỏi phân tích thông tin.',
        sourceLessonId: 'listen_2',
        timeLimitMinutes: 10,
        weightPercent: 25,
        maxAudioPlays: 2,
      },
      reading: {
        sectionId: 'sec_chk_b1_reading',
        skill: 'reading',
        level: 'B1',
        title: 'Phần 2: Đọc Hiểu (Reading Comprehension)',
        instructions: 'Đọc bài báo và trả lời các câu hỏi về ý chính, chi tiết và từ vựng ngữ cảnh.',
        sourceLessonId: 'read_b1_1',
        timeLimitMinutes: 12,
        weightPercent: 25,
      },
      speaking: {
        sectionId: 'sec_chk_b1_speaking',
        skill: 'speaking',
        level: 'B1',
        title: 'Phần 3: Phản Xạ Nói (Interactive Speaking)',
        instructions: 'Thảo luận công việc và diễn đạt quan điểm cá nhân trong bối cảnh thực tế.',
        sourcePromptId: 'sp_2',
        timeLimitMinutes: 10,
        weightPercent: 25,
      },
      writing: {
        sectionId: 'sec_chk_b1_writing',
        skill: 'writing',
        level: 'B1',
        title: 'Phần 4: Viết Luận / Báo Cáo (Writing Assessment)',
        instructions: 'Viết bài luận ngắn bày tỏ quan điểm rõ ràng với lập luận mạch lạc.',
        sourcePromptId: 'wp_2',
        timeLimitMinutes: 18,
        weightPercent: 25,
        minWords: 100,
        maxWords: 150,
      },
    },
  },

  B2: {
    level: 'B2',
    checkpointId: 'checkpoint_b2',
    title: 'CEFR B2 Upper Intermediate Mastery Checkpoint',
    description: 'Bài đánh giá năng lực 4 kỹ năng cấp độ B2 Trung cấp cao.',
    version: CHECKPOINT_CONTENT_VERSION,
    schemaVersion: CHECKPOINT_DATA_SCHEMA_VERSION,
    totalTimeMinutes: 55,
    policy: {
      ...DEFAULT_ASSESSMENT_POLICY,
      timeLimitMinutes: 55,
      maxAudioPlays: 2,
    },
    sections: {
      listening: {
        sectionId: 'sec_chk_b2_listening',
        skill: 'listening',
        level: 'B2',
        title: 'Phần 1: Nghe Hiểu (Listening Comprehension)',
        instructions: 'Nghe bài thuyết trình chuyên sâu và phân tích lập luận của diễn giả.',
        sourceLessonId: 'listen_1',
        timeLimitMinutes: 12,
        weightPercent: 25,
        maxAudioPlays: 2,
      },
      reading: {
        sectionId: 'sec_chk_b2_reading',
        skill: 'reading',
        level: 'B2',
        title: 'Phần 2: Đọc Hiểu (Reading Comprehension)',
        instructions: 'Đọc văn bản chuyên ngành và trả lời các câu hỏi suy luận, mục đích tác giả.',
        sourceLessonId: 'read_1',
        timeLimitMinutes: 13,
        weightPercent: 25,
      },
      speaking: {
        sectionId: 'sec_chk_b2_speaking',
        skill: 'speaking',
        level: 'B2',
        title: 'Phần 3: Phản Xạ Nói (Interactive Speaking)',
        instructions: 'Tham gia đàm phán, giải quyết bất đồng và bảo vệ quan điểm với đối tác.',
        sourcePromptId: 'sp_1',
        timeLimitMinutes: 10,
        weightPercent: 25,
      },
      writing: {
        sectionId: 'sec_chk_b2_writing',
        skill: 'writing',
        level: 'B2',
        title: 'Phần 4: Viết Luận Học Thuật (Writing Assessment)',
        instructions: 'Viết bài luận học thuật chặt chẽ với các luận cứ so sánh, phân tích.',
        sourcePromptId: 'wp_1',
        timeLimitMinutes: 20,
        weightPercent: 25,
        minWords: 150,
        maxWords: 220,
      },
    },
  },

  C1: {
    level: 'C1',
    checkpointId: 'checkpoint_c1',
    title: 'CEFR C1 Advanced Mastery Checkpoint',
    description: 'Bài đánh giá năng lực 4 kỹ năng cấp độ C1 Cao cấp.',
    version: CHECKPOINT_CONTENT_VERSION,
    schemaVersion: CHECKPOINT_DATA_SCHEMA_VERSION,
    totalTimeMinutes: 60,
    policy: {
      ...DEFAULT_ASSESSMENT_POLICY,
      timeLimitMinutes: 60,
      maxAudioPlays: 2,
    },
    sections: {
      listening: {
        sectionId: 'sec_chk_c1_listening',
        skill: 'listening',
        level: 'C1',
        title: 'Phần 1: Nghe Hiểu (Listening Comprehension)',
        instructions: 'Nghe bài giảng học thuật phức tạp và trả lời các câu hỏi suy luận chuyên sâu.',
        sourceLessonId: 'listen_3',
        timeLimitMinutes: 15,
        weightPercent: 25,
        maxAudioPlays: 2,
      },
      reading: {
        sectionId: 'sec_chk_c1_reading',
        skill: 'reading',
        level: 'C1',
        title: 'Phần 2: Đọc Hiểu (Reading Comprehension)',
        instructions: 'Đọc bài luận phân tích trừu tượng và giải quyết các câu hỏi về thái độ và tu từ.',
        sourceLessonId: 'read_3',
        timeLimitMinutes: 15,
        weightPercent: 25,
      },
      speaking: {
        sectionId: 'sec_chk_c1_speaking',
        skill: 'speaking',
        level: 'C1',
        title: 'Phần 3: Phản Xạ Nói (Interactive Speaking)',
        instructions: 'Phỏng vấn cấp cao và giải quyết các vấn đề chiến lược phức tạp.',
        sourcePromptId: 'sp_c1_1',
        timeLimitMinutes: 10,
        weightPercent: 25,
      },
      writing: {
        sectionId: 'sec_chk_c1_writing',
        skill: 'writing',
        level: 'C1',
        title: 'Phần 4: Báo Cáo Phân Tích (Writing Assessment)',
        instructions: 'Viết báo cáo phân tích toàn diện với vốn từ học thuật phong phú và văn phong trang trọng.',
        sourcePromptId: 'wp_5',
        timeLimitMinutes: 20,
        weightPercent: 25,
        minWords: 200,
        maxWords: 280,
      },
    },
  },

  C2: {
    level: 'C2',
    checkpointId: 'checkpoint_c2',
    title: 'CEFR C2 Proficiency Mastery Checkpoint',
    description: 'Bài đánh giá năng lực 4 kỹ năng cấp độ C2 Thành thạo toàn diện.',
    version: CHECKPOINT_CONTENT_VERSION,
    schemaVersion: CHECKPOINT_DATA_SCHEMA_VERSION,
    totalTimeMinutes: 65,
    policy: {
      ...DEFAULT_ASSESSMENT_POLICY,
      timeLimitMinutes: 65,
      maxAudioPlays: 1, // Strict single-play at C2
    },
    sections: {
      listening: {
        sectionId: 'sec_chk_c2_listening',
        skill: 'listening',
        level: 'C2',
        title: 'Phần 1: Nghe Hiểu (Listening Comprehension)',
        instructions: 'Nghe tài liệu phân tích thực tế ở tốc độ bản ngữ tự nhiên và trả lời các câu hỏi đánh giá.',
        sourceLessonId: 'listen_c2_1',
        timeLimitMinutes: 15,
        weightPercent: 25,
        maxAudioPlays: 1,
      },
      reading: {
        sectionId: 'sec_chk_c2_reading',
        skill: 'reading',
        level: 'C2',
        title: 'Phần 2: Đọc Hiểu (Reading Comprehension)',
        instructions: 'Đọc tác phẩm văn học / chuyên khảo phức tạp và phân tích các tầng nghĩa tinh tế.',
        sourceLessonId: 'read_c2_1',
        timeLimitMinutes: 15,
        weightPercent: 25,
      },
      speaking: {
        sectionId: 'sec_chk_c2_speaking',
        skill: 'speaking',
        level: 'C2',
        title: 'Phần 3: Phản Xạ Nói (Interactive Speaking)',
        instructions: 'Đối thoại thảo luận đa chiều với cấu trúc tinh tế và từ vựng thành ngữ chuẩn xác.',
        sourcePromptId: 'sp_c2_1',
        timeLimitMinutes: 12,
        weightPercent: 25,
      },
      writing: {
        sectionId: 'sec_chk_c2_writing',
        skill: 'writing',
        level: 'C2',
        title: 'Phần 4: Viết Tổng Hợp & Đánh Giá (Writing Assessment)',
        instructions: 'Viết bài tổng quan điều hành (Executive Summary) hoặc tiểu luận học thuật đỉnh cao.',
        sourcePromptId: 'wp_c2_1',
        timeLimitMinutes: 23,
        weightPercent: 25,
        minWords: 250,
        maxWords: 350,
      },
    },
  },
};

// =========================================================================
// 3. INTEGRITY & VALIDATION ENGINE
// =========================================================================

export class AssessmentIntegrityError extends Error {
  public readonly issues: CheckpointValidationIssue[];
  public readonly level: CefrLevel;

  constructor(level: CefrLevel, issues: CheckpointValidationIssue[]) {
    super(
      `Assessment integrity violation for CEFR ${level}: ${issues.map((i) => `[${i.code}] ${i.message}`).join('; ')}`
    );
    this.name = 'AssessmentIntegrityError';
    this.level = level;
    this.issues = issues;
  }
}

/**
 * Rigorously validates the integrity of a Checkpoint Definition and its referenced data.
 * Guarantees zero runtime crashes during live checkpoint sessions.
 */
export function validateCheckpointIntegrity(
  checkpointOrLevel: CheckpointDefinition | CefrLevel
): CheckpointValidationResult {
  const def =
    typeof checkpointOrLevel === 'string'
      ? CHECKPOINT_DEFINITIONS[checkpointOrLevel]
      : checkpointOrLevel;

  if (!def || !def.level) {
    return {
      level: (checkpointOrLevel as any)?.level || (checkpointOrLevel as CefrLevel) || 'A1',
      isValid: false,
      issues: [
        {
          code: 'MISSING_LESSON_REFERENCE',
          field: 'level',
          message: `Checkpoint definition for level '${String(checkpointOrLevel)}' does not exist in registry.`,
        },
      ],
    };
  }

  const issues: CheckpointValidationIssue[] = [];
  const level = def.level;
  const seenItemIds = new Set<string>();

  // 1. Listening Section Validation
  const lisDef = def.sections.listening;
  if (!lisDef || !lisDef.sourceLessonId) {
    issues.push({
      code: 'MISSING_LESSON_REFERENCE',
      skill: 'listening',
      field: 'sections.listening.sourceLessonId',
      message: 'Listening section is missing sourceLessonId reference.',
    });
  } else {
    const lesson = getIndexedListeningLesson(lisDef.sourceLessonId);
    if (!lesson) {
      issues.push({
        code: 'MISSING_LESSON_REFERENCE',
        skill: 'listening',
        field: 'sections.listening.sourceLessonId',
        message: `Listening lesson '${lisDef.sourceLessonId}' was not found in dataset.`,
      });
    } else {
      const canonicalLevel = resolveLessonCefrLevel(lesson.level);
      if (canonicalLevel !== level) {
        issues.push({
          code: 'CEFR_LEVEL_MISMATCH',
          skill: 'listening',
          field: 'sections.listening.level',
          message: `Listening lesson level '${lesson.level}' does not match checkpoint level '${level}'.`,
        });
      }

      if (!lesson.audioText || lesson.audioText.trim().length === 0) {
        issues.push({
          code: 'MISSING_AUDIO_REFERENCE',
          skill: 'listening',
          field: 'lesson.audioText',
          message: `Listening lesson '${lesson.id}' has missing or empty audioText.`,
        });
      }

      const questions = lesson.questions || [];
      if (questions.length === 0) {
        issues.push({
          code: 'EMPTY_QUESTIONS_SECTION',
          skill: 'listening',
          field: 'lesson.questions',
          message: `Listening lesson '${lesson.id}' has zero comprehension questions.`,
        });
      } else {
        questions.forEach((q, idx) => {
          if (!q.id || !q.question || !Array.isArray(q.options) || q.options.length < 2) {
            issues.push({
              code: 'MALFORMED_QUESTION',
              skill: 'listening',
              field: `lesson.questions[${idx}]`,
              message: `Listening question [${idx}] is malformed or lacks minimum options.`,
            });
          }
          if (typeof q.correctIndex !== 'number' || q.correctIndex < 0 || q.correctIndex >= q.options.length) {
            issues.push({
              code: 'MALFORMED_QUESTION',
              skill: 'listening',
              field: `lesson.questions[${idx}].correctIndex`,
              message: `Listening question '${q.id}' has invalid correctIndex: ${q.correctIndex}.`,
            });
          }
          if (seenItemIds.has(q.id)) {
            issues.push({
              code: 'DUPLICATE_ITEM_ID',
              skill: 'listening',
              field: `lesson.questions[${idx}].id`,
              message: `Duplicate item ID detected: '${q.id}'.`,
            });
          } else {
            seenItemIds.add(q.id);
          }
        });
      }
    }
  }

  // 2. Reading Section Validation
  const readDef = def.sections.reading;
  if (!readDef || !readDef.sourceLessonId) {
    issues.push({
      code: 'MISSING_LESSON_REFERENCE',
      skill: 'reading',
      field: 'sections.reading.sourceLessonId',
      message: 'Reading section is missing sourceLessonId reference.',
    });
  } else {
    const lesson = getIndexedReadingLesson(readDef.sourceLessonId);
    if (!lesson) {
      issues.push({
        code: 'MISSING_LESSON_REFERENCE',
        skill: 'reading',
        field: 'sections.reading.sourceLessonId',
        message: `Reading lesson '${readDef.sourceLessonId}' was not found in dataset.`,
      });
    } else {
      const canonicalLevel = resolveLessonCefrLevel(lesson.level);
      if (canonicalLevel !== level) {
        issues.push({
          code: 'CEFR_LEVEL_MISMATCH',
          skill: 'reading',
          field: 'sections.reading.level',
          message: `Reading lesson level '${lesson.level}' does not match checkpoint level '${level}'.`,
        });
      }

      if (!Array.isArray(lesson.content) || lesson.content.length === 0) {
        issues.push({
          code: 'EMPTY_PASSAGE',
          skill: 'reading',
          field: 'lesson.content',
          message: `Reading lesson '${lesson.id}' has missing or empty content passage.`,
        });
      }

      const questions = lesson.questions || [];
      if (questions.length === 0) {
        issues.push({
          code: 'EMPTY_QUESTIONS_SECTION',
          skill: 'reading',
          field: 'lesson.questions',
          message: `Reading lesson '${lesson.id}' has zero questions.`,
        });
      } else {
        questions.forEach((q, idx) => {
          if (!q.id || !q.question || !Array.isArray(q.options) || q.options.length < 2) {
            issues.push({
              code: 'MALFORMED_QUESTION',
              skill: 'reading',
              field: `lesson.questions[${idx}]`,
              message: `Reading question [${idx}] is malformed or lacks minimum options.`,
            });
          }
          if (typeof q.correctIndex !== 'number' || q.correctIndex < 0 || q.correctIndex >= q.options.length) {
            issues.push({
              code: 'MALFORMED_QUESTION',
              skill: 'reading',
              field: `lesson.questions[${idx}].correctIndex`,
              message: `Reading question '${q.id}' has invalid correctIndex: ${q.correctIndex}.`,
            });
          }
          if (seenItemIds.has(q.id)) {
            issues.push({
              code: 'DUPLICATE_ITEM_ID',
              skill: 'reading',
              field: `lesson.questions[${idx}].id`,
              message: `Duplicate item ID detected: '${q.id}'.`,
            });
          } else {
            seenItemIds.add(q.id);
          }
        });
      }
    }
  }

  // 3. Speaking Section Validation
  const speakDef = def.sections.speaking;
  if (!speakDef || !speakDef.sourcePromptId) {
    issues.push({
      code: 'MISSING_LESSON_REFERENCE',
      skill: 'speaking',
      field: 'sections.speaking.sourcePromptId',
      message: 'Speaking section is missing sourcePromptId reference.',
    });
  } else {
    const prompt = getIndexedSpeakingPrompt(speakDef.sourcePromptId);
    if (!prompt) {
      issues.push({
        code: 'MISSING_LESSON_REFERENCE',
        skill: 'speaking',
        field: 'sections.speaking.sourcePromptId',
        message: `Speaking prompt '${speakDef.sourcePromptId}' was not found in dataset.`,
      });
    } else {
      const canonicalLevel = resolveLessonCefrLevel(prompt.level);
      if (canonicalLevel !== level) {
        issues.push({
          code: 'CEFR_LEVEL_MISMATCH',
          skill: 'speaking',
          field: 'sections.speaking.level',
          message: `Speaking prompt level '${prompt.level}' does not match checkpoint level '${level}'.`,
        });
      }

      const turns = prompt.turns || [];
      if (turns.length === 0) {
        issues.push({
          code: 'EMPTY_SPEAKING_TURNS',
          skill: 'speaking',
          field: 'prompt.turns',
          message: `Speaking prompt '${prompt.id}' has zero interactive turns.`,
        });
      } else {
        turns.forEach((t, idx) => {
          if (!t.partnerPrompt || !t.targetSentence) {
            issues.push({
              code: 'MALFORMED_SPEAKING_TURN',
              skill: 'speaking',
              field: `prompt.turns[${idx}]`,
              message: `Speaking turn [${idx}] is missing partnerPrompt or targetSentence.`,
            });
          }
        });
      }
    }
  }

  // 4. Writing Section Validation
  const writeDef = def.sections.writing;
  if (!writeDef || !writeDef.sourcePromptId) {
    issues.push({
      code: 'MISSING_LESSON_REFERENCE',
      skill: 'writing',
      field: 'sections.writing.sourcePromptId',
      message: 'Writing section is missing sourcePromptId reference.',
    });
  } else {
    const prompt = getIndexedWritingPrompt(writeDef.sourcePromptId);
    if (!prompt) {
      issues.push({
        code: 'MISSING_LESSON_REFERENCE',
        skill: 'writing',
        field: 'sections.writing.sourcePromptId',
        message: `Writing prompt '${writeDef.sourcePromptId}' was not found in dataset.`,
      });
    } else {
      const canonicalLevel = resolveLessonCefrLevel(prompt.level);
      if (canonicalLevel !== level) {
        issues.push({
          code: 'CEFR_LEVEL_MISMATCH',
          skill: 'writing',
          field: 'sections.writing.level',
          message: `Writing prompt level '${prompt.level}' does not match checkpoint level '${level}'.`,
        });
      }

      if (!prompt.prompt || prompt.prompt.trim().length === 0) {
        issues.push({
          code: 'EMPTY_WRITING_PROMPT',
          skill: 'writing',
          field: 'prompt.prompt',
          message: `Writing prompt '${prompt.id}' has empty task instructions.`,
        });
      }

      if (typeof writeDef.minWords !== 'number' || writeDef.minWords <= 0) {
        issues.push({
          code: 'INVALID_WORD_LIMITS',
          skill: 'writing',
          field: 'sections.writing.minWords',
          message: `Writing section has invalid minWords: ${writeDef.minWords}.`,
        });
      }
    }
  }

  return {
    level,
    isValid: issues.length === 0,
    issues,
  };
}

/**
 * Validates integrity across all 6 CEFR checkpoints in the system.
 */
export function validateAllCheckpointsIntegrity(): Record<CefrLevel, CheckpointValidationResult> {
  const result: Record<CefrLevel, CheckpointValidationResult> = {} as any;
  for (const lvl of CEFR_LEVELS_ORDER) {
    result[lvl] = validateCheckpointIntegrity(lvl);
  }
  return result;
}

// =========================================================================
// 4. RESOLVER ENGINE (ZERO-CRASH, PRE-INDEXED RESOLUTION)
// =========================================================================

/**
 * Resolves a complete, fully verified Checkpoint Assessment for a target CEFR level.
 *
 * Invariants:
 * - O(1) resolution via pre-indexed maps.
 * - Fails safe if data is corrupt; NEVER fakes replacement questions.
 */
export function resolveCheckpointAssessment(level: CefrLevel): ResolvedCheckpointAssessment {
  const def = CHECKPOINT_DEFINITIONS[level];
  if (!def) {
    throw new AssessmentIntegrityError(level, [
      {
        code: 'MISSING_LESSON_REFERENCE',
        field: 'level',
        message: `No checkpoint definition exists for CEFR level '${level}'.`,
      },
    ]);
  }

  // Validate integrity before returning resolved model
  const validation = validateCheckpointIntegrity(def);
  if (!validation.isValid) {
    throw new AssessmentIntegrityError(level, validation.issues);
  }

  // Section 1: Listening
  const listeningLesson = getIndexedListeningLesson(def.sections.listening.sourceLessonId)!;
  const selectedListenQuestions = def.sections.listening.selectedQuestionIds
    ? listeningLesson.questions.filter((q) => def.sections.listening.selectedQuestionIds!.includes(q.id))
    : listeningLesson.questions;

  const listeningSection: ResolvedListeningSection = {
    definition: def.sections.listening,
    lesson: listeningLesson,
    questions: selectedListenQuestions,
  };

  // Section 2: Reading
  const readingLesson = getIndexedReadingLesson(def.sections.reading.sourceLessonId)!;
  const selectedReadQuestions = def.sections.reading.selectedQuestionIds
    ? readingLesson.questions.filter((q) => def.sections.reading.selectedQuestionIds!.includes(q.id))
    : readingLesson.questions;

  const readingSection: ResolvedReadingSection = {
    definition: def.sections.reading,
    lesson: readingLesson,
    questions: selectedReadQuestions,
  };

  // Section 3: Speaking
  const speakingPrompt = getIndexedSpeakingPrompt(def.sections.speaking.sourcePromptId)!;
  const selectedTurns = def.sections.speaking.targetTurnIndices
    ? speakingPrompt.turns.filter((_, idx) => def.sections.speaking.targetTurnIndices!.includes(idx))
    : speakingPrompt.turns;

  const speakingSection: ResolvedSpeakingSection = {
    definition: def.sections.speaking,
    prompt: speakingPrompt,
    turns: selectedTurns,
  };

  // Section 4: Writing
  const writingPrompt = getIndexedWritingPrompt(def.sections.writing.sourcePromptId)!;
  const writingSection: ResolvedWritingSection = {
    definition: def.sections.writing,
    prompt: writingPrompt,
  };

  const allQuestionIds = [
    ...selectedListenQuestions.map((q) => q.id),
    ...selectedReadQuestions.map((q) => q.id),
  ];

  const totalQuestions = allQuestionIds.length;

  return {
    definition: def,
    level,
    sections: {
      listening: listeningSection,
      reading: readingSection,
      speaking: speakingSection,
      writing: writingSection,
    },
    totalQuestions,
    allQuestionIds,
  };
}

/**
 * Retrieves the raw Checkpoint Definition for a CEFR level.
 */
export function getCheckpointDefinition(level: CefrLevel): CheckpointDefinition {
  const def = CHECKPOINT_DEFINITIONS[level];
  if (!def) {
    throw new Error(`Checkpoint definition for level '${level}' does not exist.`);
  }
  return def;
}
