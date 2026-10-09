// src/services/toeicListeningNormalizer.ts
import {
  ToeicQuestion,
  ToeicQuestionGroup,
  ToeicAudioAccent,
  ToeicAudioFormat,
} from '../types/toeic';
import {
  ToeicListeningPart,
  ToeicListeningAudioSource,
  ToeicListeningTranscript,
  ToeicListeningTranscriptSegment,
  ToeicListeningQuestion,
  NormalizedToeicListeningGroup,
  Part1ListeningGroup,
  Part2ListeningGroup,
  Part3ListeningGroup,
  Part4ListeningGroup,
  NormalizedListeningDataset,
} from '../types/toeicListening';
import { TOEIC_QUESTION_BANK, TOEIC_QUESTION_GROUPS } from '../data/toeicQuestionsData';

/**
 * Phân tích lời thoại (audioScript) thành các segment có phân vai người nói (Speaker Segments).
 * Hỗ trợ các mẫu ETS điển hình:
 * - "Man: ... Woman: ..."
 * - "Speaker A: ... Speaker B: ..."
 * - "Narrator: ..."
 */
export function parseTranscriptSegments(
  script: string,
  metaSegments?: Array<{ id?: string; speaker?: string; text: string; startMs?: number; endMs?: number }>
): ToeicListeningTranscript {
  const fullText = (script || '').trim();

  // 1. Nếu đã có metadata segments chính thức (có timing)
  if (Array.isArray(metaSegments) && metaSegments.length > 0) {
    return {
      fullText,
      hasTiming: true,
      segments: metaSegments.map((s, idx) => ({
        id: s.id || `seg_${idx}`,
        speaker: s.speaker,
        text: s.text.trim(),
        startMs: s.startMs,
        endMs: s.endMs,
      })),
    };
  }

  if (!fullText) {
    return {
      fullText: '',
      segments: [],
      hasTiming: false,
    };
  }

  // 2. Parse theo biểu thức hội thoại có gắn nhãn người nói (Dialogue Speaker Regex)
  const speakerRegex = /(?:^|\s)(Man|Woman|Speaker [A-Z]|Person [1-2]|Narrator):\s*/gi;
  const matches: Array<{ speaker: string; index: number; fullMatchLength: number }> = [];

  let match: RegExpExecArray | null;
  while ((match = speakerRegex.exec(fullText)) !== null) {
    matches.push({
      speaker: match[1].trim(),
      index: match.index,
      fullMatchLength: match[0].length,
    });
  }

  if (matches.length > 0) {
    const segments: ToeicListeningTranscriptSegment[] = [];
    for (let i = 0; i < matches.length; i++) {
      const cur = matches[i];
      const textStart = cur.index + cur.fullMatchLength;
      const textEnd = i + 1 < matches.length ? matches[i + 1].index : fullText.length;
      const segmentText = fullText.slice(textStart, textEnd).trim();

      if (segmentText.length > 0) {
        segments.push({
          id: `seg_${i}`,
          speaker: cur.speaker,
          text: segmentText,
        });
      }
    }

    return {
      fullText,
      segments,
      hasTiming: false,
    };
  }

  // 3. Phân tách theo từng câu văn đơn (Sentence-level fallback cho Part 4 độc thoại)
  const rawSentences = fullText
    .split(/(?<=[.?!])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  const segments: ToeicListeningTranscriptSegment[] = rawSentences.map((sent, idx) => ({
    id: `seg_${idx}`,
    text: sent,
  }));

  return {
    fullText,
    segments: segments.length > 0 ? segments : [{ id: 'seg_0', text: fullText }],
    hasTiming: false,
  };
}

/**
 * Trích xuất và phân loại nguồn âm thanh theo hợp đồng chuẩn:
 * Recorded audio vs TTS fallback (không giả mạo TTS thành recorded audio).
 */
export function resolveAudioSourceContract(
  audioMetadata?: ToeicQuestion['audioMetadata'] | ToeicQuestionGroup['audioMetadata'],
  audioScript?: string,
  preferredAccent: ToeicAudioAccent = 'en-US'
): ToeicListeningAudioSource {
  // Case A: Đã cấu hình tệp ghi âm tĩnh hợp lệ
  if (
    audioMetadata &&
    typeof audioMetadata.url === 'string' &&
    audioMetadata.url.trim().length > 0 &&
    !audioMetadata.url.startsWith('javascript:')
  ) {
    return {
      sourceType: 'recorded',
      audioUrl: audioMetadata.url.trim(),
      audioScript: audioScript?.trim() || undefined,
      accent: audioMetadata.accent || preferredAccent,
      format: audioMetadata.format || ('mp3' as ToeicAudioFormat),
      durationMs: audioMetadata.durationMs,
      isFallback: false,
    };
  }

  // Case B: Không có file ghi âm -> Fallback sang kịch bản TTS Web Speech API
  const fallbackText = (audioScript || '').trim();
  if (fallbackText.length > 0) {
    return {
      sourceType: 'tts',
      audioScript: fallbackText,
      accent: audioMetadata?.accent || preferredAccent,
      durationMs: audioMetadata?.durationMs,
      isFallback: true,
      fallbackReason: 'NO_RECORDED_AUDIO_METADATA_FALLBACK_TTS',
    };
  }

  // Case C: Hoàn toàn không có dữ liệu âm thanh
  return {
    sourceType: 'none',
    accent: preferredAccent,
    isFallback: false,
    fallbackReason: 'NO_AUDIO_SOURCE_AVAILABLE',
  };
}

/**
 * Normalizer thuần túy: Biến đổi Legacy Question Bank thành Normalized Listening Dataset
 *
 * Invariants bảo đảm:
 * 1. Part 3 & 4: 1 Group -> Duy nhất 1 audioGroupId -> Đúng 3 câu hỏi con.
 * 2. Không duplicate audioScript / audioMetadata vào từng Question con.
 * 3. Question IDs được bảo tồn nguyên vẹn (100% stable).
 * 4. Đáp án, giải thích, từ vựng không bị thay đổi.
 */
export function normalizeToeicListeningDataset(
  questions: ToeicQuestion[],
  groups: ToeicQuestionGroup[]
): NormalizedListeningDataset {
  const normalizedGroups: NormalizedToeicListeningGroup[] = [];
  const normalizedQuestions: ToeicListeningQuestion[] = [];

  const groupById = new Map<string, NormalizedToeicListeningGroup>();
  const questionById = new Map<string, ToeicListeningQuestion>();
  const questionsByGroupId = new Map<string, ToeicListeningQuestion[]>();
  const groupByAudioId = new Map<string, NormalizedToeicListeningGroup>();

  // Bản đồ tra cứu nhanh câu hỏi theo ID
  const rawQuestionMap = new Map<string, ToeicQuestion>();
  questions.forEach((q) => {
    if (
      q.part === 'part1_photos' ||
      q.part === 'part2_qna' ||
      q.part === 'part3_conv' ||
      q.part === 'part4_talks'
    ) {
      rawQuestionMap.set(q.id, q);
    }
  });

  const processedQuestionIds = new Set<string>();

  // ===========================================================================
  // BƯỚC 1: CHUẨN HÓA CÁC NHÓM PART 3 (CONVERSATIONS) & PART 4 (TALKS)
  // ===========================================================================
  const listeningGroups = groups.filter(
    (g) => g.part === 'part3_conv' || g.part === 'part4_talks'
  );

  for (const rawGrp of listeningGroups) {
    const part = rawGrp.part as 'part3_conv' | 'part4_talks';
    const groupId = rawGrp.id;
    // Bắt buộc 1 group có DUY NHẤT 1 audio identity ổn định
    const audioGroupId = rawGrp.audioGroupId || `audio_grp_${groupId}`;

    // Thu thập các câu hỏi con thuộc nhóm
    const groupQuestionIds = rawGrp.questionIds || [];
    const childQuestions: ToeicListeningQuestion[] = [];

    // Tìm kịch bản audio chuẩn tại group hoặc từ câu hỏi con đầu tiên nếu group bị thiếu
    let groupScript = rawGrp.audioScript || '';
    let groupMeta = rawGrp.audioMetadata;

    // Duyệt các câu hỏi con theo thứ tự
    groupQuestionIds.forEach((qId, orderIdx) => {
      const rawQ = rawQuestionMap.get(qId);
      if (!rawQ) return;

      processedQuestionIds.add(qId);

      if (!groupScript && rawQ.audioScript) {
        groupScript = rawQ.audioScript;
      }
      if (!groupMeta && rawQ.audioMetadata) {
        groupMeta = rawQ.audioMetadata;
      }

      // Tạo câu hỏi con chuẩn hóa: KHÔNG sao chép audio payload
      const normQ: ToeicListeningQuestion = {
        id: rawQ.id,
        part,
        groupId,
        audioGroupId,
        orderIndex: orderIdx,
        questionText: rawQ.questionText,
        options: rawQ.options || [],
        correctAnswer: rawQ.correctAnswer || 'A',
        explanation: rawQ.explanation || '',
        vietnameseTranslation: rawQ.vietnameseTranslation || '',
        keyVocabulary: rawQ.keyVocabulary,
        difficulty: rawQ.difficulty || rawGrp.difficulty,
        topic: rawQ.topic || rawGrp.topic,
        questionType: rawQ.questionType,
        grammarTags: rawQ.grammarTags,
        vocabularyTags: rawQ.vocabularyTags,
        estimatedDifficulty: rawQ.estimatedDifficulty || rawGrp.estimatedDifficulty,
      };

      childQuestions.push(normQ);
      normalizedQuestions.push(normQ);
      questionById.set(normQ.id, normQ);
    });

    const audioSource = resolveAudioSourceContract(groupMeta, groupScript);
    const transcript = parseTranscriptSegments(groupScript, groupMeta?.segments);

    let normGroup: NormalizedToeicListeningGroup;

    if (part === 'part3_conv') {
      const p3Group: Part3ListeningGroup = {
        id: groupId,
        audioGroupId,
        part: 'part3_conv',
        title: rawGrp.title,
        topic: rawGrp.topic,
        difficulty: rawGrp.difficulty,
        estimatedDifficulty: rawGrp.estimatedDifficulty,
        audioSource,
        transcript,
        questionIds: childQuestions.map((q) => q.id),
      };
      normGroup = p3Group;
    } else {
      const p4Group: Part4ListeningGroup = {
        id: groupId,
        audioGroupId,
        part: 'part4_talks',
        title: rawGrp.title,
        topic: rawGrp.topic,
        difficulty: rawGrp.difficulty,
        estimatedDifficulty: rawGrp.estimatedDifficulty,
        imageUrl: rawGrp.imageUrl,
        audioSource,
        transcript,
        questionIds: childQuestions.map((q) => q.id),
      };
      normGroup = p4Group;
    }

    normalizedGroups.push(normGroup);
    groupById.set(groupId, normGroup);
    groupByAudioId.set(audioGroupId, normGroup);
    questionsByGroupId.set(groupId, childQuestions);
  }

  // ===========================================================================
  // BƯỚC 2: CHUẨN HÓA PART 1 (PHOTOGRAPHS) & PART 2 (QUESTION & RESPONSE)
  // (Kể cả các câu hỏi Part 3/4 mồ côi nếu có trong bank cũ)
  // ===========================================================================
  for (const [qId, rawQ] of rawQuestionMap.entries()) {
    if (processedQuestionIds.has(qId)) continue;

    processedQuestionIds.add(qId);
    const part = rawQ.part as ToeicListeningPart;

    // Mỗi câu hỏi Part 1 & 2 đại diện cho 1 Discrete Group với đúng 1 audio identity
    const groupId = rawQ.groupId || `grp_${rawQ.id}`;
    const audioGroupId = rawQ.audioGroupId || `audio_${rawQ.id}`;

    const normQ: ToeicListeningQuestion = {
      id: rawQ.id,
      part,
      groupId,
      audioGroupId,
      orderIndex: 0,
      questionText: rawQ.questionText,
      options: rawQ.options || [],
      correctAnswer: rawQ.correctAnswer || 'A',
      explanation: rawQ.explanation || '',
      vietnameseTranslation: rawQ.vietnameseTranslation || '',
      keyVocabulary: rawQ.keyVocabulary,
      difficulty: rawQ.difficulty,
      topic: rawQ.topic,
      questionType: rawQ.questionType,
      grammarTags: rawQ.grammarTags,
      vocabularyTags: rawQ.vocabularyTags,
      estimatedDifficulty: rawQ.estimatedDifficulty,
    };

    normalizedQuestions.push(normQ);
    questionById.set(normQ.id, normQ);
    questionsByGroupId.set(groupId, [normQ]);

    const audioSource = resolveAudioSourceContract(rawQ.audioMetadata, rawQ.audioScript);
    const transcript = parseTranscriptSegments(rawQ.audioScript || '', rawQ.audioMetadata?.segments);

    let normGroup: NormalizedToeicListeningGroup;

    if (part === 'part1_photos') {
      const p1Group: Part1ListeningGroup = {
        id: groupId,
        audioGroupId,
        part: 'part1_photos',
        title: rawQ.topic || 'Part 1: Photographs',
        topic: rawQ.topic,
        difficulty: rawQ.difficulty,
        estimatedDifficulty: rawQ.estimatedDifficulty,
        imageUrl: rawQ.imageUrl || '',
        audioSource,
        transcript,
        questionIds: [normQ.id],
      };
      normGroup = p1Group;
    } else if (part === 'part2_qna') {
      const p2Group: Part2ListeningGroup = {
        id: groupId,
        audioGroupId,
        part: 'part2_qna',
        title: rawQ.topic || 'Part 2: Question & Response',
        topic: rawQ.topic,
        difficulty: rawQ.difficulty,
        estimatedDifficulty: rawQ.estimatedDifficulty,
        audioSource,
        transcript,
        questionIds: [normQ.id],
      };
      normGroup = p2Group;
    } else if (part === 'part3_conv') {
      // Trường hợp câu Part 3 đơn lẻ không thuộc group nào trong legacy bank
      const p3Group: Part3ListeningGroup = {
        id: groupId,
        audioGroupId,
        part: 'part3_conv',
        title: rawQ.topic || 'Part 3: Conversation',
        topic: rawQ.topic,
        difficulty: rawQ.difficulty,
        estimatedDifficulty: rawQ.estimatedDifficulty,
        audioSource,
        transcript,
        questionIds: [normQ.id],
      };
      normGroup = p3Group;
    } else {
      // Part 4 đơn lẻ
      const p4Group: Part4ListeningGroup = {
        id: groupId,
        audioGroupId,
        part: 'part4_talks',
        title: rawQ.topic || 'Part 4: Short Talk',
        topic: rawQ.topic,
        difficulty: rawQ.difficulty,
        estimatedDifficulty: rawQ.estimatedDifficulty,
        imageUrl: rawQ.imageUrl,
        audioSource,
        transcript,
        questionIds: [normQ.id],
      };
      normGroup = p4Group;
    }

    normalizedGroups.push(normGroup);
    groupById.set(groupId, normGroup);
    groupByAudioId.set(audioGroupId, normGroup);
  }

  // ===========================================================================
  // TÍNH TOÁN THỐNG KÊ
  // ===========================================================================
  const byPart: Record<ToeicListeningPart, { groupCount: number; questionCount: number }> = {
    part1_photos: { groupCount: 0, questionCount: 0 },
    part2_qna: { groupCount: 0, questionCount: 0 },
    part3_conv: { groupCount: 0, questionCount: 0 },
    part4_talks: { groupCount: 0, questionCount: 0 },
  };

  normalizedGroups.forEach((g) => {
    byPart[g.part].groupCount++;
    byPart[g.part].questionCount += g.questionIds.length;
  });

  return {
    groups: normalizedGroups,
    questions: normalizedQuestions,
    groupById,
    questionById,
    questionsByGroupId,
    groupByAudioId,
    stats: {
      totalGroups: normalizedGroups.length,
      totalQuestions: normalizedQuestions.length,
      byPart,
    },
  };
}

/**
 * Singleton Cached Normalized Dataset:
 * Chỉ chuẩn hóa 1 lần duy nhất từ Static Data Bank trong suốt vòng đời ứng dụng.
 * Tránh rebuild toàn bộ đồ thị dữ liệu trong mỗi lần render.
 */
let cachedNormalizedDataset: NormalizedListeningDataset | null = null;

export function getNormalizedListeningDataset(): NormalizedListeningDataset {
  if (!cachedNormalizedDataset) {
    cachedNormalizedDataset = normalizeToeicListeningDataset(
      TOEIC_QUESTION_BANK,
      TOEIC_QUESTION_GROUPS
    );
  }
  return cachedNormalizedDataset;
}

/**
 * Hàm hỗ trợ test: Đặt lại cache nếu cần nạp dữ liệu kiểm thử mock
 */
export function resetNormalizedDatasetCache(): void {
  cachedNormalizedDataset = null;
}

/**
 * Phân giải hoặc sinh NormalizedToeicListeningGroup cho một câu hỏi cụ thể.
 * Ưu tiên tra cứu từ cache ngân hàng chuẩn; nếu câu hỏi được sinh động (custom/diagnostic slots)
 * thì chuẩn hóa on-the-fly theo đúng hợp đồng nhóm.
 */
export function resolveNormalizedListeningGroup(
  question: ToeicQuestion,
  parentGroup?: ToeicQuestionGroup | null
): NormalizedToeicListeningGroup {
  const dataset = getNormalizedListeningDataset();
  const cachedQ = dataset.questionById.get(question.id);
  if (cachedQ) {
    const group = dataset.groupById.get(cachedQ.groupId);
    if (group && (group.audioSource.audioUrl === question.audioMetadata?.url || (!group.audioSource.audioUrl && !question.audioMetadata?.url))) {
      return group;
    }
  }

  const part = question.part as ToeicListeningPart;
  const groupId = question.groupId || (parentGroup ? parentGroup.id : `grp_${question.id}`);
  const audioGroupId = question.audioGroupId || (parentGroup ? `audio_${parentGroup.id}` : `audio_${question.id}`);

  const rawMeta = question.audioMetadata || parentGroup?.audioMetadata;
  const rawScript = question.audioScript || parentGroup?.audioScript;
  const audioSource = resolveAudioSourceContract(rawMeta, rawScript);
  const transcript = parseTranscriptSegments(rawScript || '', rawMeta?.segments);

  if (part === 'part1_photos') {
    return {
      id: groupId,
      audioGroupId,
      part: 'part1_photos',
      title: question.topic || 'Part 1: Photographs',
      topic: question.topic,
      difficulty: question.difficulty,
      estimatedDifficulty: question.estimatedDifficulty,
      imageUrl: question.imageUrl || '',
      audioSource,
      transcript,
      questionIds: [question.id],
    };
  }

  if (part === 'part2_qna') {
    return {
      id: groupId,
      audioGroupId,
      part: 'part2_qna',
      title: question.topic || 'Part 2: Question & Response',
      topic: question.topic,
      difficulty: question.difficulty,
      estimatedDifficulty: question.estimatedDifficulty,
      audioSource,
      transcript,
      questionIds: [question.id],
    };
  }

  if (part === 'part3_conv') {
    return {
      id: groupId,
      audioGroupId,
      part: 'part3_conv',
      title: parentGroup?.title || question.topic || 'Part 3: Conversation',
      topic: parentGroup?.topic || question.topic,
      difficulty: parentGroup?.difficulty || question.difficulty,
      estimatedDifficulty: parentGroup?.estimatedDifficulty || question.estimatedDifficulty,
      audioSource,
      transcript,
      questionIds: parentGroup ? parentGroup.questionIds : [question.id],
    };
  }

  return {
    id: groupId,
    audioGroupId,
    part: 'part4_talks',
    title: parentGroup?.title || question.topic || 'Part 4: Short Talk',
    topic: parentGroup?.topic || question.topic,
    difficulty: parentGroup?.difficulty || question.difficulty,
    estimatedDifficulty: parentGroup?.estimatedDifficulty || question.estimatedDifficulty,
    imageUrl: question.imageUrl,
    audioSource,
    transcript,
    questionIds: parentGroup ? parentGroup.questionIds : [question.id],
  };
}
