// src/services/adaptivePracticeRouter.ts

import {
  PracticeModuleId,
  AdaptivePracticeRecommendation,
  ActiveTargetedPracticeConfig,
  MistakeType,
  CanonicalMistakeSource,
  MistakeSource,
  MistakeRecord,
  AdaptiveMistakeProfile,
  ActiveTab,
} from '../types';
import {
  toCanonicalSource,
  toCanonicalType,
  classifyMistakeCause,
  toAdaptiveProfile,
  calculateAdaptiveScore,
  getMistakeRecurrenceLevel,
} from './adaptiveMistakeService';

/**
 * Danh sách toàn bộ các module luyện tập THẬT sự tồn tại trong codebase English Mastery Hub.
 * Tuyệt đối không tạo module ảo.
 */
export const VALID_PRACTICE_MODULES: readonly PracticeModuleId[] = [
  'flashcard',
  'classic_quiz',
  'word_scramble',
  'dictation',
  'listening',
  'pronunciation',
  'shadowing',
  'collocation',
  'cloze',
  'reading',
  'writing',
] as const;

/**
 * Type guard kiểm tra một module ID có hợp lệ và thực sự tồn tại trong hệ thống hay không.
 */
export function isValidPracticeModule(module: unknown): module is PracticeModuleId {
  return typeof module === 'string' && (VALID_PRACTICE_MODULES as readonly string[]).includes(module);
}

export interface ModuleNavigationTarget {
  tab: ActiveTab;
  subTab?: string;
  arcadeMode?: 'speed_match' | 'word_scramble' | 'dictation' | 'classic_quiz';
  description: string;
}

/**
 * Bản đồ ánh xạ từ PracticeModuleId sang Navigation Target THẬT của ứng dụng.
 */
export function getModuleNavigationTarget(module: PracticeModuleId): ModuleNavigationTarget {
  switch (module) {
    case 'flashcard':
      return {
        tab: 'flashcards',
        description: 'Ôn tập thẻ ghi nhớ thông minh (Spaced Repetition Flashcards)',
      };
    case 'classic_quiz':
      return {
        tab: 'arcade',
        arcadeMode: 'classic_quiz',
        description: 'Đấu trường trắc nghiệm 4 đáp án (Classic Quiz Arena)',
      };
    case 'word_scramble':
      return {
        tab: 'arcade',
        arcadeMode: 'word_scramble',
        description: 'Minigame xếp chữ rèn luyện trí nhớ chính tả (Word Scramble)',
      };
    case 'dictation':
      return {
        tab: 'arcade',
        arcadeMode: 'dictation',
        description: 'Nghe chép chính tả & điền từ ngữ cảnh (Dictation Arena)',
      };
    case 'pronunciation':
      return {
        tab: 'pronunciation',
        subTab: 'ai_speech',
        description: 'Đấu trường phát âm chuẩn bản xứ với AI (Pronunciation Arena)',
      };
    case 'shadowing':
      return {
        tab: 'pronunciation',
        subTab: 'shadowing',
        description: 'Luyện nhại giọng phản xạ (Smart Shadowing Arena)',
      };
    case 'listening':
      return {
        tab: 'four_skills',
        subTab: 'listening',
        description: 'Luyện nghe hiểu Four Skills chuyên sâu',
      };
    case 'reading':
      return {
        tab: 'four_skills',
        subTab: 'reading',
        description: 'Đọc hiểu tương tác và trích xuất từ vựng (Interactive Reading)',
      };
    case 'writing':
      return {
        tab: 'four_skills',
        subTab: 'writing',
        description: 'Luyện viết luận & Chấm điểm CEFR (Four Skills Writing)',
      };
    case 'collocation':
      return {
        tab: 'flashcards',
        subTab: 'COLLOCATION',
        description: 'Ôn tập thẻ cụm từ Collocation & Idioms',
      };
    case 'cloze':
      return {
        tab: 'flashcards',
        subTab: 'COLLOCATION',
        description: 'Luyện thẻ điền từ đục lỗ ngữ cảnh (Cloze Decks)',
      };
    default:
      return {
        tab: 'dashboard',
        description: 'Bảng điều khiển học tập',
      };
  }
}

