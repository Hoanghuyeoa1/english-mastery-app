// src/services/toeicValidator.ts
import {
  ToeicQuestion,
  ToeicQuestionGroup,
  ToeicPart,
  ToeicSkill,
  ToeicDifficulty,
} from '../types/toeic';

export interface ValidationError {
  code: string;
  field?: string;
  itemId?: string;
  groupId?: string;
  message: string;
  severity: 'error' | 'warning';
}

export interface DatasetValidationStats {
  totalQuestions: number;
  totalGroups: number;
  byPart: Record<ToeicPart, number>;
  bySkill: Record<ToeicSkill, number>;
  byDifficulty: Record<ToeicDifficulty | 'unspecified', number>;
}

export interface DatasetValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
  stats: DatasetValidationStats;
}

export const VALID_TOEIC_PARTS: ToeicPart[] = [
  'part1_photos',
  'part2_qna',
  'part3_conv',
  'part4_talks',
  'part5_grammar',
  'part6_text',
  'part7_reading',
  'speaking_read',
  'writing_email',
];

export const VALID_TOEIC_SKILLS: ToeicSkill[] = [
  'listening',
  'reading',
  'speaking',
  'writing',
];

export const VALID_TOEIC_DIFFICULTIES: ToeicDifficulty[] = ['easy', 'medium', 'hard'];

export const PART_TO_SKILL_MAP: Record<ToeicPart, ToeicSkill> = {
  part1_photos: 'listening',
  part2_qna: 'listening',
  part3_conv: 'listening',
  part4_talks: 'listening',
  part5_grammar: 'reading',
  part6_text: 'reading',
  part7_reading: 'reading',
  speaking_read: 'speaking',
  writing_email: 'writing',
};

/**
 * Tính toán độ tương đồng Jaccard giữa hai chuỗi văn bản theo tập hợp từ vựng
 */
export function calculateTokenJaccardSimilarity(text1: string, text2: string): number {
  if (!text1 || !text2) return 0;
  const words1 = new Set(
    text1
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .split(/\s+/)
      .filter(Boolean)
  );
  const words2 = new Set(
    text2
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .split(/\s+/)
      .filter(Boolean)
  );
  if (words1.size === 0 || words2.size === 0) return 0;

  let intersectionSize = 0;
  for (const w of words1) {
    if (words2.has(w)) intersectionSize++;
  }
  const unionSize = words1.size + words2.size - intersectionSize;
  return unionSize === 0 ? 0 : intersectionSize / unionSize;
}

/**
 * Kiểm tra tính hợp lệ của từng câu hỏi đơn lẻ
 */
