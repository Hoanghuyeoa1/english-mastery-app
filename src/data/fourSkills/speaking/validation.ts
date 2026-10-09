import { SpeakingPrompt, SpeakingTurn, SpeakingCategory } from '../types';
import { CEFRLevel } from '../../../types';

export const VALID_CEFR_LEVELS: readonly CEFRLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const;

export const VALID_SPEAKING_CATEGORIES: readonly SpeakingCategory[] = [
  'Agile Standup',
  'Job Interview',
  'Workplace Negotiation',
  'Daily Conversation',
  'Tech Support',
  'Academic & IELTS',
  'Social & Travel',
  'Business Meeting',
] as const;

export interface SpeakingDurationTarget {
  minSeconds: number;
  maxSeconds: number;
  label: string;
}

export const SPEAKING_DURATION_TARGETS: Record<CEFRLevel, SpeakingDurationTarget> = {
  A1: { minSeconds: 20, maxSeconds: 40, label: '20–40s' },
  A2: { minSeconds: 30, maxSeconds: 60, label: '30–60s' },
  B1: { minSeconds: 60, maxSeconds: 90, label: '60–90s' },
  B2: { minSeconds: 90, maxSeconds: 120, label: '90–120s' },
  C1: { minSeconds: 120, maxSeconds: 180, label: '2–3 min' },
  C2: { minSeconds: 180, maxSeconds: 240, label: '3–4 min' },
};

export interface ValidationIssue {
  promptId: string;
  turnIndex?: number;
  field: string;
  message: string;
  severity: 'error' | 'warning';
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

export interface ValidateSpeakingOptions {
  /**
   * If true, also checks distribution across A1-C2 (24 lessons, 4 per band)
   */
  requireFullDistribution?: boolean;
  /**
   * If true, allows legacy compound levels like 'A2-B1', 'B1-B2', 'B2-C1'
   */
  allowLegacyLevels?: boolean;
}

/**
 * Parses duration string into approximate seconds.
 * Supports "20-40s", "30s", "1:30", "2 min", "2-3 min", etc.
 */
export function parseSpeakingDurationToSeconds(durationStr?: string): number {
  if (!durationStr) return 0;
  const cleaned = durationStr.trim().toLowerCase();

  // Pattern "MM:SS"
  if (cleaned.includes(':')) {
    const parts = cleaned.split(':').map((p) => parseFloat(p));
    if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
      return Math.max(0, parts[0] * 60 + parts[1]);
    }
  }

  // Pattern range like "2-3 min" or "20-40s"
  const rangeMatch = cleaned.match(/(\d+)\s*[-–]\s*(\d+)\s*(s|sec|min|m)?/);
  if (rangeMatch) {
    const low = parseFloat(rangeMatch[1]);
    const high = parseFloat(rangeMatch[2]);
    const unit = rangeMatch[3] || (cleaned.includes('min') ? 'min' : 's');
    const avg = (low + high) / 2;
    return unit.startsWith('min') || unit === 'm' ? avg * 60 : avg;
  }

  // Pattern "X min" or "X m"
  if (cleaned.includes('min') || cleaned.endsWith('m')) {
    const val = parseFloat(cleaned);
    if (!isNaN(val)) return val * 60;
  }

  // Pattern "Xs"
  if (cleaned.endsWith('s')) {
    const val = parseFloat(cleaned.replace('s', ''));
    if (!isNaN(val)) return val;
  }

  const num = parseFloat(cleaned);
  return !isNaN(num) && num > 0 ? num : 0;
}

/**
 * Estimates spoken duration in seconds from the total words in a prompt's dialogue turns.
 * Assumes normal conversational pace (~130 words per minute + 2.5s pause per turn).
 */
export function estimateSpeakingPromptDuration(prompt: SpeakingPrompt): number {
  if (!prompt.turns || prompt.turns.length === 0) return 0;
  let totalWords = 0;
  for (const turn of prompt.turns) {
    const pWords = (turn.partnerPrompt || '').trim().split(/\s+/).filter(Boolean).length;
    const tWords = (turn.targetSentence || '').trim().split(/\s+/).filter(Boolean).length;
    totalWords += pWords + tWords;
  }

  // ~130 wpm = ~2.17 words/sec, plus 2.5 seconds overhead/turn for reaction and turn switching
  const speechSec = totalWords / 2.17;
  const pauseSec = prompt.turns.length * 2.5;
  return Math.round(speechSec + pauseSec);
}

