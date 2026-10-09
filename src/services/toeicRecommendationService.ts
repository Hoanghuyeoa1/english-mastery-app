// src/services/toeicRecommendationService.ts

import {
  ToeicInsight,
  ToeicRecommendation,
  ToeicRecommendationAction,
  ToeicPart,
} from '../types/toeic';

/**
 * Danh sách tên hiển thị chuẩn hóa cho các Part TOEIC
 */
const PART_TITLES: Record<string, string> = {
  part1_photos: 'Part 1 (Mô tả hình ảnh)',
  part2_qna: 'Part 2 (Hỏi & Đáp nhanh)',
  part3_conv: 'Part 3 (Hội thoại ngắn)',
  part4_talks: 'Part 4 (Bài nói chuyện)',
  part5_grammar: 'Part 5 (Hoàn thành câu)',
  part6_text: 'Part 6 (Điền đoạn văn)',
  part7_reading: 'Part 7 (Đọc hiểu văn bản)',
  speaking_read: 'Speaking (Phát âm & Thuyết trình)',
  writing_email: 'Writing (Soạn thảo văn bản)',
};

/**
 * Bản đồ nhận diện Sub-skill thuộc Part nào
 */
function inferPartForSubSkill(key: string): ToeicPart | undefined {
  const normalized = key.toLowerCase().trim();
  if (normalized.startsWith('part1_') || ['photo_action', 'photo_object_placement', 'detail_action'].includes(normalized)) {
    return 'part1_photos';
  }
  if (normalized.startsWith('part2_') || ['wh_question', 'yes_no_question', 'statement_response', 'offer_request'].includes(normalized)) {
    return 'part2_qna';
  }
  if (normalized.startsWith('part3_') || ['speaker_intent', 'graphic_relation', 'next_action'].includes(normalized)) {
    return 'part3_conv';
  }
  if (normalized.startsWith('part4_') || ['talk_purpose', 'announcement', 'telephone_message'].includes(normalized)) {
    return 'part4_talks';
  }
  if (normalized.startsWith('part5_') || normalized.startsWith('grammar_') || ['verb_tenses', 'subject_verb_agreement', 'preposition_idioms', 'pronoun_reference', 'vocab_meaning', 'vocab_collocation'].includes(normalized)) {
    return 'part5_grammar';
  }
  if (normalized.startsWith('part6_') || ['sentence_insertion', 'text_completion', 'context_clues'].includes(normalized)) {
    return 'part6_text';
  }
  if (normalized.startsWith('part7_') || ['main_purpose', 'specific_detail', 'negative_fact', 'inference_author', 'inference', 'vocab_context'].includes(normalized)) {
    return 'part7_reading';
  }
  if (normalized.startsWith('speaking_') || ['pronunciation_intonation', 'opinion_argumentation'].includes(normalized)) {
    return 'speaking_read';
  }
  if (normalized.startsWith('writing_') || ['email_response', 'opinion_essay'].includes(normalized)) {
    return 'writing_email';
  }
  return undefined;
}

/**
 * Kiểm tra xem một Sub-skill có phải là chủ điểm ngữ pháp hay không
 */
function isGrammarSubSkill(key: string): boolean {
  const normalized = key.toLowerCase().trim();
  return (
    normalized.startsWith('grammar_') ||
    ['verb_tenses', 'subject_verb_agreement', 'preposition_idioms', 'pronoun_reference'].includes(normalized)
  );
}

/**
 * Kiểm tra xem một Sub-skill có phải là chủ điểm từ vựng hay không
 */
function isVocabSubSkill(key: string): boolean {
  const normalized = key.toLowerCase().trim();
  return (
    normalized.startsWith('vocab_') ||
    ['workplace_vocabulary', 'business_terms', 'collocation'].includes(normalized)
  );
}

/**
 * Xây dựng câu lý do (Reason) dựa hoàn toàn trên evidence thật
 */