/**
 * Pure Function: Quyết định module luyện tập phù hợp nhất cho 1 lỗi sai dựa trên loại lỗi,
 * nguồn phát sinh lỗi và nguyên nhân sâu xa (Levenshtein, typo, phonetics...).
 * Tuyệt đối không làm thay đổi (mutate) profile đầu vào.
 */
export function routeMistakeToModule(
  item: AdaptiveMistakeProfile | MistakeRecord,
  options?: {
    overrideSource?: MistakeSource;
    context?: { now?: number };
  }
): AdaptivePracticeRecommendation {
  const now = options?.context?.now ?? Date.now();

  // Đảm bảo không mutate object truyền vào bằng cách clone / derive an toàn
  const targetId = item.id || item.word || 'unknown';
  const targetWord = item.word || item.id || 'unknown';

  const sourceVal = options?.overrideSource ?? ('source' in item ? item.source : undefined);
  const canonicalSource = toCanonicalSource(sourceVal);
  const primaryType = toCanonicalType(item.primaryType, canonicalSource);

  // Trích xuất số lần sai & điểm số
  const totalMistakes = 'totalMistakes' in item
    ? (item.totalMistakes ?? 0)
    : (item.mistakeCount ?? item.wrongCount ?? 0);

  const recurrenceLevel = 'recurrenceLevel' in item && item.recurrenceLevel
    ? item.recurrenceLevel
    : getMistakeRecurrenceLevel(item);

  // Tính điểm ưu tiên thuần túy
  const profile = 'totalMistakes' in item ? item : toAdaptiveProfile(item, now);
  const rawScore = calculateAdaptiveScore(profile, { now });

  // Phân tích nguyên nhân lỗi (nếu có context câu trả lời của người học)
  const lastUser = 'lastUserAnswer' in item ? item.lastUserAnswer : undefined;
  const lastExpected = 'lastExpectedAnswer' in item ? item.lastExpectedAnswer : targetWord;
  const causeAnalysis = classifyMistakeCause({
    source: canonicalSource,
    type: primaryType,
    userAnswer: lastUser,
    expectedAnswer: lastExpected,
  });

  // Xác định độ tin cậy của mẫu dữ liệu (Low-data safety guard)
  let confidence: 'high' | 'medium' | 'low';
  let priority: number;

  if (totalMistakes === 0) {
    confidence = 'low';
    priority = 5;
  } else if (totalMistakes === 1) {
    confidence = 'low';
    // Mới sai 1 lần: giảm trọng số ưu tiên để không vội vàng ép luyện nặng
    priority = Math.min(35, Math.max(10, Math.round(rawScore * 0.5)));
  } else if (totalMistakes < 4) {
    confidence = 'medium';
    priority = Math.min(85, Math.max(25, Math.round(rawScore)));
  } else {
    confidence = 'high';
    priority = Math.min(100, Math.max(50, Math.round(rawScore)));
  }

  let recommendedModule: PracticeModuleId = 'flashcard';
  let secondaryModule: PracticeModuleId | undefined = 'classic_quiz';
  let reason = '';

  // 1. Phân loại theo Mistake Type với Context-Sensitive Rules
  switch (primaryType) {
    case 'spelling': {
      if (canonicalSource === 'word_scramble') {
        recommendedModule = 'word_scramble';
        secondaryModule = 'dictation';
        reason = confidence === 'low'
          ? 'Lỗi chính tả mới ghi nhận từ Word Scramble. Cần xếp chữ lại để nhớ từ.'
          : 'Lỗi chính tả phát sinh khi ghép từ. Ưu tiên Word Scramble để tái tạo chính xác trật tự các chữ cái.';
      } else if (canonicalSource === 'dictation' || causeAnalysis.subReason === 'spelling_gap') {
        recommendedModule = 'dictation';
        secondaryModule = 'word_scramble';
        reason = confidence === 'low'
          ? 'Lỗi chính tả mới ghi nhận từ Dictation. Cần nghe lại âm thanh để gõ đúng mặt chữ.'
          : 'Lỗi sai chính tả khi nghe chép. Ưu tiên Dictation Arena để rèn luyện liên kết âm thanh và mặt chữ.';
      } else {
        recommendedModule = 'word_scramble';
        secondaryModule = 'dictation';
        if (causeAnalysis.isTypo) {
          reason = `Lỗi gõ phím/nhầm lẫn ký tự nhẹ (khoảng cách ${causeAnalysis.levenshteinDistance || 1}). Ưu tiên Word Scramble để chỉnh sửa vị trí chữ cái nhanh chóng.`;
        } else {
          reason = confidence === 'low'
            ? 'Lỗi sắp xếp chữ cái mới ghi nhận. Ưu tiên Word Scramble để tái cấu trúc từ vựng.'
            : 'Lỗi chính tả lặp lại khi ghép từ. Ưu tiên Word Scramble để tái tạo chính xác trật tự các chữ cái.';
        }
      }
      break;
    }

    case 'listening': {
      if (canonicalSource === 'dictation') {
        recommendedModule = 'dictation';
        secondaryModule = 'listening';
        reason = confidence === 'low'
          ? 'Mới ghi nhận 1 lần khi nghe chép. Luyện nhẹ tại Dictation Arena để kiểm tra lại tai nghe.'
          : 'Khó khăn trong việc bắt âm chính xác từng từ trong câu. Ưu tiên Dictation Arena để luyện tai nghe chi tiết.';
      } else {
        recommendedModule = 'listening';
        secondaryModule = 'dictation';
        reason = confidence === 'low'
          ? 'Cần củng cố nhẹ phản xạ nghe hiểu qua bài luyện nghe Four Skills.'
          : 'Điểm yếu kỹ năng nghe nhận diện. Ưu tiên các bài nghe hiểu chuyên sâu trong Four Skills.';
      }
      break;
    }

    case 'pronunciation': {
      // Nếu từ vựng có chứa dấu cách hoặc là cụm dài -> ưu tiên Shadowing theo nhịp
      const isPhrase = targetWord.trim().includes(' ') || (targetWord.length > 25);
      if (isPhrase || canonicalSource === 'four_skills') {
        recommendedModule = 'shadowing';
        secondaryModule = 'pronunciation';
        reason = confidence === 'low'
          ? 'Mới ghi nhận ngữ điệu chưa chuẩn khi đọc câu. Luyện nhẹ với Smart Shadowing.'
          : 'Phát âm cụm từ hoặc câu cần chú trọng ngữ điệu và nối âm. Ưu tiên Smart Shadowing.';
      } else {
        recommendedModule = 'pronunciation';
        secondaryModule = 'shadowing';
        reason = confidence === 'low'
          ? 'Phát âm từ vựng mới ghi nhận chưa chuẩn. Luyện nhẹ với Pronunciation Arena (AI Speech).'
          : 'Lỗi phát âm cần khắc phục. Ưu tiên Pronunciation Arena để được chấm điểm phản hồi chi tiết.';
      }
      break;
    }

    case 'meaning': {
      if (canonicalSource === 'classic_quiz') {
        recommendedModule = 'classic_quiz';
        secondaryModule = 'flashcard';
        reason = confidence === 'low'
          ? 'Mới nhầm lẫn phương án 1 lần trong trắc nghiệm. Củng cố nhẹ qua Classic Quiz.'
          : 'Nhầm lẫn ngữ nghĩa giữa các phương án gây nhiễu. Ưu tiên Classic Quiz để phân biệt nghĩa bẫy.';
      } else {
        recommendedModule = 'flashcard';
        secondaryModule = 'classic_quiz';
        reason = confidence === 'low'
          ? 'Quên nghĩa từ vựng mới ghi nhận 1 lần. Ôn nhẹ qua Flashcard SRS.'
          : 'Lỗi ghi nhớ nghĩa từ vựng. Ưu tiên Flashcard SRS để củng cố phản xạ truy hồi chủ động.';
      }
      break;
    }

    case 'collocation': {
      recommendedModule = 'collocation';
      secondaryModule = 'cloze';
      reason = confidence === 'low'
        ? 'Mới ghi nhận 1 lần kết hợp cụm từ. Ôn nhẹ qua thẻ Collocation & Cloze.'
        : 'Gặp trở ngại kết hợp cụm từ tự nhiên. Ưu tiên thẻ Collocation & Cloze để nhớ cụm từ cố định.';
      break;
    }

    case 'reading': {
      recommendedModule = 'reading';
      secondaryModule = 'flashcard';
      reason = confidence === 'low'
        ? 'Mới ghi nhận 1 lần khi đọc hiểu. Ôn nhẹ qua Interactive Reading.'
        : 'Gặp khó khăn khi đọc hiểu ngữ cảnh văn bản. Ưu tiên Interactive Reading để luyện đọc tương tác.';
      break;
    }

    case 'writing':
    case 'grammar': {
      recommendedModule = 'writing';
      secondaryModule = 'cloze';
      reason = confidence === 'low'
        ? 'Mới ghi nhận 1 lần lỗi ngữ pháp/viết. Luyện nhẹ qua Four Skills Writing.'
        : 'Lỗi ngữ pháp và hành văn viết. Ưu tiên Four Skills Writing để kiểm tra cấu trúc câu chuẩn CEFR.';
      break;
    }

    case 'other':
    default: {
      recommendedModule = 'flashcard';
      secondaryModule = 'classic_quiz';
      reason = totalMistakes === 0
        ? 'Chưa ghi nhận lỗi sai cần khắc phục. Có thể ôn nhẹ qua thẻ nhớ.'
        : confidence === 'low'
        ? 'Mới ghi nhận 1 lần. Cần theo dõi thêm và củng cố nhẹ qua thẻ Flashcard SRS.'
        : 'Cần củng cố tổng thể từ vựng qua thẻ Flashcard SRS.';
      break;
    }
  }

  // Bổ sung ghi chú nếu là lỗi kinh niên (chronic)
  if (recurrenceLevel === 'chronic') {
    priority = Math.min(100, priority + 15);
    reason += ' [CẢNH BÁO: Lỗi kinh niên tái diễn nhiều lần - Cần ưu tiên khắc phục trước].';
  }

  return {
    targetId,
    word: targetWord,
    mistakeType: primaryType,
    recommendedModule,
    secondaryModule,
    priority,
    reason,
    metadata: {
      source: canonicalSource,
      subReason: causeAnalysis.subReason,
      recurrenceLevel,
      confidence,
      isTypo: causeAnalysis.isTypo,
      sampleCount: totalMistakes,
    },
  };
}

