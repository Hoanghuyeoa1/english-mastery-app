// src/services/toeicAudioResolver.ts
import {
  ToeicAudioMetadata,
  ToeicAudioTimingSegment,
  ToeicAudioTokenTiming,
  ToeicAudioAccent,
  ToeicAudioFormat,
  ToeicAmbientAudioConfig,
  ToeicQuestion,
  ToeicQuestionGroup,
  ToeicPart,
} from '../types/toeic';

/**
 * =============================================================================
 * TOEIC AUDIO VALIDATION & RESOLUTION INTERFACES (PHASE 1)
 * =============================================================================
 */

export type ToeicAudioValidationSeverity = 'error' | 'warning';

export interface ToeicAudioValidationIssue {
  code: string;
  message: string;
  severity: ToeicAudioValidationSeverity;
  field?: string;
  segmentIndex?: number;
}

export interface ToeicAudioValidationResult {
  /**
   * isValid === true nếu MP3 URL hợp lệ và có thể phát được (không gặp fatal error).
   * Lưu ý: Nếu timing segments bị lỗi nhưng URL hợp lệ, isValid vẫn là TRUE
   * (Graceful Degradation: MP3 vẫn nghe được bình thường, chỉ tắt karaoke highlight).
   */
  isValid: boolean;
  /**
   * isTimingValid === true nếu toàn bộ segments và token timings nhất quán,
   * không bị âm, không bị endMs < startMs, không bị out of bounds.
   */
  isTimingValid: boolean;
  hasAudioUrl: boolean;
  issues: ToeicAudioValidationIssue[];
}

export type ResolvedToeicAudioSourceType = 'mp3' | 'tts' | 'none';

export interface ResolvedToeicAudioSource {
  sourceType: ResolvedToeicAudioSourceType;
  /**
   * URL audio nếu sourceType === 'mp3'
   */
  audioUrl?: string;
  /**
   * Script văn bản đọc bằng Web Speech API nếu sourceType === 'tts'
   */
  textToSpeak?: string;
  /**
   * Accent chuẩn hóa (en-US, en-GB, en-AU, en-CA)
   */
  accent: ToeicAudioAccent;
  /**
   * Tốc độ phát (1.0 cho audio tự nhiên, 0.85 cho TTS)
   */
  rate: number;
  /**
   * Thời lượng tính bằng mili-giây nếu có
   */
  durationMs?: number;
  /**
   * Danh sách segment phân đoạn đồng bộ (nếu hợp lệ)
   */
  timingSegments?: ToeicAudioTimingSegment[];
  /**
   * Cờ xác định timing có đủ an toàn để render karaoke highlight hay không
   */
  hasValidTiming: boolean;
  /**
   * Cấu hình âm thanh nền (tiếng ồn phòng thi ETS / văn phòng)
   */
  ambientConfig?: ToeicAmbientAudioConfig;
  /**
   * Danh sách các issue/warning phát hiện được trong quá trình validate
   */
  validationIssues: ToeicAudioValidationIssue[];
  /**
   * Lý do fallback (nếu chuyển từ MP3 sang TTS hoặc từ Forced MP3 sang none)
   */
  fallbackReason?: string;
  /**
   * Đánh dấu bài nghe được kế thừa từ ToeicQuestionGroup cha
   */
  isInheritedFromGroup?: boolean;
}

export interface ResolveToeicAudioInput {
  audioMetadata?: ToeicAudioMetadata | null;
  audioScript?: string | null;
  questionText?: string | null;
  part?: ToeicPart | string;
  groupAudioMetadata?: ToeicAudioMetadata | null;
  groupAudioScript?: string | null;
}

export interface ResolveToeicAudioOptions {
  /**
   * Chế độ ép nguồn phát:
   * - 'auto': Ưu tiên MP3 hợp lệ, fallback an toàn sang TTS
   * - 'mp3': Ép dùng MP3; nếu không có MP3 hợp lệ -> sourceType = 'none'
   * - 'tts': Ép dùng TTS (ví dụ dev preview hoặc browser offline không tải được MP3)
   */
  forcedSource?: 'auto' | 'mp3' | 'tts';
  /**
   * Accent ưu tiên khi metadata không khai báo giọng đọc cụ thể
   */
  preferredAccent?: ToeicAudioAccent;
  /**
   * Tốc độ phát tùy biến
   */
  speechRate?: number;
  /**
   * Cho phép thừa kế audio từ group cha nếu question con không có (mặc định: true)
   */
  inheritFromGroup?: boolean;
}