function buildRecommendationReason(insight: ToeicInsight): string {
  const acc = insight.weightedAccuracy ?? insight.accuracy;
  const accText = acc !== null ? `Độ chính xác ${acc}%` : (insight.score !== undefined ? `Điểm số ${insight.score}/200` : 'Cần cải thiện');
  const countText = `${insight.evidenceCount} câu đã làm`;
  
  let evidenceText = '';
  if (insight.evidenceStrength === 'emerging') {
    evidenceText = ' • Tín hiệu mới (3-4 câu)';
  } else if (insight.evidenceStrength === 'established') {
    evidenceText = ' • Bằng chứng vững chắc (≥10 câu)';
  }

  let lifecycleText = '';
  if (insight.weaknessLifecycle === 'improving') {
    lifecycleText = ' • Đang tiến bộ';
  } else if (insight.weaknessLifecycle === 'resolved') {
    lifecycleText = ' • Đã khắc phục';
  }

  let stabilityText = '';
  if (insight.stability === 'volatile') {
    stabilityText = ' • Phong độ còn biến động';
  }

  let trendText = '';
  if (insight.trend === 'declining') {
    trendText = ' • Xu hướng đang sụt giảm';
  } else if (insight.trend === 'improving') {
    trendText = ' • Xu hướng đang tiến bộ';
  } else if (insight.trend === 'stable') {
    trendText = ' • Phong độ ổn định';
  }

  let confText = '';
  if (insight.confidence === 'high') {
    confText = ' • Độ tin cậy cao';
  } else if (insight.confidence === 'medium') {
    confText = ' • Độ tin cậy trung bình';
  }

  return `${accText} qua ${countText}${evidenceText}${lifecycleText}${stabilityText}${trendText}${confText}`;
}

/**
 * Pure function: Ánh xạ một insight cụ thể thành Recommendation với action THẬT
 */
