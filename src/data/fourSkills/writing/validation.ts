import { WritingPrompt, WritingTaskType, WritingCategory } from '../types';
import { CEFRLevel } from '../../../types';

export const VALID_CEFR_LEVELS: readonly CEFRLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const;

export const VALID_WRITING_TASK_TYPES: readonly WritingTaskType[] = [
  'Short Message',
  'Personal Note',
  'Informal Email',
  'Professional Email',
  'Technical Report',
  'Opinion Essay',
  'Argumentative Essay',
  'Analytical Report',
  'Discursive Essay',
  'Executive Summary',
] as const;

export const VALID_WRITING_CATEGORIES: readonly WritingCategory[] = [
  'Daily Life',
  'Social & Travel',
  'Tech / Workplace',
  'Career Development',
  'Academic / IELTS',
  'Culture & Society',
  'Science & Environment',
] as const;

export interface WritingWordCountTarget {
  minWords: number;
  maxWords: number;
  label: string;
}

export const WRITING_WORD_COUNT_TARGETS: Record<CEFRLevel, WritingWordCountTarget> = {
  A1: { minWords: 40, maxWords: 70, label: '40–70 words' },
  A2: { minWords: 70, maxWords: 120, label: '70–120 words' },
  B1: { minWords: 120, maxWords: 180, label: '120–180 words' },
  B2: { minWords: 180, maxWords: 260, label: '180–260 words' },
  C1: { minWords: 250, maxWords: 350, label: '250–350 words' },
  C2: { minWords: 350, maxWords: 500, label: '350–500 words' },
};

export interface ValidationIssue {
  promptId: string;
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

export interface ValidateWritingOptions {
  /**
   * If true, also checks distribution across A1-C2 (24 lessons, 4 per band)
   */
  requireFullDistribution?: boolean;
  /**
   * If true, allows legacy compound levels like 'B1-B2', 'B2-C1'
   */
  allowLegacyLevels?: boolean;
}

/**
 * Counts words in a string accurately.
 */
export function countWords(text?: string): number {
  if (!text) return 0;
  return text.trim().split(/\s+/).filter(Boolean).length;
}

/**
 * Normalizes CEFR level, handling legacy compound levels gracefully:
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


/**
 * Validates a single WritingPrompt object.
 */
export function validateWritingPrompt(
  prompt: WritingPrompt,
  options: ValidateWritingOptions = {}
): ValidationResult {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];

  const addError = (field: string, message: string) => {
    errors.push({ promptId: prompt?.id || 'unknown', field, message, severity: 'error' });
  };

  const addWarning = (field: string, message: string) => {
    warnings.push({ promptId: prompt?.id || 'unknown', field, message, severity: 'warning' });
  };

  if (!prompt) {
    return {
      valid: false,
      errors: [{ promptId: 'nil', field: 'prompt', message: 'Prompt object is null or undefined', severity: 'error' }],
      warnings: [],
    };
  }

  // 1. ID checks
  if (!prompt.id || typeof prompt.id !== 'string' || prompt.id.trim() === '') {
    addError('id', 'Prompt ID must be a non-empty string');
  } else if (!/^wp_[a-z0-9_]+$/i.test(prompt.id)) {
    addWarning('id', `Prompt ID "${prompt.id}" does not follow recommended convention "wp_*"`);
  }

  // 2. Title checks
  if (!prompt.title || typeof prompt.title !== 'string' || prompt.title.trim() === '') {
    addError('title', 'Prompt title is required');
  } else if (prompt.title.length < 5) {
    addError('title', `Title "${prompt.title}" is too short (min 5 characters)`);
  } else if (/TODO|placeholder|temp|draft/i.test(prompt.title)) {
    addError('title', `Title contains placeholder or draft keyword: "${prompt.title}"`);
  }

  // 3. Level checks
  const isStandardBand = VALID_CEFR_LEVELS.includes(prompt.level as CEFRLevel);
  const isLegacyBand = ['B1-B2', 'B2-C1'].includes(prompt.level);

  if (!isStandardBand) {
    if (isLegacyBand) {
      if (!options.allowLegacyLevels) {
        addWarning(
          'level',
          `Prompt uses legacy compound level "${prompt.level}". Recommend mapping to discrete CEFR band (A1–C2).`
        );
      }
    } else {
      addError('level', `Invalid level "${prompt.level}". Must be one of: ${VALID_CEFR_LEVELS.join(', ')}`);
    }
  }

  // 4. Type & Category checks
  if (!prompt.type || typeof prompt.type !== 'string' || prompt.type.trim() === '') {
    addError('type', 'Prompt task type is required');
  } else if (!VALID_WRITING_TASK_TYPES.includes(prompt.type as WritingTaskType)) {
    addWarning(
      'type',
      `Task type "${prompt.type}" is not in standard list (${VALID_WRITING_TASK_TYPES.join(', ')})`
    );
  }

  if (!prompt.category || typeof prompt.category !== 'string' || prompt.category.trim() === '') {
    addError('category', 'Prompt category is required');
  } else if (!VALID_WRITING_CATEGORIES.includes(prompt.category as WritingCategory)) {
    addWarning(
      'category',
      `Category "${prompt.category}" is not in standard list (${VALID_WRITING_CATEGORIES.join(', ')})`
    );
  }

  // 5. Prompt text checks
  if (!prompt.prompt || typeof prompt.prompt !== 'string' || prompt.prompt.trim() === '') {
    addError('prompt', 'Prompt description text is required');
  } else if (prompt.prompt.trim().length < 20) {
    addError('prompt', 'Prompt text is too brief (min 20 characters) to provide adequate context');
  } else if (/TODO|placeholder|sample prompt/i.test(prompt.prompt)) {
    addError('prompt', 'Prompt text contains placeholder or incomplete marker');
  }