/**
 * Danh sách format audio được hỗ trợ chính thức
 */
export const SUPPORTED_AUDIO_FORMATS: ReadonlyArray<ToeicAudioFormat> = ['mp3', 'aac', 'wav', 'ogg'];

/**
 * Các đuôi mở rộng file audio hợp lệ
 */
const SUPPORTED_EXTENSIONS = ['.mp3', '.aac', '.wav', '.ogg', '.m4a', '.mp4'];

/**
 * Các đuôi file cấm / nguy hại hoặc không phải audio
 */
const UNSUPPORTED_EXTENSIONS = ['.exe', '.bat', '.sh', '.pdf', '.doc', '.docx', '.html', '.zip', '.tar', '.js', '.ts', '.json'];

/**
 * =============================================================================
 * PURE VALIDATION FUNCTIONS
 * =============================================================================
 */

/**
 * Kiểm tra tính an toàn và toàn vẹn của ToeicAudioMetadata.
 * Đảm bảo:
 * - Không ném ngoại lệ runtime.
 * - Phân định rõ ràng: URL hư hại vs Timing hư hại.
 * - Graceful degradation: Timing lỗi không làm gãy khả năng phát MP3.
 */
export function validateToeicAudioMetadata(metadata?: unknown): ToeicAudioValidationResult {
  const issues: ToeicAudioValidationIssue[] = [];

  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return {
      isValid: false,
      isTimingValid: false,
      hasAudioUrl: false,
      issues: [
        {
          code: 'MISSING_METADATA',
          message: 'Không tìm thấy đối tượng audio metadata.',
          severity: 'warning',
        },
      ],
    };
  }

  const meta = metadata as Partial<ToeicAudioMetadata>;
  let hasFatalUrlError = false;
  let hasTimingError = false;

  // 1. Kiểm tra URL
  if (typeof meta.url !== 'string' || meta.url.trim() === '') {
    issues.push({
      code: 'EMPTY_URL',
      message: 'Đường dẫn âm thanh (url) bị rỗng hoặc không phải chuỗi ký tự.',
      severity: 'error',
      field: 'url',
    });
    hasFatalUrlError = true;
  } else {
    const rawUrl = meta.url.trim();

    // Chặn unsafe protocols
    const lower = rawUrl.toLowerCase();
    if (lower.startsWith('javascript:') || lower.startsWith('vbscript:') || lower.startsWith('data:text/html')) {
      issues.push({
        code: 'UNSAFE_URL_PROTOCOL',
        message: 'Đường dẫn URL chứa giao thức không an toàn hoặc không được phép.',
        severity: 'error',
        field: 'url',
      });
      hasFatalUrlError = true;
    }

    // Kiểm tra đuôi file không hợp lệ
    for (const badExt of UNSUPPORTED_EXTENSIONS) {
      if (lower.endsWith(badExt) || lower.includes(`${badExt}?`)) {
        issues.push({
          code: 'UNSUPPORTED_EXTENSION',
          message: `Tệp âm thanh có định dạng không được hỗ trợ (${badExt}).`,
          severity: 'error',
          field: 'url',
        });
        hasFatalUrlError = true;
        break;
      }
    }
  }

  // 2. Kiểm tra format nếu được cung cấp
  if (meta.format !== undefined && meta.format !== null) {
    if (!SUPPORTED_AUDIO_FORMATS.includes(meta.format as ToeicAudioFormat)) {
      issues.push({
        code: 'UNSUPPORTED_FORMAT',
        message: `Định dạng audio "${meta.format}" không nằm trong danh mục hỗ trợ (${SUPPORTED_AUDIO_FORMATS.join(', ')}).`,
        severity: 'error',
        field: 'format',
      });
      hasFatalUrlError = true;
    }
  }

  // 3. Kiểm tra durationMs
  if (meta.durationMs !== undefined && meta.durationMs !== null) {
    if (typeof meta.durationMs !== 'number' || Number.isNaN(meta.durationMs) || meta.durationMs < 0) {
      issues.push({
        code: 'INVALID_DURATION',
        message: 'Thời lượng durationMs phải là số dương hợp lệ.',
        severity: 'warning',
        field: 'durationMs',
      });
    }
  }

  // 4. Kiểm tra segments (Timing & Synchronization)
  if (meta.segments !== undefined && meta.segments !== null) {
    if (!Array.isArray(meta.segments)) {
      issues.push({
        code: 'MALFORMED_SEGMENTS_CONTAINER',
        message: 'Trường segments phải là một mảng danh sách phân đoạn.',
        severity: 'error',
        field: 'segments',
      });
      hasTimingError = true;
    } else {
      let previousEndMs = 0;

      for (let i = 0; i < meta.segments.length; i++) {
        const seg = meta.segments[i];

        if (!seg || typeof seg !== 'object') {
          issues.push({
            code: 'MALFORMED_SEGMENT',
            message: `Segment tại vị trí #${i} không phải là một object hợp lệ.`,
            severity: 'error',
            field: 'segments',
            segmentIndex: i,
          });
          hasTimingError = true;
          continue;
        }

        const { startMs, endMs, text, tokens } = seg as Partial<ToeicAudioTimingSegment>;

        // startMs validation
        if (typeof startMs !== 'number' || Number.isNaN(startMs) || startMs < 0) {
          issues.push({
            code: 'NEGATIVE_START_TIMING',
            message: `Segment #${i} có startMs không hợp lệ hoặc âm (${startMs}).`,
            severity: 'error',
            field: 'startMs',
            segmentIndex: i,
          });
          hasTimingError = true;
        }

        // endMs validation
        if (typeof endMs !== 'number' || Number.isNaN(endMs) || endMs < 0) {
          issues.push({
            code: 'NEGATIVE_END_TIMING',
            message: `Segment #${i} có endMs không hợp lệ hoặc âm (${endMs}).`,
            severity: 'error',
            field: 'endMs',
            segmentIndex: i,
          });
          hasTimingError = true;
        }

        // Reversed interval check
        if (
          typeof startMs === 'number' &&
          typeof endMs === 'number' &&
          !Number.isNaN(startMs) &&
          !Number.isNaN(endMs) &&
          endMs < startMs
        ) {
          issues.push({
            code: 'REVERSED_INTERVAL',
            message: `Segment #${i} có thời điểm kết thúc trước thời điểm bắt đầu (endMs: ${endMs} < startMs: ${startMs}).`,
            severity: 'error',
            field: 'endMs',
            segmentIndex: i,
          });
          hasTimingError = true;
        }

        // Out of bounds vs total durationMs
        if (
          typeof endMs === 'number' &&
          typeof meta.durationMs === 'number' &&
          meta.durationMs > 0 &&
          endMs > meta.durationMs + 250 // Cho phép buffer 250ms cho độ lệch làm tròn
        ) {
          issues.push({
            code: 'OUT_OF_BOUNDS_TIMING',
            message: `Segment #${i} kết thúc vượt quá tổng thời lượng bài nghe (endMs: ${endMs} > durationMs: ${meta.durationMs}).`,
            severity: 'warning',
            field: 'endMs',
            segmentIndex: i,
          });
        }

        // Ordering & Overlap check
        if (typeof startMs === 'number' && !Number.isNaN(startMs)) {
          if (i > 0 && startMs < previousEndMs) {
            issues.push({
              code: 'OVERLAPPING_SEGMENT',
              message: `Segment #${i} (startMs: ${startMs}) xuất hiện trước khi segment trước đó kết thúc (endMs: ${previousEndMs}).`,
              severity: 'warning',
              field: 'startMs',
              segmentIndex: i,
            });
          }
        }

        if (typeof endMs === 'number' && !Number.isNaN(endMs)) {
          previousEndMs = Math.max(previousEndMs, endMs);
        }

        // Missing text check
        if (typeof text !== 'string' || text.trim() === '') {
          issues.push({
            code: 'EMPTY_SEGMENT_TEXT',
            message: `Segment #${i} không có nội dung văn bản (text).`,
            severity: 'warning',
            field: 'text',
            segmentIndex: i,
          });
        }

        // Token timing check (if present)
        if (tokens !== undefined && tokens !== null) {
          if (!Array.isArray(tokens)) {
            issues.push({
              code: 'MALFORMED_TOKENS_CONTAINER',
              message: `Segment #${i} có trường tokens không phải là mảng.`,
              severity: 'error',
              field: 'tokens',
              segmentIndex: i,
            });
            hasTimingError = true;
          } else {
            for (let t = 0; t < tokens.length; t++) {
              const tok = tokens[t];
              if (!tok || typeof tok !== 'object') {
                issues.push({
                  code: 'MALFORMED_TOKEN',
                  message: `Segment #${i} token #${t} không hợp lệ.`,
                  severity: 'error',
                  field: 'tokens',
                  segmentIndex: i,
                });
                hasTimingError = true;
                continue;
              }
              const { startMs: tStart, endMs: tEnd } = tok as Partial<ToeicAudioTokenTiming>;
              if (
                typeof tStart !== 'number' ||
                typeof tEnd !== 'number' ||
                Number.isNaN(tStart) ||
                Number.isNaN(tEnd) ||
                tStart < 0 ||
                tEnd < tStart
              ) {
                issues.push({
                  code: 'INVALID_TOKEN_TIMING',
                  message: `Segment #${i} token #${t} có khoảng thời gian không hợp lệ (start: ${tStart}, end: ${tEnd}).`,
                  severity: 'error',
                  field: 'tokens',
                  segmentIndex: i,
                });
                hasTimingError = true;
              }
            }
          }
        }
      }
    }
  }

  // 5. Kiểm tra ambient config
  if (meta.ambient !== undefined && meta.ambient !== null) {
    if (typeof meta.ambient === 'object') {
      const { volume, enabled, url } = meta.ambient;
      if (volume !== undefined && volume !== null) {
        if (typeof volume !== 'number' || Number.isNaN(volume) || volume < 0 || volume > 1) {
          issues.push({
            code: 'INVALID_AMBIENT_VOLUME',
            message: 'Âm lượng nền ambient.volume phải nằm trong khoảng [0.0, 1.0].',
            severity: 'warning',
            field: 'ambient.volume',
          });
        }
      }
      if (enabled === true && (typeof url !== 'string' || url.trim() === '')) {
        issues.push({
          code: 'MISSING_AMBIENT_URL',
          message: 'Ambient audio được kích hoạt nhưng chưa cấu hình đường dẫn url.',
          severity: 'warning',
          field: 'ambient.url',
        });
      }
    }
  }

  const isValid = !hasFatalUrlError;
  const isTimingValid = isValid && !hasTimingError;
  const hasAudioUrl = typeof meta.url === 'string' && meta.url.trim().length > 0;

  return {
    isValid,
    isTimingValid,
    hasAudioUrl,
    issues,
  };
}