export function validateToeicQuestion(
  q: ToeicQuestion,
  seenIds?: Set<string>
): ValidationError[] {
  const errors: ValidationError[] = [];

  // 1. Kiểm tra ID
  if (!q.id || typeof q.id !== 'string' || q.id.trim() === '') {
    errors.push({
      code: 'EMPTY_QUESTION_ID',
      field: 'id',
      message: 'Question ID không được để trống.',
      severity: 'error',
    });
  } else if (seenIds && seenIds.has(q.id)) {
    errors.push({
      code: 'DUPLICATE_QUESTION_ID',
      field: 'id',
      itemId: q.id,
      message: `Duplicate question ID phát hiện: "${q.id}". Question ID phải là duy nhất.`,
      severity: 'error',
    });
  }

  // 2. Kiểm tra part & skill
  if (!VALID_TOEIC_PARTS.includes(q.part)) {
    errors.push({
      code: 'INVALID_PART',
      field: 'part',
      itemId: q.id,
      message: `Invalid part: "${q.part}". Part phải thuộc 9 phần chuẩn TOEIC.`,
      severity: 'error',
    });
  }

  if (!VALID_TOEIC_SKILLS.includes(q.skill)) {
    errors.push({
      code: 'INVALID_SKILL',
      field: 'skill',
      itemId: q.id,
      message: `Invalid skill: "${q.skill}". Skill phải là listening, reading, speaking hoặc writing.`,
      severity: 'error',
    });
  } else if (q.part && PART_TO_SKILL_MAP[q.part] && q.skill !== PART_TO_SKILL_MAP[q.part]) {
    errors.push({
      code: 'SKILL_PART_MISMATCH',
      field: 'skill',
      itemId: q.id,
      message: `Kỹ năng "${q.skill}" không khớp với phần "${q.part}". Kỹ năng đúng: "${PART_TO_SKILL_MAP[q.part]}".`,
      severity: 'error',
    });
  }

  // 3. Kiểm tra difficulty và estimatedDifficulty bắt buộc
  if (!q.difficulty) {
    errors.push({
      code: 'MISSING_DIFFICULTY',
      field: 'difficulty',
      itemId: q.id,
      message: `Câu hỏi ${q.id} thiếu difficulty (bắt buộc: easy, medium hoặc hard).`,
      severity: 'error',
    });
  } else if (!VALID_TOEIC_DIFFICULTIES.includes(q.difficulty)) {
    errors.push({
      code: 'INVALID_DIFFICULTY',
      field: 'difficulty',
      itemId: q.id,
      message: `Invalid difficulty: "${q.difficulty}". Phải là easy, medium hoặc hard.`,
      severity: 'error',
    });
  }

  if (q.estimatedDifficulty === undefined || q.estimatedDifficulty === null) {
    errors.push({
      code: 'MISSING_ESTIMATED_DIFFICULTY',
      field: 'estimatedDifficulty',
      itemId: q.id,
      message: `Câu hỏi ${q.id} thiếu estimatedDifficulty (bắt buộc từ 0 đến 990).`,
      severity: 'error',
    });
  } else if (
    typeof q.estimatedDifficulty !== 'number' ||
    Number.isNaN(q.estimatedDifficulty) ||
    q.estimatedDifficulty < 0 ||
    q.estimatedDifficulty > 990
  ) {
    errors.push({
      code: 'INVALID_ESTIMATED_DIFFICULTY',
      field: 'estimatedDifficulty',
      itemId: q.id,
      message: `Estimated difficulty "${q.estimatedDifficulty}" không hợp lệ (phải từ 0 đến 990).`,
      severity: 'error',
    });
  }

  // 4. Kiểm tra Question Text, Explanation, Translation
  if (!q.questionText || typeof q.questionText !== 'string' || q.questionText.trim() === '') {
    errors.push({
      code: 'EMPTY_QUESTION_TEXT',
      field: 'questionText',
      itemId: q.id,
      message: 'Question text không được để trống.',
      severity: 'error',
    });
  }

  if (!q.explanation || typeof q.explanation !== 'string' || q.explanation.trim() === '') {
    errors.push({
      code: 'EMPTY_EXPLANATION',
      field: 'explanation',
      itemId: q.id,
      message: 'Explanation không được để trống.',
      severity: 'error',
    });
  }

  if (
    !q.vietnameseTranslation ||
    typeof q.vietnameseTranslation !== 'string' ||
    q.vietnameseTranslation.trim() === ''
  ) {
    errors.push({
      code: 'EMPTY_TRANSLATION',
      field: 'vietnameseTranslation',
      itemId: q.id,
      message: 'Vietnamese translation không được để trống.',
      severity: 'error',
    });
  }

  // 5. Kiểm tra metadata chuyên sâu bắt buộc (Topic, SubSkill, QuestionType, VocabularyTags, GrammarTags)
  if (!q.topic || typeof q.topic !== 'string' || q.topic.trim() === '') {
    errors.push({
      code: 'EMPTY_TOPIC',
      field: 'topic',
      itemId: q.id,
      message: `Câu hỏi ${q.id} thiếu topic.`,
      severity: 'error',
    });
  }

  if (!q.subSkill || typeof q.subSkill !== 'string' || q.subSkill.trim() === '') {
    errors.push({
      code: 'EMPTY_SUB_SKILL',
      field: 'subSkill',
      itemId: q.id,
      message: `Câu hỏi ${q.id} thiếu subSkill.`,
      severity: 'error',
    });
  }

  if (!q.questionType || typeof q.questionType !== 'string' || q.questionType.trim() === '') {
    errors.push({
      code: 'EMPTY_QUESTION_TYPE',
      field: 'questionType',
      itemId: q.id,
      message: `Câu hỏi ${q.id} thiếu questionType.`,
      severity: 'error',
    });
  }

  if (!Array.isArray(q.vocabularyTags) || q.vocabularyTags.length === 0) {
    errors.push({
      code: 'MISSING_VOCABULARY_TAGS',
      field: 'vocabularyTags',
      itemId: q.id,
      message: `Câu hỏi ${q.id} thiếu danh sách vocabularyTags (mảng không được rỗng).`,
      severity: 'error',
    });
  }

  if (!Array.isArray(q.grammarTags) || q.grammarTags.length === 0) {
    errors.push({
      code: 'MISSING_GRAMMAR_TAGS',
      field: 'grammarTags',
      itemId: q.id,
      message: `Câu hỏi ${q.id} thiếu danh sách grammarTags (mảng không được rỗng).`,
      severity: 'error',
    });
  }

  // 6. Kiểm tra Group ID bắt buộc cho các Part nhóm (Part 3, 4, 6, 7)
  const GROUPED_PARTS_LIST: ToeicPart[] = [
    'part3_conv',
    'part4_talks',
    'part6_text',
    'part7_reading',
  ];
  if (
    GROUPED_PARTS_LIST.includes(q.part) &&
    (!q.groupId || typeof q.groupId !== 'string' || q.groupId.trim() === '')
  ) {
    errors.push({
      code: 'MISSING_GROUP_ID',
      field: 'groupId',
      itemId: q.id,
      message: `Câu hỏi ${q.id} thuộc phần ${q.part} bắt buộc phải có groupId liên kết với nhóm câu hỏi.`,
      severity: 'error',
    });
  }

  // 5. Kiểm tra Options & Correct Answer cho Listening & Reading
  const isLR = q.skill === 'listening' || q.skill === 'reading';
  if (isLR) {
    if (!Array.isArray(q.options) || q.options.length < 3) {
      errors.push({
        code: 'INSUFFICIENT_OPTIONS',
        field: 'options',
        itemId: q.id,
        message: `Câu hỏi ${q.id} (${q.part}) phải có ít nhất 3 lựa chọn (hiện có ${q.options?.length || 0}).`,
        severity: 'error',
      });
    } else {
      // Kiểm tra option rỗng
      const hasEmptyOption = q.options.some((opt) => typeof opt !== 'string' || opt.trim() === '');
      if (hasEmptyOption) {
        errors.push({
          code: 'EMPTY_OPTION_TEXT',
          field: 'options',
          itemId: q.id,
          message: `Câu hỏi ${q.id} chứa lựa chọn rỗng.`,
          severity: 'error',
        });
      }

      // Part 2 có đúng 3 lựa chọn (A, B, C); các Part khác có 4 lựa chọn (A, B, C, D)
      if (q.part === 'part2_qna' && q.options.length > 3) {
        errors.push({
          code: 'TOO_MANY_OPTIONS_PART2',
          field: 'options',
          itemId: q.id,
          message: `Part 2 chỉ có 3 lựa chọn A, B, C nhưng câu hỏi ${q.id} có ${q.options.length} lựa chọn.`,
          severity: 'warning',
        });
      }

      // Kiểm tra correctAnswer
      if (!q.correctAnswer || typeof q.correctAnswer !== 'string') {
        errors.push({
          code: 'MISSING_CORRECT_ANSWER',
          field: 'correctAnswer',
          itemId: q.id,
          message: `Câu hỏi ${q.id} thiếu correctAnswer.`,
          severity: 'error',
        });
      } else {
        const validLetterAnswers = ['A', 'B', 'C', 'D'];
        const ansLetter = q.correctAnswer.trim().toUpperCase();

        if (q.part === 'part2_qna' && ansLetter === 'D') {
          errors.push({
            code: 'INVALID_ANSWER_FOR_PART2',
            field: 'correctAnswer',
            itemId: q.id,
            message: `Part 2 chỉ có A, B, C; không thể có đáp án D (câu ${q.id}).`,
            severity: 'error',
          });
        }

        // Đáp án phải là chữ cái A-D hoặc khớp chính xác một trong các options
        const letterIndex = validLetterAnswers.indexOf(ansLetter);
        const matchesOptionLetter = letterIndex !== -1 && letterIndex < q.options.length;
        const matchesOptionContent = q.options.some(
          (opt) => opt.trim() === q.correctAnswer || opt.startsWith(`${ansLetter}.`)
        );

        if (!matchesOptionLetter && !matchesOptionContent) {
          errors.push({
            code: 'CORRECT_ANSWER_NOT_IN_OPTIONS',
            field: 'correctAnswer',
            itemId: q.id,
            message: `Đáp án "${q.correctAnswer}" của câu ${q.id} không nằm trong danh sách lựa chọn.`,
            severity: 'error',
          });
        }
      }
    }
  }

  // 6. Kiểm tra Speaking & Writing Tasks
  if (q.skill === 'speaking' || q.skill === 'writing') {
    if (!q.passage || typeof q.passage !== 'string' || q.passage.trim() === '') {
      errors.push({
        code: 'MISSING_TASK_PASSAGE',
        field: 'passage',
        itemId: q.id,
        message: `Task ${q.skill} (${q.id}) thiếu passage / đề bài bối cảnh văn bản.`,
        severity: 'error',
      });
    }
  }

  // 7. Kiểm tra Part 1 ảnh
  if (q.part === 'part1_photos' && (!q.imageUrl || q.imageUrl.trim() === '')) {
    errors.push({
      code: 'MISSING_PHOTO_IMAGE',
      field: 'imageUrl',
      itemId: q.id,
      message: `Part 1 question (${q.id}) thiếu imageUrl trực quan cho bức ảnh.`,
      severity: 'error',
    });
  }

  return errors;
}

