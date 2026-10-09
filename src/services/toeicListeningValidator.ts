// src/services/toeicListeningValidator.ts
import {
  NormalizedListeningDataset,
  NormalizedToeicListeningGroup,
  ToeicListeningQuestion,
  ToeicListeningValidationReport,
  Part1ListeningGroup,
} from '../types/toeicListening';

export interface ValidateListeningOptions {
  /** Cho phép nới lỏng số câu hỏi trong nhóm Part 3/4 (mặc định bắt buộc 3 câu theo chuẩn ETS) */
  allowFlexibleGroupSize?: boolean;
}

/**
 * Validator kiểm định tính toàn vẹn của mô hình Listening chuẩn hóa.
 *
 * Tiêu chí kiểm định nghiêm ngặt:
 * 1. Part 1: Bắt buộc có imageUrl hợp lệ, audio/tts, đúng 4 options, đáp án A-D.
 * 2. Part 2: Bắt buộc có kịch bản thoại/audio, đúng 3 options, đáp án A-C.
 * 3. Part 3 & 4:
 *    - Đúng 3 câu hỏi con theo chuẩn ETS.
 *    - Duy nhất 1 audio identity (audioGroupId).
 *    - Mọi câu hỏi con trong nhóm đều có cùng groupId và audioGroupId.
 *    - Không trùng lặp thành viên (no duplicate question membership).
 *    - Không có câu hỏi mồ côi (no orphan questions).
 * 4. ID Uniqueness: Tất cả question ID và group ID phải là duy nhất.
 */