/**
 * Maps a SpeakingPrompt level to a canonical CEFRLevel.
 * Handles legacy compound levels gracefully:
 * 'A2-B1' -> 'A2'
 * 'B1-B2' -> 'B1'
 * 'B2-C1' -> 'B2'
 */
export function resolveCanonicalCefrLevel(level: string): CEFRLevel | null {
  const norm = (level || '').trim().toUpperCase();
  if (VALID_CEFR_LEVELS.includes(norm as CEFRLevel)) {
    return norm as CEFRLevel;
  }
  if (norm === 'A2-B1') return 'A2';
  if (norm === 'B1-B2') return 'B1';
  if (norm === 'B2-C1') return 'B2';
  return null;
}

const PLACEHOLDER_PATTERNS = [
  /\bTODO\b/i,
  /\bTBD\b/i,
  /\bplaceholder\b/i,
  /\blorem ipsum\b/i,
  /\bcoming soon\b/i,
  /\bchưa cập nhật\b/i,
];

function containsPlaceholder(text: string): boolean {
  if (!text) return false;
  return PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(text));
}

/**
 * Validates a single SpeakingPrompt against pedagogical and runtime contracts.
 */
export function validateSpeakingPrompt(
  prompt: SpeakingPrompt,
  options: ValidateSpeakingOptions = {}
): ValidationResult {
  const { allowLegacyLevels = true } = options;
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];
  const promptId = prompt.id?.trim() || '[empty_id]';

  // 1. ID check
  if (!prompt.id || !prompt.id.trim()) {
    errors.push({
      promptId,
      field: 'id',
      message: 'ID bài nói không được để trống.',
      severity: 'error',
    });
  }

  // 2. Title check
  if (!prompt.title || !prompt.title.trim()) {
    errors.push({
      promptId,
      field: 'title',
      message: 'Tiêu đề bài nói (title) không được để trống.',
      severity: 'error',
    });
  } else if (prompt.title.trim().length < 3) {
    errors.push({
      promptId,
      field: 'title',
      message: 'Tiêu đề bài nói quá ngắn (< 3 ký tự).',
      severity: 'error',
    });
  } else if (containsPlaceholder(prompt.title)) {
    errors.push({
      promptId,
      field: 'title',
      message: `Tiêu đề chứa placeholder text: "${prompt.title}".`,
      severity: 'error',
    });
  }

  // 3. Category check
  if (!prompt.category || !prompt.category.trim()) {
    errors.push({
      promptId,
      field: 'category',
      message: 'Danh mục (category) không được để trống.',
      severity: 'error',
    });
  } else if (!VALID_SPEAKING_CATEGORIES.includes(prompt.category)) {
    warnings.push({
      promptId,
      field: 'category',
      message: `Danh mục "${prompt.category}" không nằm trong danh sách chuẩn: ${VALID_SPEAKING_CATEGORIES.join(', ')}.`,
      severity: 'warning',
    });
  }

  // 4. Level check
  if (!prompt.level) {
    errors.push({
      promptId,
      field: 'level',
      message: 'Cấp độ (level) không được để trống.',
      severity: 'error',
    });
  } else {
    const isStandard = VALID_CEFR_LEVELS.includes(prompt.level as CEFRLevel);
    const isLegacy = ['A2-B1', 'B1-B2', 'B2-C1'].includes(prompt.level);

    if (!isStandard && !(allowLegacyLevels && isLegacy)) {
      errors.push({
        promptId,
        field: 'level',
        message: `Cấp độ "${prompt.level}" không hợp lệ. Phải là một trong: ${VALID_CEFR_LEVELS.join(', ')}.`,
        severity: 'error',
      });
    }
  }

  // 5. Scenario check
  if (!prompt.scenario || !prompt.scenario.trim()) {
    errors.push({
      promptId,
      field: 'scenario',
      message: 'Ngữ cảnh hội thoại (scenario) không được để trống.',
      severity: 'error',
    });
  } else if (prompt.scenario.trim().length < 10) {
    errors.push({
      promptId,
      field: 'scenario',
      message: 'Ngữ cảnh hội thoại (scenario) quá ngắn (< 10 ký tự).',
      severity: 'error',
    });
  } else if (containsPlaceholder(prompt.scenario)) {
    errors.push({
      promptId,
      field: 'scenario',
      message: 'Ngữ cảnh hội thoại chứa placeholder text.',
      severity: 'error',
    });
  }

  // 6. Turns check
  if (!Array.isArray(prompt.turns) || prompt.turns.length === 0) {
    errors.push({
      promptId,
      field: 'turns',
      message: 'Bài hội thoại phải có ít nhất 1 lượt thoại (turns rỗng).',
      severity: 'error',
    });
  } else if (prompt.turns.length < 2) {
    warnings.push({
      promptId,
      field: 'turns',
      message: `Hội thoại chỉ có ${prompt.turns.length} lượt. Khuyến nghị tối thiểu 2 lượt đối đáp.`,
      severity: 'warning',
    });
  } else {
    for (let tIdx = 0; tIdx < prompt.turns.length; tIdx++) {
      const turn = prompt.turns[tIdx];

      // turnIndex sequential
      if (typeof turn.turnIndex !== 'number' || turn.turnIndex !== tIdx) {
        errors.push({
          promptId,
          turnIndex: tIdx,
          field: `turns[${tIdx}].turnIndex`,
          message: `turnIndex (${turn.turnIndex}) không khớp với vị trí mảng (${tIdx}).`,
          severity: 'error',
        });
      }

      // partnerPrompt
      if (!turn.partnerPrompt || !turn.partnerPrompt.trim()) {
        errors.push({
          promptId,
          turnIndex: tIdx,
          field: `turns[${tIdx}].partnerPrompt`,
          message: `Lượt ${tIdx + 1}: partnerPrompt bị rỗng.`,
          severity: 'error',
        });
      } else if (containsPlaceholder(turn.partnerPrompt)) {
        errors.push({
          promptId,
          turnIndex: tIdx,
          field: `turns[${tIdx}].partnerPrompt`,
          message: `Lượt ${tIdx + 1}: partnerPrompt chứa placeholder text.`,
          severity: 'error',
        });
      }

      // targetSentence
      if (!turn.targetSentence || !turn.targetSentence.trim()) {
        errors.push({
          promptId,
          turnIndex: tIdx,
          field: `turns[${tIdx}].targetSentence`,
          message: `Lượt ${tIdx + 1}: targetSentence bị rỗng.`,
          severity: 'error',
        });
      } else if (containsPlaceholder(turn.targetSentence)) {
        errors.push({
          promptId,
          turnIndex: tIdx,
          field: `turns[${tIdx}].targetSentence`,
          message: `Lượt ${tIdx + 1}: targetSentence chứa placeholder text.`,
          severity: 'error',
        });
      }

      // phonetic
      if (!turn.phonetic || !turn.phonetic.trim()) {
        errors.push({
          promptId,
          turnIndex: tIdx,
          field: `turns[${tIdx}].phonetic`,
          message: `Lượt ${tIdx + 1}: phiên âm IPA (phonetic) bị rỗng.`,
          severity: 'error',
        });
      }

      // meaningVi
      if (!turn.meaningVi || !turn.meaningVi.trim()) {
        errors.push({
          promptId,
          turnIndex: tIdx,
          field: `turns[${tIdx}].meaningVi`,
          message: `Lượt ${tIdx + 1}: nghĩa tiếng Việt (meaningVi) bị rỗng.`,
          severity: 'error',
        });
      } else if (containsPlaceholder(turn.meaningVi)) {
        errors.push({
          promptId,
          turnIndex: tIdx,
          field: `turns[${tIdx}].meaningVi`,
          message: `Lượt ${tIdx + 1}: meaningVi chứa placeholder text.`,
          severity: 'error',
        });
      }

      // keyKeywords
      if (!Array.isArray(turn.keyKeywords) || turn.keyKeywords.length === 0) {
        errors.push({
          promptId,
          turnIndex: tIdx,
          field: `turns[${tIdx}].keyKeywords`,
          message: `Lượt ${tIdx + 1}: keyKeywords rỗng. Phải có ít nhất 1 từ khóa chấm điểm.`,
          severity: 'error',
        });
      } else {
        const emptyKw = turn.keyKeywords.some((kw) => !kw || !kw.trim());
        if (emptyKw) {
          errors.push({
            promptId,
            turnIndex: tIdx,
            field: `turns[${tIdx}].keyKeywords`,
            message: `Lượt ${tIdx + 1}: keyKeywords chứa phần tử rỗng.`,
            severity: 'error',
          });
        }
      }

      // sampleAudioText
      if (!turn.sampleAudioText || !turn.sampleAudioText.trim()) {
        errors.push({
          promptId,
          turnIndex: tIdx,
          field: `turns[${tIdx}].sampleAudioText`,
          message: `Lượt ${tIdx + 1}: sampleAudioText bị rỗng.`,
          severity: 'error',
        });
      }
    }
  }

  // 7. Duration check (suggested target, not hard fail)
  if (prompt.suggestedDuration) {
    const sec = parseSpeakingDurationToSeconds(prompt.suggestedDuration);
    if (sec <= 0) {
      warnings.push({
        promptId,
        field: 'suggestedDuration',
        message: `Định dạng suggestedDuration "${prompt.suggestedDuration}" không thể phân tích thời gian hợp lệ.`,
        severity: 'warning',
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
 * Validates an entire dataset of SpeakingPrompts.
 */
export function validateSpeakingDataset(
  prompts: readonly SpeakingPrompt[],
  options: ValidateSpeakingOptions = {}
): ValidationResult {
  const { requireFullDistribution = false, allowLegacyLevels = true } = options;
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];
  const seenIds = new Set<string>();

  for (let idx = 0; idx < prompts.length; idx++) {
    const prompt = prompts[idx];
    const promptId = prompt.id?.trim() || `[index_${idx}]`;

    // Duplicate ID check
    if (seenIds.has(promptId)) {
      errors.push({
        promptId,
        field: 'id',
        message: `Trùng lặp ID bài nói: "${promptId}".`,
        severity: 'error',
      });
    } else if (prompt.id && prompt.id.trim()) {
      seenIds.add(promptId);
    }

    const singleResult = validateSpeakingPrompt(prompt, { allowLegacyLevels });
    errors.push(...singleResult.errors);
    warnings.push(...singleResult.warnings);
  }

  if (requireFullDistribution) {
    const dist = validateSpeakingDistribution(prompts);
    if (!dist.valid) {
      for (const issue of dist.issues) {
        errors.push({
          promptId: '[DATASET_DISTRIBUTION]',
          field: 'distribution',
          message: issue,
          severity: 'error',
        });
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validates the CEFR level distribution of SpeakingPrompts.
 * Target: exactly 24 lessons (4 per CEFR band A1, A2, B1, B2, C1, C2).
 */
export function validateSpeakingDistribution(
  prompts: readonly SpeakingPrompt[]
): DistributionValidationResult {
  const counts: Record<CEFRLevel, number> = {
    A1: 0,
    A2: 0,
    B1: 0,
    B2: 0,
    C1: 0,
    C2: 0,
  };

  for (const p of prompts) {
    const canonicalLevel = resolveCanonicalCefrLevel(p.level);
    if (canonicalLevel && canonicalLevel in counts) {
      counts[canonicalLevel]++;
    }
  }

  const expectedTotal = 24;
  const expectedPerBand = 4;
  const missingPerBand: Partial<Record<CEFRLevel, number>> = {};
  const issues: string[] = [];

  for (const level of VALID_CEFR_LEVELS) {
    const diff = expectedPerBand - counts[level];
    if (diff > 0) {
      missingPerBand[level] = diff;
      issues.push(`Level ${level}: hiện có ${counts[level]}/${expectedPerBand} bài (thiếu ${diff} bài).`);
    } else if (diff < 0) {
      issues.push(`Level ${level}: thừa bài (${counts[level]}/${expectedPerBand}).`);
    }
  }

  if (prompts.length !== expectedTotal) {
    issues.push(`Tổng số bài nói hiện tại là ${prompts.length}, mục tiêu chuẩn là ${expectedTotal} bài.`);
  }

  const valid = prompts.length === expectedTotal && Object.values(counts).every((c) => c === expectedPerBand);

  return {
    valid,
    total: prompts.length,
    expectedTotal,
    counts,
    expectedPerBand,
    missingPerBand,
    issues,
  };
}

/**
 * Assert that a speaking dataset is valid. Throws error if any validation error is encountered.
 */
export function assertSpeakingDatasetValid(
  prompts: readonly SpeakingPrompt[],
  options?: ValidateSpeakingOptions
): void {
  const result = validateSpeakingDataset(prompts, options);
  if (!result.valid) {
    const errorMessages = result.errors.map((e) => `[${e.promptId}][${e.field}] ${e.message}`).join('\n');
    throw new Error(`Speaking dataset validation failed with ${result.errors.length} error(s):\n${errorMessages}`);
  }
}