/**
 * =============================================================================
 * AUDIO SOURCE RESOLVER (PHASE 1)
 * =============================================================================
 */

/**
 * Trích xuất input chuẩn từ ToeicQuestion, ToeicQuestionGroup hoặc ResolveToeicAudioInput thuần
 */
export function extractAudioInput(
  item: ToeicQuestion | ToeicQuestionGroup | ResolveToeicAudioInput,
  parentGroup?: ToeicQuestionGroup | null
): ResolveToeicAudioInput {
  // Case 1: Plain ResolveToeicAudioInput đã đầy đủ
  if ('audioMetadata' in item || 'audioScript' in item) {
    const raw = item as Record<string, any>;
    return {
      audioMetadata: raw.audioMetadata || null,
      audioScript: raw.audioScript || null,
      questionText: raw.questionText || null,
      part: raw.part || undefined,
      groupAudioMetadata: raw.groupAudioMetadata || parentGroup?.audioMetadata || null,
      groupAudioScript: raw.groupAudioScript || parentGroup?.audioScript || null,
    };
  }

  return {
    audioMetadata: null,
    audioScript: null,
    questionText: null,
    groupAudioMetadata: parentGroup?.audioMetadata || null,
    groupAudioScript: parentGroup?.audioScript || null,
  };
}