export function validateToeicListeningDataset(
  dataset: NormalizedListeningDataset,
  options?: ValidateListeningOptions
): ToeicListeningValidationReport {
  const errors: string[] = [];
  const warnings: string[] = [];

  const { groups, questions, groupById, questionById } = dataset;
  const allowFlexibleGroupSize = options?.allowFlexibleGroupSize === true;

  // 1. Kiểm tra tính duy nhất của Group ID
  const seenGroupIds = new Set<string>();
  const seenAudioGroupIds = new Set<string>();

  for (const group of groups) {
    if (!group.id || typeof group.id !== 'string' || group.id.trim() === '') {
      errors.push('Phát hiện group có ID bị rỗng hoặc không hợp lệ.');
      continue;
    }

    if (seenGroupIds.has(group.id)) {
      errors.push(`Trùng lặp Group ID: "${group.id}" xuất hiện nhiều hơn 1 lần.`);
    }
    seenGroupIds.add(group.id);

    // Kiểm tra Audio Group ID
    if (!group.audioGroupId || typeof group.audioGroupId !== 'string') {
      errors.push(`Group "${group.id}" thiếu trường audioGroupId bắt buộc.`);
    } else {
      if (seenAudioGroupIds.has(group.audioGroupId)) {
        warnings.push(
          `Cảnh báo trùng lặp audioGroupId: "${group.audioGroupId}" được sử dụng bởi nhiều group.`
        );
      }
      seenAudioGroupIds.add(group.audioGroupId);
    }

    // Kiểm tra audioSource
    if (!group.audioSource) {
      errors.push(`Group "${group.id}" không có đối tượng audioSource.`);
    } else {
      const { sourceType, audioUrl, audioScript } = group.audioSource;
      if (sourceType === 'recorded') {
        if (!audioUrl || typeof audioUrl !== 'string' || audioUrl.trim().length === 0) {
          errors.push(`Group "${group.id}" khai báo sourceType là "recorded" nhưng không có audioUrl.`);
        }
      } else if (sourceType === 'tts') {
        if (!audioScript || typeof audioScript !== 'string' || audioScript.trim().length === 0) {
          errors.push(`Group "${group.id}" khai báo sourceType là "tts" nhưng audioScript bị rỗng.`);
        }
      } else {
        warnings.push(`Group "${group.id}" có nguồn âm thanh là "none".`);
      }
    }

    // Kiểm tra Transcript
    if (!group.transcript || !group.transcript.fullText || group.transcript.fullText.trim().length === 0) {
      warnings.push(`Group "${group.id}" không có nội dung transcript hoặc transcript bị rỗng.`);
    }

    // -------------------------------------------------------------------------
    // KIỂM TRA ĐẶC THÙ THEO TỪNG PART
    // -------------------------------------------------------------------------
    if (group.part === 'part1_photos') {
      const p1 = group as Part1ListeningGroup;
      if (!p1.imageUrl || typeof p1.imageUrl !== 'string' || p1.imageUrl.trim().length === 0) {
        errors.push(`Part 1 Group "${group.id}" bắt buộc phải có imageUrl nhưng giá trị bị rỗng.`);
      } else {
        const lowerUrl = p1.imageUrl.toLowerCase();
        if (
          !lowerUrl.startsWith('http://') &&
          !lowerUrl.startsWith('https://') &&
          !lowerUrl.startsWith('data:') &&
          !lowerUrl.startsWith('/')
        ) {
          warnings.push(`Part 1 Group "${group.id}" có imageUrl không phải URL chuẩn: "${p1.imageUrl}".`);
        }
      }

      if (group.questionIds.length !== 1) {
        errors.push(
          `Part 1 Group "${group.id}" bắt buộc có đúng 1 câu hỏi con, nhưng có ${group.questionIds.length} câu.`
        );
      }
    } else if (group.part === 'part2_qna') {
      if (group.questionIds.length !== 1) {
        errors.push(
          `Part 2 Group "${group.id}" bắt buộc có đúng 1 câu hỏi con, nhưng có ${group.questionIds.length} câu.`
        );
      }
    } else if (group.part === 'part3_conv' || group.part === 'part4_talks') {
      const expectedSize = 3;
      if (!allowFlexibleGroupSize && group.questionIds.length !== expectedSize) {
        errors.push(
          `${group.part === 'part3_conv' ? 'Part 3' : 'Part 4'} Group "${group.id}" vi phạm quy chuẩn ETS: phải có chính xác 3 câu hỏi con (hiện tại có: ${group.questionIds.length}).`
        );
      }
    }
  }

  // 2. Kiểm tra tính duy nhất của Question ID và Question Membership
  const seenQuestionIds = new Set<string>();
  const questionToGroupMembership = new Map<string, string>();

  // Thu thập questionIds từ tất cả các group để tìm membership duplication
  for (const group of groups) {
    for (const qId of group.questionIds) {
      if (questionToGroupMembership.has(qId)) {
        errors.push(
          `Vi phạm cấu trúc nhóm: Câu hỏi "${qId}" thuộc về nhiều hơn một nhóm (Group "${questionToGroupMembership.get(qId)}" và Group "${group.id}").`
        );
      } else {
        questionToGroupMembership.set(qId, group.id);
      }
    }
  }

  let orphanedCount = 0;

  for (const q of questions) {
    if (!q.id || typeof q.id !== 'string' || q.id.trim() === '') {
      errors.push('Phát hiện câu hỏi có ID bị rỗng.');
      continue;
    }

    if (seenQuestionIds.has(q.id)) {
      errors.push(`Trùng lặp Question ID: "${q.id}" xuất hiện nhiều lần trong danh sách câu hỏi.`);
    }
    seenQuestionIds.add(q.id);

    // Kiểm tra câu hỏi mồ côi (Orphan Check)
    if (!q.groupId || !groupById.has(q.groupId)) {
      errors.push(`Câu hỏi "${q.id}" là mồ côi (groupId "${q.groupId}" không tồn tại trong danh sách nhóm).`);
      orphanedCount++;
    } else {
      const parentGroup = groupById.get(q.groupId)!;

      // Invariant Check: groupId và audioGroupId phải đồng nhất tuyệt đối với group cha
      if (q.audioGroupId !== parentGroup.audioGroupId) {
        errors.push(
          `Vi phạm Invariant: Câu hỏi "${q.id}" có audioGroupId ("${q.audioGroupId}") không khớp với audioGroupId của nhóm cha "${parentGroup.id}" ("${parentGroup.audioGroupId}").`
        );
      }

      if (!parentGroup.questionIds.includes(q.id)) {
        errors.push(
          `Câu hỏi "${q.id}" trỏ về nhóm "${parentGroup.id}" nhưng nhóm này không chứa "${q.id}" trong questionIds.`
        );
      }
    }

    // Kiểm tra Options & Đáp án
    if (q.part === 'part2_qna') {
      if (!Array.isArray(q.options) || q.options.length !== 3) {
        errors.push(
          `Câu hỏi Part 2 "${q.id}" phải có đúng 3 phương án lựa chọn (A, B, C), hiện có ${q.options?.length || 0}.`
        );
      }
      if (!['A', 'B', 'C'].includes(q.correctAnswer)) {
        errors.push(
          `Câu hỏi Part 2 "${q.id}" có đáp án "${q.correctAnswer}" không hợp lệ (chỉ chấp nhận 'A', 'B', hoặc 'C').`
        );
      }
    } else {
      if (!Array.isArray(q.options) || q.options.length !== 4) {
        errors.push(
          `Câu hỏi "${q.id}" (${q.part}) phải có đúng 4 phương án lựa chọn (A, B, C, D), hiện có ${q.options?.length || 0}.`
        );
      }
      if (!['A', 'B', 'C', 'D'].includes(q.correctAnswer)) {
        errors.push(
          `Câu hỏi "${q.id}" có đáp án "${q.correctAnswer}" không hợp lệ (chỉ chấp nhận 'A', 'B', 'C', hoặc 'D').`
        );
      }
    }
  }

  // 3. Kiểm tra tính toàn vẹn Anti-duplicate cho Part 3 & Part 4
  for (const group of groups) {
    if (group.part === 'part3_conv' || group.part === 'part4_talks') {
      const childQuestions = group.questionIds
        .map((id) => questionById.get(id))
        .filter((q): q is ToeicListeningQuestion => q !== undefined);

      if (childQuestions.length >= 2) {
        const firstAudioId = childQuestions[0].audioGroupId;
        const firstGroupId = childQuestions[0].groupId;

        for (let i = 1; i < childQuestions.length; i++) {
          const cur = childQuestions[i];
          if (cur.audioGroupId !== firstAudioId) {
            errors.push(
              `Vi phạm Anti-duplicate Invariant ở ${group.part} Group "${group.id}": Câu #${childQuestions[0].id} (audio: "${firstAudioId}") và Câu #${cur.id} (audio: "${cur.audioGroupId}") có audio identity khác nhau.`
            );
          }
          if (cur.groupId !== firstGroupId) {
            errors.push(
              `Vi phạm Group Invariant ở ${group.part} Group "${group.id}": Câu #${cur.id} trỏ groupId khác với nhóm.`
            );
          }
        }
      }
    }
  }

  const isValid = errors.length === 0;

  return {
    isValid,
    errors,
    warnings,
    stats: {
      totalGroups: groups.length,
      totalQuestions: questions.length,
      byPart: dataset.stats.byPart,
      orphanedQuestions: orphanedCount,
      duplicateAudioIdentities: seenAudioGroupIds.size < groups.length ? groups.length - seenAudioGroupIds.size : 0,
    },
  };
}