  // 6. Word count targets checks
  if (typeof prompt.minWords !== 'number' || prompt.minWords <= 0) {
    addError('minWords', `minWords must be a positive number, received ${prompt.minWords}`);
  } else if (isStandardBand) {
    const target = WRITING_WORD_COUNT_TARGETS[prompt.level as CEFRLevel];
    if (target && prompt.minWords < Math.floor(target.minWords * 0.7)) {
      addWarning(
        'minWords',
        `minWords (${prompt.minWords}) is noticeably below curriculum benchmark (${target.minWords} for ${prompt.level})`
      );
    }
  }

  // 7. Guidelines checks
  if (!Array.isArray(prompt.guidelines) || prompt.guidelines.length < 3) {
    addError('guidelines', `Guidelines must have at least 3 points, found ${prompt.guidelines?.length || 0}`);
  } else {
    prompt.guidelines.forEach((g, idx) => {
      if (!g || typeof g !== 'string' || g.trim().length < 5) {
        addError(`guidelines[${idx}]`, 'Guideline point must be at least 5 characters');
      } else if (/TODO|placeholder/i.test(g)) {
        addError(`guidelines[${idx}]`, `Guideline point contains placeholder: "${g}"`);
      }
    });
  }

  // 8. Recommended Vocab checks
  if (!Array.isArray(prompt.recommendedVocab) || prompt.recommendedVocab.length < 3) {
    addError(
      'recommendedVocab',
      `recommendedVocab must contain at least 3 items, found ${prompt.recommendedVocab?.length || 0}`
    );
  } else {
    prompt.recommendedVocab.forEach((item, idx) => {
      if (!item || typeof item !== 'object') {
        addError(`recommendedVocab[${idx}]`, 'Vocab item must be an object with word and meaning');
      } else {
        if (!item.word || typeof item.word !== 'string' || item.word.trim() === '') {
          addError(`recommendedVocab[${idx}].word`, 'Vocab word cannot be empty');
        }
        if (!item.meaning || typeof item.meaning !== 'string' || item.meaning.trim() === '') {
          addError(`recommendedVocab[${idx}].meaning`, 'Vocab meaning cannot be empty');
        }
      }
    });
  }

  // 9. Model answer checks
  if (!prompt.modelAnswer || typeof prompt.modelAnswer !== 'string' || prompt.modelAnswer.trim() === '') {
    addError('modelAnswer', 'Model answer text is required');
  } else {
    const modelWords = countWords(prompt.modelAnswer);
    if (modelWords < prompt.minWords) {
      addWarning(
        'modelAnswer',
        `Model answer length (${modelWords} words) is less than minWords (${prompt.minWords})`
      );
    }
    if (/TODO|placeholder|lorem ipsum/i.test(prompt.modelAnswer)) {
      addError('modelAnswer', 'Model answer contains placeholder or dummy text');
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validates distribution across CEFR levels.
 */
export function validateWritingDistribution(
  prompts: WritingPrompt[],
  expectedPerBand: number = 4
): DistributionValidationResult {
  const counts: Record<CEFRLevel, number> = {
    A1: 0,
    A2: 0,
    B1: 0,
    B2: 0,
    C1: 0,
    C2: 0,
  };

  const issues: string[] = [];

  for (const p of prompts) {
    if (VALID_CEFR_LEVELS.includes(p.level as CEFRLevel)) {
      counts[p.level as CEFRLevel]++;
    } else {
      issues.push(`Prompt "${p.id}" has non-standard level "${p.level}"`);
    }
  }

  const expectedTotal = expectedPerBand * VALID_CEFR_LEVELS.length;
  const missingPerBand: Partial<Record<CEFRLevel, number>> = {};

  for (const band of VALID_CEFR_LEVELS) {
    const diff = expectedPerBand - counts[band];
    if (diff > 0) {
      missingPerBand[band] = diff;
      issues.push(`Band ${band} has ${counts[band]}/${expectedPerBand} lessons (missing ${diff})`);
    }
  }

  const valid = Object.keys(missingPerBand).length === 0 && prompts.length === expectedTotal;

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
 * Validates an entire WritingPrompt dataset.
 */
export function validateWritingDataset(
  prompts: WritingPrompt[],
  options: ValidateWritingOptions = {}
): ValidationResult {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];
  const seenIds = new Set<string>();

  if (!Array.isArray(prompts) || prompts.length === 0) {
    return {
      valid: false,
      errors: [{ promptId: 'dataset', field: 'prompts', message: 'Dataset is empty or not an array', severity: 'error' }],
      warnings: [],
    };
  }

  // Validate each prompt individually and check for duplicate IDs
  prompts.forEach((p, idx) => {
    if (!p) {
      errors.push({
        promptId: `index_${idx}`,
        field: 'prompt',
        message: `Prompt at index ${idx} is null/undefined`,
        severity: 'error',
      });
      return;
    }

    if (seenIds.has(p.id)) {
      errors.push({
        promptId: p.id,
        field: 'id',
        message: `Duplicate prompt ID "${p.id}" found in dataset`,
        severity: 'error',
      });
    } else if (p.id) {
      seenIds.add(p.id);
    }

    const res = validateWritingPrompt(p, options);
    errors.push(...res.errors);
    warnings.push(...res.warnings);
  });

  // Optional full distribution check
  if (options.requireFullDistribution) {
    const dist = validateWritingDistribution(prompts, 4);
    if (!dist.valid) {
      dist.issues.forEach((msg) => {
        errors.push({
          promptId: 'distribution',
          field: 'cefrDistribution',
          message: msg,
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