/**
 * Pure Function: Lấy danh sách đề xuất luyện tập thích ứng cho toàn bộ danh sách bẫy lỗi.
 * Sắp xếp theo thứ tự ưu tiên (priority descending).
 * Không làm thay đổi bất kỳ object đầu vào nào.
 */
export function getAdaptivePracticeRecommendations(
  mistakes: Record<string, MistakeRecord> | MistakeRecord[] | AdaptiveMistakeProfile[],
  options?: {
    limit?: number;
    includeResolved?: boolean;
    filterType?: MistakeType;
    filterModule?: PracticeModuleId;
    now?: number;
  }
): AdaptivePracticeRecommendation[] {
  const list = Array.isArray(mistakes) ? mistakes : Object.values(mistakes || {});
  const limit = options?.limit ?? 20;
  const includeResolved = Boolean(options?.includeResolved);
  const now = options?.now ?? Date.now();

  const recommendations: AdaptivePracticeRecommendation[] = [];

  for (const item of list) {
    if (!item) continue;
    if (!includeResolved && item.resolved) continue;

    const rec = routeMistakeToModule(item, { context: { now } });

    if (options?.filterType && rec.mistakeType !== options.filterType) {
      continue;
    }
    if (options?.filterModule && rec.recommendedModule !== options.filterModule) {
      continue;
    }

    recommendations.push(rec);
  }

  // Sắp xếp ưu tiên cao nhất lên đầu
  recommendations.sort((a, b) => b.priority - a.priority);

  return recommendations.slice(0, limit);
}