export function getRecommendationForInsight(insight: ToeicInsight): ToeicRecommendation {
  const key = insight.key;
  const reason = buildRecommendationReason(insight);
  const priorityScore = insight.priorityScore || insight.severity || 50;

  // 1. Trường hợp: Chủ điểm ngữ pháp (Part 5 hoặc Grammar tags)
  if (isGrammarSubSkill(key) || key === 'part5_grammar') {
    const primary: ToeicRecommendationAction = {
      id: `act_${key}_mistakes`,
      actionType: 'review_grammar_mistakes',
      label: 'Ôn tập lỗi ngữ pháp',
      description: 'Rà soát các lỗi ngữ pháp liên quan trong Sổ Tay Lỗi Sai (Mistake Bank)',
      targetTab: 'mistakes',
      subTarget: 'grammar',
      isAvailable: true,
    };
    const secondary: ToeicRecommendationAction = {
      id: `act_${key}_part5`,
      actionType: 'practice_toeic_part',
      label: 'Luyện TOEIC Part 5',
      description: 'Luyện thêm các câu hỏi hoàn thành câu ngữ pháp trong TOEIC Practice',
      targetTab: 'toeic',
      subTarget: 'part5_grammar',
      isAvailable: true,
    };

    return {
      id: `rec_${insight.type}_${key}`,
      insightKey: key,
      insightType: insight.type,
      title: `Khắc phục ngữ pháp: ${insight.displayName}`,
      reason,
      priorityScore,
      primaryAction: primary,
      secondaryAction: secondary,
    };
  }

  // 2. Trường hợp: Chủ điểm từ vựng (Vocab tags hoặc Collocation)
  if (isVocabSubSkill(key)) {
    const primary: ToeicRecommendationAction = {
      id: `act_${key}_vocab`,
      actionType: 'review_vocabulary',
      label: 'Lưu & Ôn từ vựng Flashcard',
      description: 'Củng cố các từ vựng theo chủ đề thường gặp qua Flashcards SRS',
      targetTab: 'flashcards',
      isAvailable: true,
    };
    const secondary: ToeicRecommendationAction = {
      id: `act_${key}_mistakes`,
      actionType: 'review_mistakes',
      label: 'Xem lại câu hỏi từ vựng sai',
      description: 'Xem lại ngữ cảnh câu hỏi đã làm sai trong Sổ Tay Lỗi Sai',
      targetTab: 'mistakes',
      subTarget: 'vocabulary',
      isAvailable: true,
    };

    return {
      id: `rec_${insight.type}_${key}`,
      insightKey: key,
      insightType: insight.type,
      title: `Củng cố vốn từ vựng: ${insight.displayName}`,
      reason,
      priorityScore,
      primaryAction: primary,
      secondaryAction: secondary,
    };
  }

  // 3. Trường hợp: Sub-skill cụ thể trong Listening, Reading, Speaking hoặc Writing
  if (insight.type === 'subSkill') {
    const parentPart = inferPartForSubSkill(key);
    const partLabel = parentPart ? (PART_TITLES[parentPart] || parentPart) : insight.displayName;

    if (parentPart && ['part1_photos', 'part2_qna', 'part3_conv', 'part4_talks'].includes(parentPart)) {
      const primary: ToeicRecommendationAction = {
        id: `act_${key}_practice`,
        actionType: 'practice_toeic_part',
        label: `Luyện TOEIC ${partLabel}`,
        description: `Luyện tập chuyên sâu kỹ năng hội thoại và bắt ý trong ${partLabel}`,
        targetTab: 'toeic',
        subTarget: parentPart,
        isAvailable: true,
      };
      const secondary: ToeicRecommendationAction = {
        id: `act_${key}_four_skills`,
        actionType: 'practice_four_skills',
        label: 'Luyện Nghe 4 Kỹ Năng',
        description: 'Luyện bài nghe có Transcript và Audio tương tác',
        targetTab: 'four_skills',
        subTarget: 'listening',
        isAvailable: true,
      };

      return {
        id: `rec_${insight.type}_${key}`,
        insightKey: key,
        insightType: insight.type,
        title: `Rèn luyện kỹ năng nghe: ${insight.displayName}`,
        reason,
        priorityScore,
        primaryAction: primary,
        secondaryAction: secondary,
      };
    }

    if (parentPart && ['part6_text', 'part7_reading'].includes(parentPart)) {
      const primary: ToeicRecommendationAction = {
        id: `act_${key}_practice`,
        actionType: 'practice_toeic_part',
        label: `Luyện TOEIC ${partLabel}`,
        description: `Rèn luyện tốc độ đọc hiểu và bẫy câu hỏi trong ${partLabel}`,
        targetTab: 'toeic',
        subTarget: parentPart,
        isAvailable: true,
      };
      const secondary: ToeicRecommendationAction = {
        id: `act_${key}_four_skills`,
        actionType: 'practice_four_skills',
        label: 'Luyện Đọc 4 Kỹ Năng',
        description: 'Rèn luyện đọc văn bản dài và tra từ ngữ cảnh',
        targetTab: 'four_skills',
        subTarget: 'reading',
        isAvailable: true,
      };

      return {
        id: `rec_${insight.type}_${key}`,
        insightKey: key,
        insightType: insight.type,
        title: `Nâng cao kỹ năng đọc: ${insight.displayName}`,
        reason,
        priorityScore,
        primaryAction: primary,
        secondaryAction: secondary,
      };
    }

    if (parentPart === 'speaking_read' || insight.skill === 'speaking') {
      return {
        id: `rec_${insight.type}_${key}`,
        insightKey: key,
        insightType: insight.type,
        title: `Rèn luyện phát âm & nói: ${insight.displayName}`,
        reason,
        priorityScore,
        primaryAction: {
          id: `act_${key}_pronunciation`,
          actionType: 'practice_pronunciation',
          label: 'Luyện Phát Âm Với AI',
          description: 'Luyện ngữ điệu và phát âm chuẩn trong Pronunciation Arena',
          targetTab: 'pronunciation',
          isAvailable: true,
        },
        secondaryAction: {
          id: `act_${key}_four_skills`,
          actionType: 'practice_four_skills',
          label: 'Luyện Nói 4 Kỹ Năng',
          description: 'Luyện tập các chủ đề giao tiếp trong 4 Kỹ Năng',
          targetTab: 'four_skills',
          subTarget: 'speaking',
          isAvailable: true,
        },
      };
    }

    if (parentPart === 'writing_email' || insight.skill === 'writing') {
      return {
        id: `rec_${insight.type}_${key}`,
        insightKey: key,
        insightType: insight.type,
        title: `Nâng cao kỹ năng viết: ${insight.displayName}`,
        reason,
        priorityScore,
        primaryAction: {
          id: `act_${key}_four_skills`,
          actionType: 'practice_four_skills',
          label: 'Luyện Viết 4 Kỹ Năng',
          description: 'Luyện viết đoạn văn và email công việc',
          targetTab: 'four_skills',
          subTarget: 'writing',
          isAvailable: true,
        },
        secondaryAction: {
          id: `act_${key}_mistakes`,
          actionType: 'review_mistakes',
          label: 'Xem lại bài viết mẫu',
          description: 'Rà soát các điểm ngữ pháp cần lưu ý',
          targetTab: 'mistakes',
          isAvailable: true,
        },
      };
    }
  }

  // 4. Trường hợp: Part level
  if (insight.type === 'part') {
    const partKey = insight.key as ToeicPart;
    const partLabel = PART_TITLES[partKey] || insight.displayName;

    if (['part1_photos', 'part2_qna', 'part3_conv', 'part4_talks'].includes(partKey)) {
      return {
        id: `rec_part_${partKey}`,
        insightKey: partKey,
        insightType: 'part',
        title: `Tập trung cải thiện ${partLabel}`,
        reason,
        priorityScore,
        primaryAction: {
          id: `act_${partKey}_practice`,
          actionType: 'practice_toeic_part',
          label: `Luyện ${partLabel}`,
          description: `Mở chế độ Luyện Tập Tự Do (Practice) tập trung vào ${partLabel}`,
          targetTab: 'toeic',
          subTarget: partKey,
          isAvailable: true,
        },
        secondaryAction: {
          id: `act_${partKey}_mistakes`,
          actionType: 'review_mistakes',
          label: 'Xem lại lỗi sai',
          description: 'Xem lại các câu hỏi đã làm sai trong bài thi gần đây',
          targetTab: 'mistakes',
          subTarget: 'listening',
          isAvailable: true,
        },
      };
    }

    if (['part6_text', 'part7_reading'].includes(partKey)) {
      return {
        id: `rec_part_${partKey}`,
        insightKey: partKey,
        insightType: 'part',
        title: `Cải thiện tốc độ & suy luận ${partLabel}`,
        reason,
        priorityScore,
        primaryAction: {
          id: `act_${partKey}_practice`,
          actionType: 'practice_toeic_part',
          label: `Luyện ${partLabel}`,
          description: `Mở chế độ Luyện Tập Tự Do (Practice) tập trung vào ${partLabel}`,
          targetTab: 'toeic',
          subTarget: partKey,
          isAvailable: true,
        },
        secondaryAction: {
          id: `act_${partKey}_mistakes`,
          actionType: 'review_mistakes',
          label: 'Xem lại lỗi sai',
          description: 'Xem lại các câu đọc hiểu đã làm sai trong Sổ Tay Lỗi Sai',
          targetTab: 'mistakes',
          subTarget: 'reading',
          isAvailable: true,
        },
      };
    }

    if (partKey === 'speaking_read') {
      return {
        id: `rec_part_${partKey}`,
        insightKey: partKey,
        insightType: 'part',
        title: 'Cải thiện kỹ năng Nói & Phát âm',
        reason,
        priorityScore,
        primaryAction: {
          id: `act_${partKey}_pronunciation`,
          actionType: 'practice_pronunciation',
          label: 'Luyện Phát Âm Với AI',
          description: 'Luyện đọc đoạn văn và phát âm to rõ trong Đấu Trường Phát Âm',
          targetTab: 'pronunciation',
          isAvailable: true,
        },
        secondaryAction: {
          id: `act_${partKey}_four_skills`,
          actionType: 'practice_four_skills',
          label: 'Luyện Nói 4 Kỹ Năng',
          description: 'Thực hành các chủ đề nói trong 4 Kỹ Năng',
          targetTab: 'four_skills',
          subTarget: 'speaking',
          isAvailable: true,
        },
      };
    }

    if (partKey === 'writing_email') {
      return {
        id: `rec_part_${partKey}`,
        insightKey: partKey,
        insightType: 'part',
        title: 'Cải thiện kỹ năng Viết Email',
        reason,
        priorityScore,
        primaryAction: {
          id: `act_${partKey}_four_skills`,
          actionType: 'practice_four_skills',
          label: 'Luyện Viết 4 Kỹ Năng',
          description: 'Thực hành viết email và đoạn văn công việc có chấm chữa',
          targetTab: 'four_skills',
          subTarget: 'writing',
          isAvailable: true,
        },
        secondaryAction: {
          id: `act_${partKey}_mistakes`,
          actionType: 'review_mistakes',
          label: 'Xem lại lỗi sai',
          description: 'Xem lại các điểm ngữ pháp cần lưu ý',
          targetTab: 'mistakes',
          isAvailable: true,
        },
      };
    }
  }

  // 5. Trường hợp: Skill level
  if (insight.type === 'skill') {
    if (insight.skill === 'listening') {
      return {
        id: `rec_skill_${insight.skill}`,
        insightKey: insight.skill,
        insightType: 'skill',
        title: 'Cải thiện kỹ năng Nghe Hiểu (Listening)',
        reason,
        priorityScore,
        primaryAction: {
          id: 'act_listening_four_skills',
          actionType: 'practice_four_skills',
          label: 'Luyện Nghe 4 Kỹ Năng',
          description: 'Luyện các bài nghe từ cơ bản đến nâng cao trong phòng luyện nghe',
          targetTab: 'four_skills',
          subTarget: 'listening',
          isAvailable: true,
        },
        secondaryAction: {
          id: 'act_listening_part3',
          actionType: 'practice_toeic_part',
          label: 'Luyện TOEIC Part 3',
          description: 'Rèn luyện nghe hội thoại với các câu hỏi thực tế',
          targetTab: 'toeic',
          subTarget: 'part3_conv',
          isAvailable: true,
        },
      };
    }

    if (insight.skill === 'reading') {
      return {
        id: `rec_skill_${insight.skill}`,
        insightKey: insight.skill,
        insightType: 'skill',
        title: 'Cải thiện kỹ năng Đọc Hiểu (Reading)',
        reason,
        priorityScore,
        primaryAction: {
          id: 'act_reading_four_skills',
          actionType: 'practice_four_skills',
          label: 'Luyện Đọc 4 Kỹ Năng',
          description: 'Luyện đọc các đoạn văn bản dài có hỗ trợ dịch và tra từ',
          targetTab: 'four_skills',
          subTarget: 'reading',
          isAvailable: true,
        },
        secondaryAction: {
          id: 'act_reading_part7',
          actionType: 'practice_toeic_part',
          label: 'Luyện TOEIC Part 7',
          description: 'Tăng tốc độ đọc hiểu văn bản đơn và đoạn kép',
          targetTab: 'toeic',
          subTarget: 'part7_reading',
          isAvailable: true,
        },
      };
    }
  }

  // 6. Generic Safe Fallback: Cho bất kỳ insight nào chưa có module riêng
  return {
    id: `rec_generic_${insight.type}_${key}`,
    insightKey: key,
    insightType: insight.type,
    title: `Ôn luyện kiến thức: ${insight.displayName}`,
    reason,
    priorityScore,
    primaryAction: {
      id: `act_generic_${key}_mistakes`,
      actionType: 'review_mistakes',
      label: 'Xem lại các lỗi sai liên quan',
      description: 'Rà soát và củng cố các câu hỏi đã làm sai trong Sổ Tay Lỗi Sai (Mistake Bank)',
      targetTab: 'mistakes',
      isAvailable: true,
    },
  };
}

/**
 * Pure function: Sinh danh sách khuyến nghị có cấu trúc từ Top Priorities
 */
export function generateToeicRecommendations(priorities: ToeicInsight[]): ToeicRecommendation[] {
  if (!priorities || priorities.length === 0) {
    return [];
  }

  return priorities.map((insight) => getRecommendationForInsight(insight));
}