/**
 * Kiểm tra tính hợp lệ của từng Question Group
 */
export function validateToeicGroup(
  group: ToeicQuestionGroup,
  questionMap: Map<string, ToeicQuestion>,
  seenGroupIds?: Set<string>,
  seenQuestionInGroups?: Map<string, string> // questionId -> groupId
): ValidationError[] {
  const errors: ValidationError[] = [];

  // 1. Group ID
  if (!group.id || typeof group.id !== 'string' || group.id.trim() === '') {
    errors.push({
      code: 'EMPTY_GROUP_ID',
      field: 'id',
      message: 'Group ID không được để trống.',
      severity: 'error',
    });
  } else if (seenGroupIds && seenGroupIds.has(group.id)) {
    errors.push({
      code: 'DUPLICATE_GROUP_ID',
      field: 'id',
      groupId: group.id,
      message: `Duplicate group ID phát hiện: "${group.id}". Group ID phải là duy nhất.`,
      severity: 'error',
    });
  }

  // 2. Part & Skill
  if (!VALID_TOEIC_PARTS.includes(group.part)) {
    errors.push({
      code: 'INVALID_GROUP_PART',
      field: 'part',
      groupId: group.id,
      message: `Invalid group part: "${group.part}".`,
      severity: 'error',
    });
  }

  if (!VALID_TOEIC_SKILLS.includes(group.skill)) {
    errors.push({
      code: 'INVALID_GROUP_SKILL',
      field: 'skill',
      groupId: group.id,
      message: `Invalid group skill: "${group.skill}".`,
      severity: 'error',
    });
  }

  // 3. Question IDs integrity
  if (!Array.isArray(group.questionIds) || group.questionIds.length === 0) {
    errors.push({
      code: 'GROUP_MISSING_QUESTIONS',
      field: 'questionIds',
      groupId: group.id,
      message: `Nhóm ${group.id} không có câu hỏi nào (questionIds rỗng).`,
      severity: 'error',
    });
  } else {
    // Kiểm tra câu hỏi trùng trong cùng nhóm
    const localSeen = new Set<string>();
    group.questionIds.forEach((qId) => {
      if (localSeen.has(qId)) {
        errors.push({
          code: 'DUPLICATE_QUESTION_IN_SAME_GROUP',
          field: 'questionIds',
          groupId: group.id,
          itemId: qId,
          message: `Câu hỏi ${qId} bị lặp lại nhiều lần trong nhóm ${group.id}.`,
          severity: 'error',
        });
      }
      localSeen.add(qId);

      // Kiểm tra câu hỏi thuộc nhóm khác (duplicate membership)
      if (seenQuestionInGroups) {
        if (seenQuestionInGroups.has(qId)) {
          const otherGroupId = seenQuestionInGroups.get(qId);
          errors.push({
            code: 'DUPLICATE_GROUP_MEMBERSHIP',
            field: 'questionIds',
            groupId: group.id,
            itemId: qId,
            message: `Câu hỏi ${qId} vừa thuộc nhóm "${otherGroupId}" vừa thuộc nhóm "${group.id}". Một câu chỉ được thuộc 1 nhóm duy nhất.`,
            severity: 'error',
          });
        } else {
          seenQuestionInGroups.set(qId, group.id);
        }
      }

      // Kiểm tra orphan question: ID tồn tại trong group nhưng không có trong question bank
      const questionItem = questionMap.get(qId);
      if (!questionItem) {
        errors.push({
          code: 'ORPHAN_QUESTION_IN_GROUP',
          field: 'questionIds',
          groupId: group.id,
          itemId: qId,
          message: `Group ${group.id} tham chiếu tới câu hỏi "${qId}" không tồn tại trong ngân hàng đề.`,
          severity: 'error',
        });
      } else {
        // Kiểm tra tính nhất quán giữa question và group
        if (questionItem.part !== group.part) {
          errors.push({
            code: 'QUESTION_GROUP_PART_MISMATCH',
            groupId: group.id,
            itemId: qId,
            message: `Part của câu ${qId} (${questionItem.part}) không khớp với part của nhóm ${group.id} (${group.part}).`,
            severity: 'error',
          });
        }
        if (questionItem.groupId && questionItem.groupId !== group.id) {
          errors.push({
            code: 'QUESTION_GROUP_ID_MISMATCH',
            groupId: group.id,
            itemId: qId,
            message: `Câu ${qId} chỉ định groupId="${questionItem.groupId}" nhưng lại nằm trong nhóm "${group.id}".`,
            severity: 'error',
          });
        }
      }
    });
  }

  // 4. Passage / Audio Script integrity
  const isReadingGroup = group.part === 'part6_text' || group.part === 'part7_reading';
  const isListeningGroup = group.part === 'part3_conv' || group.part === 'part4_talks';

  if (isReadingGroup && (!group.passageText || group.passageText.trim() === '')) {
    // Nếu group không có passageText, kiểm tra xem từng question có passage riêng không
    const allHavePassage = group.questionIds.every((qId) => {
      const q = questionMap.get(qId);
      return q && q.passage && q.passage.trim() !== '';
    });
    if (!allHavePassage) {
      errors.push({
        code: 'MISSING_GROUP_PASSAGE',
        field: 'passageText',
        groupId: group.id,
        message: `Reading group ${group.id} (${group.part}) thiếu passageText cho bài đọc.`,
        severity: 'error',
      });
    }
  }

  if (isListeningGroup && (!group.audioScript || group.audioScript.trim() === '')) {
    const allHaveAudio = group.questionIds.every((qId) => {
      const q = questionMap.get(qId);
      return q && q.audioScript && q.audioScript.trim() !== '';
    });
    if (!allHaveAudio) {
      errors.push({
        code: 'MISSING_GROUP_AUDIO_SCRIPT',
        field: 'audioScript',
        groupId: group.id,
        message: `Listening group ${group.id} (${group.part}) thiếu audioScript cho hội thoại/bài nói.`,
        severity: 'error',
      });
    }
  }

  return errors;
}

