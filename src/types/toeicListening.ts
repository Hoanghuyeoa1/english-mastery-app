import {
  ToeicAudioAccent,
  ToeicAudioFormat,
  ToeicAudioMetadata,
  ToeicDifficulty,
  ToeicVocabularyItem,
  ExamExperienceConfig,
} from './toeic';

/**
 * =============================================================================
 * TOEIC LISTENING DOMAIN MODEL (PHASE 2 NORMALIZATION)
 * =============================================================================
 * Chuẩn hóa mô hình hướng Nhóm (Group-Centric) cho 4 Part phần thi Nghe TOEIC:
 * - Part 1: Photographs (1 ảnh + 1 audio + 1 câu hỏi)
 * - Part 2: Question & Response (1 chuỗi âm thanh câu hỏi-đáp + 1 câu hỏi)
 * - Part 3: Short Conversations (1 đoạn hội thoại + 1 audio identity + 3 câu hỏi)
 * - Part 4: Short Talks (1 bài nói + 1 audio identity + 3 câu hỏi)
 *
 * Invariant bắt buộc:
 * 1. 1 Group sở hữu DUY NHẤT 1 audio identity (audioGroupId).
 * 2. Question KHÔNG duplicate audio payload / script; chỉ giữ tham chiếu.
 * 3. Phân định rạch ròi giữa Recorded Audio (static asset) và TTS fallback.
 * 4. Không sử dụng kiểu `any`.
 * =============================================================================
 */

export type ToeicListeningPart =
  | 'part1_photos'
  | 'part2_qna'
  | 'part3_conv'
  | 'part4_talks';

/**
 * Phân định nguồn âm thanh:
 * - 'recorded': Tệp âm thanh thu âm thực tế (MP3/AAC/WAV) có URL hợp lệ.
 * - 'tts': Kịch bản văn bản được đọc thông qua Web Speech API (fallback an toàn).
 * - 'none': Không có nguồn âm thanh hợp lệ nào.
 */
export type ToeicAudioSourceType = 'recorded' | 'tts' | 'none';

export interface ToeicListeningAudioSource {
  /** Loại nguồn âm thanh */
  sourceType: ToeicAudioSourceType;
  /** Đường dẫn file âm thanh nếu là bản thu âm ('recorded') */
  audioUrl?: string;
  /** Kịch bản đọc phát âm nếu sử dụng TTS ('tts') */
  audioScript?: string;
  /** Giọng đọc chuẩn hóa */
  accent: ToeicAudioAccent;
  /** Định dạng file âm thanh nếu có */
  format?: ToeicAudioFormat;
  /** Thời lượng tính bằng mili-giây nếu đã được định danh */
  durationMs?: number;
  /** Đánh dấu nguồn này là fallback sang TTS do thiếu hoặc lỗi file MP3 */
  isFallback: boolean;
  /** Lý do fallback chi tiết nếu có */
  fallbackReason?: string;
}

/**
 * Phân đoạn kịch bản thoại (Sentence / Segment Level)
 * Hỗ trợ speaker turn-taking cho Part 3 (Speaker A/B, Man/Woman)
 */
export interface ToeicListeningTranscriptSegment {
  id: string;
  speaker?: string;
  text: string;
  startMs?: number;
  endMs?: number;
}

export interface ToeicListeningTranscript {
  /** Toàn bộ nội dung văn bản kịch bản thoại */
  fullText: string;
  /** Danh sách các câu thoại phân đoạn */
  segments: ToeicListeningTranscriptSegment[];
  /** Cờ xác nhận kịch bản có timing chính xác hay là text tĩnh */
  hasTiming: boolean;
}

/**
 * Câu hỏi Listening chuẩn hóa.
 * Tuyệt đối không sao chép lại audioScript hay audioMetadata của Group.
 */
export interface ToeicListeningQuestion {
  /** ID câu hỏi ổn định (bảo tồn nguyên vẹn ID legacy) */
  id: string;
  /** Part câu hỏi thuộc về */
  part: ToeicListeningPart;
  /** ID nhóm cha bắt buộc */
  groupId: string;
  /** Định danh audio của nhóm cha bắt buộc */
  audioGroupId: string;
  /** Thứ tự câu hỏi trong nhóm (0-indexed) */
  orderIndex: number;
  /** Nội dung câu hỏi */
  questionText: string;
  /** Danh sách các lựa chọn (A, B, C, D hoặc A, B, C cho Part 2) */
  options: string[];
  /** Phương án đúng ('A' | 'B' | 'C' | 'D') */
  correctAnswer: string;
  /** Lời giải chi tiết */
  explanation: string;
  /** Bản dịch tiếng Việt */
  vietnameseTranslation: string;
  /** Từ vựng then chốt trích xuất */
  keyVocabulary?: ToeicVocabularyItem[];
  /** Độ khó */
  difficulty?: ToeicDifficulty;
  /** Chủ đề */
  topic?: string;
  /** Phân loại câu hỏi con */
  questionType?: string;
  /** Thẻ ngữ pháp */
  grammarTags?: string[];
  /** Thẻ từ vựng */
  vocabularyTags?: string[];
  /** Ước lượng độ khó heuristic (100 - 990) */
  estimatedDifficulty?: number;
}