/**
 * Pure Audio Source Resolver:
 * Xác định nguồn âm thanh tối ưu (MP3 hợp lệ vs TTS Web Speech API) theo đúng
 * nguyên lý graceful degradation và không phụ thuộc vào React Component lifecycle.
 */
export function resolveToeicAudioSource(
  input: ToeicQuestion | ToeicQuestionGroup | ResolveToeicAudioInput,
  parentGroupOrOptions?: ToeicQuestionGroup | ResolveToeicAudioOptions | null,
  maybeOptions?: ResolveToeicAudioOptions
): ResolvedToeicAudioSource {
  // Phân giải arguments cho phép gọi linh hoạt:
  // 1. resolveToeicAudioSource(question, options)
  // 2. resolveToeicAudioSource(question, parentGroup, options)
  let parentGroup: ToeicQuestionGroup | null = null;
  let options: ResolveToeicAudioOptions = {};

  if (parentGroupOrOptions && 'questionIds' in parentGroupOrOptions) {
    parentGroup = parentGroupOrOptions as ToeicQuestionGroup;
    options = maybeOptions || {};
  } else if (parentGroupOrOptions) {
    options = parentGroupOrOptions as ResolveToeicAudioOptions;
  }

  const normalizedInput = extractAudioInput(input, parentGroup);
  const inheritFromGroup = options.inheritFromGroup !== false;
  const forcedSource = options.forcedSource || 'auto';
  const preferredAccent: ToeicAudioAccent = options.preferredAccent || 'en-US';
  const baseTtsRate = options.speechRate ?? 0.85;
  const baseMp3Rate = options.speechRate ?? 1.0;

  const collectedIssues: ToeicAudioValidationIssue[] = [];

  // =========================================================================
  // CASE 1: FORCED TTS
  // =========================================================================
  if (forcedSource === 'tts') {
    const candidateScript =
      normalizedInput.audioScript?.trim() ||
      (inheritFromGroup ? normalizedInput.groupAudioScript?.trim() : undefined) ||
      normalizedInput.questionText?.trim() ||
      '';

    if (!candidateScript) {
      return {
        sourceType: 'none',
        accent: preferredAccent,
        rate: baseTtsRate,
        hasValidTiming: false,
        validationIssues: collectedIssues,
        fallbackReason: 'FORCED_TTS_BUT_NO_SCRIPT_AVAILABLE',
      };
    }

    const resolvedAccent =
      normalizedInput.audioMetadata?.accent ||
      normalizedInput.groupAudioMetadata?.accent ||
      preferredAccent;

    return {
      sourceType: 'tts',
      textToSpeak: candidateScript,
      accent: resolvedAccent,
      rate: baseTtsRate,
      hasValidTiming: false,
      validationIssues: collectedIssues,
      fallbackReason: 'FORCED_TTS',
    };
  }

  // =========================================================================
  // STEP A: Kiểm tra audioMetadata của chính đối tượng (Question hoặc Group)
  // =========================================================================
  if (normalizedInput.audioMetadata) {
    const valResult = validateToeicAudioMetadata(normalizedInput.audioMetadata);
    collectedIssues.push(...valResult.issues);

    if (valResult.isValid) {
      const meta = normalizedInput.audioMetadata;
      const hasSegments = Boolean(meta.segments && meta.segments.length > 0);
      const isTimingUsable = valResult.isTimingValid && hasSegments;

      return {
        sourceType: 'mp3',
        audioUrl: meta.url.trim(),
        durationMs: meta.durationMs,
        accent: meta.accent || preferredAccent,
        rate: baseMp3Rate,
        // Graceful Degradation: Nếu timing lỗi hoặc không có segments, chỉ tắt segments chứ không làm hỏng playback MP3!
        timingSegments: isTimingUsable ? meta.segments : undefined,
        hasValidTiming: isTimingUsable,
        ambientConfig: meta.ambient,
        validationIssues: collectedIssues,
        isInheritedFromGroup: false,
      };
    }
  }

  // =========================================================================
  // STEP B: Kiểm tra audioMetadata kế thừa từ QuestionGroup cha (nếu có)
  // =========================================================================
  if (inheritFromGroup && normalizedInput.groupAudioMetadata) {
    const groupValResult = validateToeicAudioMetadata(normalizedInput.groupAudioMetadata);
    collectedIssues.push(...groupValResult.issues);

    if (groupValResult.isValid) {
      const meta = normalizedInput.groupAudioMetadata;
      const hasSegments = Boolean(meta.segments && meta.segments.length > 0);
      const isTimingUsable = groupValResult.isTimingValid && hasSegments;

      return {
        sourceType: 'mp3',
        audioUrl: meta.url.trim(),
        durationMs: meta.durationMs,
        accent: meta.accent || preferredAccent,
        rate: baseMp3Rate,
        timingSegments: isTimingUsable ? meta.segments : undefined,
        hasValidTiming: isTimingUsable,
        ambientConfig: meta.ambient,
        validationIssues: collectedIssues,
        isInheritedFromGroup: true,
      };
    }
  }

  // =========================================================================
  // CASE 2: FORCED MP3 nhưng không có MP3 hợp lệ
  // =========================================================================
  if (forcedSource === 'mp3') {
    return {
      sourceType: 'none',
      accent: preferredAccent,
      rate: baseMp3Rate,
      hasValidTiming: false,
      validationIssues: collectedIssues,
      fallbackReason: 'FORCED_MP3_UNAVAILABLE',
    };
  }

  // =========================================================================
  // STEP C: FALLBACK SANG TTS (Web Speech API)
  // =========================================================================
  const ttsScript =
    normalizedInput.audioScript?.trim() ||
    (inheritFromGroup ? normalizedInput.groupAudioScript?.trim() : undefined) ||
    normalizedInput.questionText?.trim() ||
    '';

  if (ttsScript) {
    const fallbackAccent =
      normalizedInput.audioMetadata?.accent ||
      normalizedInput.groupAudioMetadata?.accent ||
      preferredAccent;

    const hadBrokenMetadata = Boolean(
      normalizedInput.audioMetadata || (inheritFromGroup && normalizedInput.groupAudioMetadata)
    );

    return {
      sourceType: 'tts',
      textToSpeak: ttsScript,
      accent: fallbackAccent,
      rate: baseTtsRate,
      hasValidTiming: false,
      validationIssues: collectedIssues,
      fallbackReason: hadBrokenMetadata
        ? 'INVALID_AUDIO_METADATA_FALLBACK_TTS'
        : 'NO_AUDIO_METADATA_LEGACY_TTS',
    };
  }

  // =========================================================================
  // STEP D: KHÔNG CÓ CẢ AUDIO LẪN VĂN BẢN
  // =========================================================================
  return {
    sourceType: 'none',
    accent: preferredAccent,
    rate: baseTtsRate,
    hasValidTiming: false,
    validationIssues: collectedIssues,
    fallbackReason: 'NO_AUDIO_OR_SCRIPT_AVAILABLE',
  };
}