/**
 * Validator toàn diện cho toàn bộ dataset ngân hàng câu hỏi & các nhóm
 */
export function validateToeicDataset(
  questions: ToeicQuestion[],
  groups: ToeicQuestionGroup[] = []
): DatasetValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];

  const seenQuestionIds = new Set<string>();
  const questionMap = new Map<string, ToeicQuestion>();

  // Thống kê phân bố
  const byPart: Record<ToeicPart, number> = {
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

  const bySkill: Record<ToeicSkill, number> = {
    listening: 0,
    reading: 0,
    speaking: 0,
    writing: 0,
  };

  const byDifficulty: Record<ToeicDifficulty | 'unspecified', number> = {
    easy: 0,
    medium: 0,
    hard: 0,
    unspecified: 0,
  };

  // 1. Kiểm tra từng câu hỏi
  questions.forEach((q) => {
    const qErrors = validateToeicQuestion(q, seenQuestionIds);
    qErrors.forEach((err) => {
      if (err.severity === 'error') errors.push(err);
      else warnings.push(err);
    });

    if (q.id) {
      seenQuestionIds.add(q.id);
      questionMap.set(q.id, q);
    }

    if (VALID_TOEIC_PARTS.includes(q.part)) {
      byPart[q.part]++;
    }
    if (VALID_TOEIC_SKILLS.includes(q.skill)) {
      bySkill[q.skill]++;
    }
    if (q.difficulty && VALID_TOEIC_DIFFICULTIES.includes(q.difficulty)) {
      byDifficulty[q.difficulty]++;
    } else {
      byDifficulty.unspecified++;
    }
  });

  // 2. Kiểm tra từng group
  const seenGroupIds = new Set<string>();
  const seenQuestionInGroups = new Map<string, string>();

  groups.forEach((g) => {
    const gErrors = validateToeicGroup(g, questionMap, seenGroupIds, seenQuestionInGroups);
    gErrors.forEach((err) => {
      if (err.severity === 'error') errors.push(err);
      else warnings.push(err);
    });
    if (g.id) {
      seenGroupIds.add(g.id);
    }
  });

  // 3. Kiểm tra câu hỏi có groupId nhưng group không tồn tại (orphan group pointer)
  questions.forEach((q) => {
    if (q.groupId && !seenGroupIds.has(q.groupId)) {
      errors.push({
        code: 'ORPHAN_GROUP_POINTER',
        field: 'groupId',
        itemId: q.id,
        groupId: q.groupId,
        message: `Câu hỏi ${q.id} chỉ định groupId="${q.groupId}" nhưng không tìm thấy group này trong dataset.`,
        severity: 'error',
      });
    }
  });

  // 4. Kiểm tra trùng lặp văn bản câu hỏi (Exact duplicate questionText)
  // Lưu ý: Part 1 và Part 2 dùng chung chỉ dẫn nghe chuẩn, nên kiểm tra audioScript thay thế
  const seenQuestionTexts = new Map<string, string>(); // normalizedText -> questionId
  const seenListeningAudioScripts = new Map<string, string>(); // normalizedAudio -> questionId

  questions.forEach((q) => {
    if (q.part !== 'part1_photos' && q.part !== 'part2_qna' && q.questionText) {
      const normText = q.questionText.trim().toLowerCase().replace(/\s+/g, ' ');
      if (seenQuestionTexts.has(normText)) {
        errors.push({
          code: 'DUPLICATE_QUESTION_TEXT',
          field: 'questionText',
          itemId: q.id,
          message: `Phát hiện câu hỏi "${q.id}" có questionText trùng lặp hoàn toàn với câu "${seenQuestionTexts.get(normText)}".`,
          severity: 'error',
        });
      } else {
        seenQuestionTexts.set(normText, q.id);
      }
    }

    // Kiểm tra trùng audioScript cho Part 1 & Part 2
    if ((q.part === 'part1_photos' || q.part === 'part2_qna') && q.audioScript && q.audioScript.trim()) {
      const normAudio = q.audioScript.trim().toLowerCase().replace(/\s+/g, ' ');
      if (seenListeningAudioScripts.has(normAudio)) {
        errors.push({
          code: 'DUPLICATE_AUDIO_SCRIPT',
          field: 'audioScript',
          itemId: q.id,
          message: `Phát hiện câu hỏi "${q.id}" (${q.part}) có audioScript trùng lặp hoàn toàn với câu "${seenListeningAudioScripts.get(normAudio)}".`,
          severity: 'error',
        });
      } else {
        seenListeningAudioScripts.set(normAudio, q.id);
      }
    }
  });

  // 5. Kiểm tra trùng lặp trong nhóm câu hỏi (Duplicate Group Passage & AudioScript)
  const seenGroupPassages = new Map<string, string>(); // normalizedPassage -> groupId
  const seenGroupAudioScripts = new Map<string, string>(); // normalizedAudioScript -> groupId

  groups.forEach((g) => {
    if (g.passageText && g.passageText.trim()) {
      const normPassage = g.passageText.trim().toLowerCase().replace(/\s+/g, ' ');
      if (seenGroupPassages.has(normPassage)) {
        errors.push({
          code: 'DUPLICATE_GROUP_PASSAGE',
          field: 'passageText',
          groupId: g.id,
          message: `Phát hiện nhóm "${g.id}" có passageText trùng lặp hoàn toàn với nhóm "${seenGroupPassages.get(normPassage)}".`,
          severity: 'error',
        });
      } else {
        seenGroupPassages.set(normPassage, g.id);
      }
    }

    if (g.audioScript && g.audioScript.trim()) {
      const normAudio = g.audioScript.trim().toLowerCase().replace(/\s+/g, ' ');
      if (seenGroupAudioScripts.has(normAudio)) {
        errors.push({
          code: 'DUPLICATE_GROUP_AUDIO_SCRIPT',
          field: 'audioScript',
          groupId: g.id,
          message: `Phát hiện nhóm "${g.id}" có audioScript trùng lặp hoàn toàn với nhóm "${seenGroupAudioScripts.get(normAudio)}".`,
          severity: 'error',
        });
      } else {
        seenGroupAudioScripts.set(normAudio, g.id);
      }
    }
  });

  // 6. Near-duplicate heuristics (phát hiện copy-paste chỉ sửa 1-2 từ)
  // Bỏ qua Part 1, Part 2 (chỉ dẫn cố định) và Part 6 cloze (chỉ dẫn điền chỗ trống số [ ___X___ ])
  const questionsToCheckNearDup = questions.filter(
    (q) => q.part !== 'part1_photos' && q.part !== 'part2_qna' && q.part !== 'part6_text'
  );

  for (let i = 0; i < questionsToCheckNearDup.length; i++) {
    for (let j = i + 1; j < questionsToCheckNearDup.length; j++) {
      const q1 = questionsToCheckNearDup[i];
      const q2 = questionsToCheckNearDup[j];
      const norm1 = q1.questionText.trim().toLowerCase().replace(/\s+/g, ' ');
      const norm2 = q2.questionText.trim().toLowerCase().replace(/\s+/g, ' ');
      if (norm1 === norm2) continue; // Đã xử lý ở mục 4 DUPLICATE_QUESTION_TEXT

      const sim = calculateTokenJaccardSimilarity(q1.questionText, q2.questionText);
      if (sim >= 0.85) {
        warnings.push({
          code: 'NEAR_DUPLICATE_QUESTION_TEXT',
          field: 'questionText',
          itemId: q2.id,
          message: `Cảnh báo near-duplicate: Câu hỏi "${q2.id}" có độ tương đồng ${(sim * 100).toFixed(0)}% với câu "${q1.id}".`,
          severity: 'warning',
        });
      }
    }
  }

  // Near-duplicate cho passage và audioScript của group
  for (let i = 0; i < groups.length; i++) {
    for (let j = i + 1; j < groups.length; j++) {
      const g1 = groups[i];
      const g2 = groups[j];

      if (g1.passageText && g2.passageText && g1.passageText.trim() !== g2.passageText.trim()) {
        const sim = calculateTokenJaccardSimilarity(g1.passageText, g2.passageText);
        if (sim >= 0.85) {
          warnings.push({
            code: 'NEAR_DUPLICATE_GROUP_PASSAGE',
            field: 'passageText',
            groupId: g2.id,
            message: `Cảnh báo near-duplicate passage: Nhóm "${g2.id}" có bài đọc tương đồng ${(sim * 100).toFixed(0)}% với nhóm "${g1.id}".`,
            severity: 'warning',
          });
        }
      }

      if (g1.audioScript && g2.audioScript && g1.audioScript.trim() !== g2.audioScript.trim()) {
        const sim = calculateTokenJaccardSimilarity(g1.audioScript, g2.audioScript);
        if (sim >= 0.85) {
          warnings.push({
            code: 'NEAR_DUPLICATE_GROUP_AUDIO_SCRIPT',
            field: 'audioScript',
            groupId: g2.id,
            message: `Cảnh báo near-duplicate audio: Nhóm "${g2.id}" có kịch bản nghe tương đồng ${(sim * 100).toFixed(0)}% với nhóm "${g1.id}".`,
            severity: 'warning',
          });
        }
      }
    }
  }

  const stats: DatasetValidationStats = {
    totalQuestions: questions.length,
    totalGroups: groups.length,
    byPart,
    bySkill,
    byDifficulty,
  };

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    stats,
  };
}