/**
 * Base Group Model cho toàn bộ các nhóm Listening
 */
export interface BaseToeicListeningGroup {
  /** ID nhóm ổn định */
  id: string;
  /** Định danh âm thanh duy nhất của nhóm (Anti-duplicate Invariant) */
  audioGroupId: string;
  /** Part của nhóm */
  part: ToeicListeningPart;
  /** Tiêu đề nhóm nếu có */
  title?: string;
  /** Chủ đề ngữ cảnh */
  topic?: string;
  /** Độ khó tổng thể */
  difficulty?: ToeicDifficulty;
  /** Ước lượng độ khó heuristic */
  estimatedDifficulty?: number;
  /** Nguồn âm thanh duy nhất của nhóm */
  audioSource: ToeicListeningAudioSource;
  /** Lời thoại kịch bản chuẩn hóa */
  transcript: ToeicListeningTranscript;
  /** Danh sách các questionId thuộc nhóm theo thứ tự hiển thị */
  questionIds: string[];
}

/**
 * Part 1: Photographs (1 hình ảnh + 1 audio + 1 câu hỏi)
 */
export interface Part1ListeningGroup extends BaseToeicListeningGroup {
  part: 'part1_photos';
  /** Bắt buộc có đường dẫn hình ảnh cho Part 1 */
  imageUrl: string;
}

/**
 * Part 2: Question & Response (1 audio sequence: Stem -> A -> B -> C + 1 câu hỏi)
 */
export interface Part2ListeningGroup extends BaseToeicListeningGroup {
  part: 'part2_qna';
}

/**
 * Part 3: Short Conversations (1 cuộc hội thoại + 1 audio + 3 câu hỏi)
 */
export interface Part3ListeningGroup extends BaseToeicListeningGroup {
  part: 'part3_conv';
}

/**
 * Part 4: Short Talks (1 bài nói độc thoại + 1 audio + 3 câu hỏi)
 */
export interface Part4ListeningGroup extends BaseToeicListeningGroup {
  part: 'part4_talks';
  /** Hình ảnh bảng biểu / biểu đồ đi kèm nếu có */
  imageUrl?: string;
}

/**
 * Union type cho nhóm Listening chuẩn hóa
 */
export type NormalizedToeicListeningGroup =
  | Part1ListeningGroup
  | Part2ListeningGroup
  | Part3ListeningGroup
  | Part4ListeningGroup;

/**
 * Cấu trúc tập hợp dữ liệu Listening đã chuẩn hóa hoàn chỉnh
 */
export interface NormalizedListeningDataset {
  /** Danh sách toàn bộ các nhóm nghe */
  groups: NormalizedToeicListeningGroup[];
  /** Danh sách toàn bộ các câu hỏi nghe (đã tách rời audio payload) */
  questions: ToeicListeningQuestion[];
  /** Tra cứu nhóm theo groupId */
  groupById: Map<string, NormalizedToeicListeningGroup>;
  /** Tra cứu câu hỏi theo questionId */
  questionById: Map<string, ToeicListeningQuestion>;
  /** Tra cứu danh sách câu hỏi con theo groupId */
  questionsByGroupId: Map<string, ToeicListeningQuestion[]>;
  /** Tra cứu nhóm theo audioGroupId (Invariant: 1 audio -> 1 group) */
  groupByAudioId: Map<string, NormalizedToeicListeningGroup>;
  /** Thống kê cấu trúc */
  stats: {
    totalGroups: number;
    totalQuestions: number;
    byPart: Record<ToeicListeningPart, { groupCount: number; questionCount: number }>;
  };
}

/**
 * Báo cáo kiểm định tính toàn vẹn của dataset Listening
 */
export interface ToeicListeningValidationReport {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  stats: {
    totalGroups: number;
    totalQuestions: number;
    byPart: Record<ToeicListeningPart, { groupCount: number; questionCount: number }>;
    orphanedQuestions: number;
    duplicateAudioIdentities: number;
  };
}

/**
 * =============================================================================
 * TOEIC LISTENING PLAYBACK POLICY & ENGINE CONTRACTS (PHASE 3)
 * =============================================================================
 */

/**
 * Central Playback Policy:
 * Điều khiển quyền hạn phát âm thanh tập trung theo chế độ trải nghiệm:
 * Practice (thoải mái, hỗ trợ học tập) vs Mock / Diagnostic (nghiêm ngặt chuẩn ETS).
 */