/**
 * =============================================================================
 * UTILITY HELPERS
 * =============================================================================
 */

/**
 * Kiểm tra xem audio source đã phân giải có thể phát được không
 */
export function isToeicAudioPlayable(source: ResolvedToeicAudioSource): boolean {
  if (source.sourceType === 'mp3') {
    return Boolean(source.audioUrl && source.audioUrl.trim().length > 0);
  }
  if (source.sourceType === 'tts') {
    return Boolean(source.textToSpeak && source.textToSpeak.trim().length > 0);
  }
  return false;
}

/**
 * Định dạng mili-giây thành định dạng MM:SS thân thiện người dùng
 */
export function formatAudioTime(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return '00:00';
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

/**
 * Tìm kiếm Segment và Token đang hoạt động tại thời điểm mili-giây xác định
 */
export function findActiveAudioSegment(
  segments?: ToeicAudioTimingSegment[],
  currentTimeMs = 0
): {
  segment: ToeicAudioTimingSegment | null;
  segmentIndex: number;
  activeToken: ToeicAudioTokenTiming | null;
} {
  if (!segments || segments.length === 0 || currentTimeMs < 0) {
    return { segment: null, segmentIndex: -1, activeToken: null };
  }

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    if (currentTimeMs >= seg.startMs && currentTimeMs <= seg.endMs) {
      let activeToken: ToeicAudioTokenTiming | null = null;
      if (seg.tokens && seg.tokens.length > 0) {
        for (const tok of seg.tokens) {
          if (currentTimeMs >= tok.startMs && currentTimeMs <= tok.endMs) {
            activeToken = tok;
            break;
          }
        }
      }
      return { segment: seg, segmentIndex: i, activeToken };
    }
  }

  return { segment: null, segmentIndex: -1, activeToken: null };
}

/**
 * Giới hạn âm lượng trong khoảng an toàn [0.0, 1.0]
 */
export function clampAudioVolume(volume: unknown, fallback = 0.5): number {
  if (typeof volume !== 'number' || Number.isNaN(volume)) return fallback;
  return Math.max(0, Math.min(1, volume));
}