/**
 * Adapter chuẩn hóa backward-compatible cho các câu hỏi legacy thiếu metadata
 */
export function enrichLegacyQuestion(q: ToeicQuestion): ToeicQuestion {
  const enriched: ToeicQuestion = { ...q };

  // Gán skill tự động theo part nếu bị thiếu hoặc sai
  if (!enriched.skill || !PART_TO_SKILL_MAP[enriched.part]) {
    enriched.skill = PART_TO_SKILL_MAP[enriched.part] || 'reading';
  }

  // Gán default difficulty nếu chưa có
  if (!enriched.difficulty) {
    if (enriched.part === 'part1_photos' || enriched.part === 'part2_qna') {
      enriched.difficulty = 'easy';
    } else if (enriched.part === 'part5_grammar' || enriched.part === 'part6_text') {
      enriched.difficulty = 'medium';
    } else {
      enriched.difficulty = 'medium';
    }
  }

  // Gán default estimatedDifficulty nếu chưa có
  if (enriched.estimatedDifficulty === undefined) {
    switch (enriched.difficulty) {
      case 'easy':
        enriched.estimatedDifficulty = 400;
        break;
      case 'medium':
        enriched.estimatedDifficulty = 600;
        break;
      case 'hard':
        enriched.estimatedDifficulty = 800;
        break;
      default:
        enriched.estimatedDifficulty = 500;
    }
  }

  // Gán default questionType
  if (!enriched.questionType) {
    switch (enriched.part) {
      case 'part1_photos':
        enriched.questionType = 'photo_action';
        break;
      case 'part2_qna':
        enriched.questionType = 'wh_question';
        break;
      case 'part3_conv':
      case 'part4_talks':
        enriched.questionType = 'detail';
        break;
      case 'part5_grammar':
        enriched.questionType = 'grammar_pos';
        break;
      case 'part6_text':
        enriched.questionType = 'vocab_meaning';
        break;
      case 'part7_reading':
        enriched.questionType = 'specific_detail';
        break;
      case 'speaking_read':
        enriched.questionType = 'speaking_read_aloud';
        break;
      case 'writing_email':
        enriched.questionType = 'writing_email_response';
        break;
      default:
        enriched.questionType = 'general';
    }
  }

  // Gán default topic và subSkill nếu chưa có
  if (!enriched.topic) {
    enriched.topic = 'general_workplace';
  }
  if (!enriched.subSkill) {
    enriched.subSkill = 'detail_understanding';
  }

  // Gán default vocabularyTags và grammarTags nếu chưa có
  if (!Array.isArray(enriched.vocabularyTags) || enriched.vocabularyTags.length === 0) {
    enriched.vocabularyTags = ['workplace'];
  }
  if (!Array.isArray(enriched.grammarTags) || enriched.grammarTags.length === 0) {
    enriched.grammarTags = ['general'];
  }

  return enriched;
}

/**
 * Tìm group tương ứng của câu hỏi
 */
export function resolveQuestionGroup(
  questionId: string,
  questions: ToeicQuestion[],
  groups: ToeicQuestionGroup[]
): ToeicQuestionGroup | undefined {
  const q = questions.find((item) => item.id === questionId);
  if (!q) return undefined;

  if (q.groupId) {
    return groups.find((g) => g.id === q.groupId);
  }

  return groups.find((g) => g.questionIds.includes(questionId));
}

/**
 * Tìm danh sách câu hỏi thuộc một group
 */
export function resolveGroupQuestions(
  groupId: string,
  questions: ToeicQuestion[],
  groups: ToeicQuestionGroup[]
): ToeicQuestion[] {
  const group = groups.find((g) => g.id === groupId);
  if (!group) return [];

  const qMap = new Map(questions.map((q) => [q.id, q]));
  return group.questionIds.map((id) => qMap.get(id)).filter((q): q is ToeicQuestion => Boolean(q));
}