export interface ListeningPlaybackPolicy {
  /** Chế độ trải nghiệm */
  mode: 'mock' | 'practice' | 'diagnostic' | string;
  /** Số lần tối đa được phát bài nghe: Mock = 1, Diagnostic = 1, Practice = Infinity */
  maxPlayCount: number;
  /** Cho phép tạm dừng âm thanh */
  allowPause: boolean;
  /** Cho phép tua âm thanh */
  allowSeek: boolean;
  /** Cho phép nghe lại từ đầu */
  allowReplay: boolean;
  /** Cho phép thay đổi tốc độ phát (0.85x - 1.25x) */
  allowSpeedControl: boolean;
  /** Cho phép hiển thị lời thoại kịch bản (Transcript) */
  showTranscript: boolean;
  /** Cho phép hiển thị highlight đồng bộ thời gian (Karaoke text) */
  showHighlight: boolean;
  /** Alias tương thích ngược với allowTranscript */
  allowTranscript?: boolean;
  /** Alias tương thích ngược với allowHighlight */
  allowHighlight?: boolean;
  /** Tự động chuyển câu sau khi kết thúc nghe */
  autoAdvanceOnEnd?: boolean;
}

export const DEFAULT_LISTENING_POLICIES: Record<'mock' | 'practice' | 'diagnostic', ListeningPlaybackPolicy> = {
  mock: {
    mode: 'mock',
    maxPlayCount: 1,
    allowPause: false, // ETS: Phát 1 mạch không dừng
    allowSeek: false,
    allowReplay: false,
    allowSpeedControl: false,
    showTranscript: false,
    showHighlight: false,
    allowTranscript: false,
    allowHighlight: false,
    autoAdvanceOnEnd: false,
  },
  diagnostic: {
    mode: 'diagnostic',
    maxPlayCount: 1,
    allowPause: false,
    allowSeek: false,
    allowReplay: false,
    allowSpeedControl: false,
    showTranscript: false,
    showHighlight: false,
    allowTranscript: false,
    allowHighlight: false,
    autoAdvanceOnEnd: false,
  },
  practice: {
    mode: 'practice',
    maxPlayCount: Infinity,
    allowPause: true,
    allowSeek: true,
    allowReplay: true,
    allowSpeedControl: true,
    showTranscript: true,
    showHighlight: true,
    allowTranscript: true,
    allowHighlight: true,
    autoAdvanceOnEnd: false,
  },
};

export function getListeningPlaybackPolicy(mode?: string): ListeningPlaybackPolicy {
  if (mode === 'mock') return DEFAULT_LISTENING_POLICIES.mock;
  if (mode === 'diagnostic') return DEFAULT_LISTENING_POLICIES.diagnostic;
  return DEFAULT_LISTENING_POLICIES.practice;
}

export function createListeningPlaybackPolicyFromExperience(
  expConfig?: ExamExperienceConfig | null,
  mode = 'practice'
): ListeningPlaybackPolicy {
  if (!expConfig) {
    return getListeningPlaybackPolicy(mode);
  }
  const isMock = !expConfig.allowAudioReplay;
  return {
    mode,
    maxPlayCount: isMock ? 1 : Infinity,
    allowPause: true,
    allowSeek: expConfig.allowAudioReplay,
    allowReplay: expConfig.allowAudioReplay,
    allowSpeedControl: expConfig.allowAudioReplay,
    showTranscript: expConfig.allowTranscript,
    showHighlight: expConfig.allowTranscript,
    allowTranscript: expConfig.allowTranscript,
    allowHighlight: expConfig.allowTranscript,
    autoAdvanceOnEnd: false,
  };
}

export type ToeicListeningEngineStatus =
  | 'idle'
  | 'loading'
  | 'ready'
  | 'playing'
  | 'paused'
  | 'ended'
  | 'error';

export interface ToeicListeningEngineState {
  status: ToeicListeningEngineStatus;
  currentGroupId: string | null;
  currentAudioGroupId: string | null;
  sourceType: ToeicAudioSourceType;
  audioUrl: string | null;
  currentTimeMs: number;
  durationMs: number;
  playbackRate: number;
  volume: number;
  isMuted: boolean;
  hasPlayed: boolean;
  playCount: number;
  activeSegmentIndex: number;
  activeSegment: ToeicListeningTranscriptSegment | null;
  isEligibleToPlay: boolean;
  errorMessage?: string;
  part2SequenceStep?: 'prompt' | 'option_a' | 'option_b' | 'option_c' | 'completed';
}

export type ToeicListeningStateListener = (state: ToeicListeningEngineState) => void;

export interface IToeicListeningEngine {
  loadGroup(
    group: NormalizedToeicListeningGroup,
    policy?: ListeningPlaybackPolicy,
    initialPlayCount?: number
  ): void;
  setPolicy(policy: ListeningPlaybackPolicy): void;
  play(): Promise<void>;
  pause(): void;
  togglePlay(): void;
  seek(timeMs: number): void;
  restart(): void;
  stop(): void;
  setPlaybackRate(rate: number): void;
  setVolume(vol: number): void;
  toggleMute(): void;
  dispose(): void;
  getState(): Readonly<ToeicListeningEngineState>;
  subscribe(listener: ToeicListeningStateListener): () => void;
}

