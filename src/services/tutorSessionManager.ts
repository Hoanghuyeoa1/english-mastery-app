// src/services/tutorSessionManager.ts
/**
 * In-Memory Session State Manager for Adaptive AI Tutor Conversations
 * 
 * Strict Invariants:
 * 1. Scope: Transient in-memory session tracking only. Does not persist to localStorage or DB in Phase 2.
 * 2. Untrusted Model Telemetry: Gemini outputs are validated against known session candidate targets.
 * 3. Deterministic Mastery: Code-decided local criteria (>= 2 successful practices, no target-specific mistake).
 *    Model's masteryDemonstrated flag is never sufficient alone.
 * 4. Target-Specific Mistake Matching: Mistakes only affect their own target, never unrelated practiced targets.
 * 5. Bounded Candidate Extraction: Targets extracted strictly from structured fields, never arbitrary text.
 * 6. Deterministic Rotation: Rotates across priorities using practice count, severity, rank, and alphabetical tie-break.
 * 7. Non-Absolute Mastered Wording: Mastered targets are not drilled, but may appear naturally in conversation.
 */

import type {
  TutorLearningContext,
  TutorSessionMemory,
  TutorLearningTelemetry,
  ChatFeedback,
  SessionMistakeRecord,
  SessionCorrectionRecord,
  MistakeType,
} from '../types';
import { sanitizeLearnerText } from './tutorLearningContext';

export const MAX_SESSION_CANDIDATE_TARGETS = 20;

export interface CandidateTargetDetail {
  key: string; // normalized lower
  display: string;
  rank: number; // lower = higher priority
  severityScore: number; // 3 = critical, 2 = high, 1 = medium, 0 = other
}

/**
 * Normalizes technical/internal canonical IDs into clean human-readable learner display text.
 * Rejects opaque numeric IDs (e.g. vocab_123, word_456).
 */
export function formatHumanReadableTarget(raw: string): string {
  if (!raw) return '';
  let clean = raw.trim();

  // Strip common technical prefixes
  const prefixRegex = /^(?:grammar|colloc|collocation|vocab|vocabulary|pron|pronunciation|cw|mb|word|item)_/i;
  if (prefixRegex.test(clean)) {
    clean = clean.replace(prefixRegex, '');
  }

  // If after stripping it's purely digits or too short (e.g. vocab_123, word_456), it's an opaque numeric ID
  if (/^\d+$/.test(clean) || clean.length < 2) {
    return '';
  }

  // Replace underscores with spaces
  clean = clean.replace(/_/g, ' ').replace(/\s+/g, ' ').trim();

  return clean;
}

/**
 * Extracts candidate targets with rich priority and severity metadata from structured fields.
 * Never tokenizes free-text contexts, explanations, or long sentences.
 */
export function extractCandidateTargetDetails(
  context?: TutorLearningContext | null
): CandidateTargetDetail[] {
  if (!context) return [];

  const candidateMap = new Map<string, CandidateTargetDetail>();

  const registerTarget = (
    raw: string | undefined,
    rank: number = 99,
    severityScore: number = 0
  ) => {
    if (!raw) return;
    const clean = raw.trim();
    // Rejects empty, single-character, long paragraphs, or sentences
    if (clean.length < 2 || clean.length > 50 || clean.includes('\n')) return;
    // If it looks like a full descriptive sentence (more than 5 words), do not extract as target
    if (clean.split(/\s+/).length > 5) return;

    // Convert internal canonical IDs to clean learner-facing display text
    const humanDisplay = formatHumanReadableTarget(clean);
    if (!humanDisplay || humanDisplay.length < 2 || humanDisplay.length > 50) return;
    if (humanDisplay.split(/\s+/).length > 5) return;

    const lower = humanDisplay.toLowerCase();
    const existing = candidateMap.get(lower);
    if (!existing) {
      if (candidateMap.size < MAX_SESSION_CANDIDATE_TARGETS) {
        candidateMap.set(lower, {
          key: lower,
          display: humanDisplay,
          rank,
          severityScore,
        });
      }
    } else {
      // Keep best rank and severity
      if (rank < existing.rank) existing.rank = rank;
      if (severityScore > existing.severityScore) existing.severityScore = severityScore;
    }
  };

  // 1. Top Learning Priorities' explicit target items (Highest value)
  if (context.learningPriorities) {
    for (const priority of context.learningPriorities) {
      const sevScore =
        priority.severity === 'critical' ? 3 : priority.severity === 'high' ? 2 : 1;

      if (priority.targetItems && priority.targetItems.length > 0) {
        for (const item of priority.targetItems) {
          registerTarget(item, priority.rank, sevScore);
        }
      } else if (priority.title && priority.title.length <= 40 && !priority.title.includes(':')) {
        registerTarget(priority.title, priority.rank, sevScore);
      }
    }
  }

  // 2. Collocations to reinforce (High value for idiomatic practice)
  if (context.weakCollocations) {
    for (const col of context.weakCollocations) {
      registerTarget(col.phrase, 10, 2);
    }
  }

  // 3. Leech words & weak vocabulary
  if (context.leechWords) {
    for (const leech of context.leechWords) {
      registerTarget(leech.word, 15, 2);
    }
  }
  if (context.weakVocabulary) {
    for (const vocab of context.weakVocabulary) {
      registerTarget(vocab.word, 20, 1);
    }
  }

  // 4. Grammar patterns (short pattern topics only)
  if (context.grammarWeaknesses) {
    for (const grammar of context.grammarWeaknesses) {
      registerTarget(grammar.patternOrTopic, 25, 1);
    }
  }

  // 5. Recent Speaking issues
  if (context.recentSpeakingIssues) {
    for (const spk of context.recentSpeakingIssues) {
      registerTarget(spk.targetWord, 30, 1);
    }
  }

  return Array.from(candidateMap.values());
}

/**
 * Extracts candidate target display names in deterministic priority order.
 */
export function extractCandidateTargets(context?: TutorLearningContext | null): string[] {
  return extractCandidateTargetDetails(context).map((d) => d.display);
}

/**
 * Selects the next active target deterministically:
 * 1. Filter out mastered targets
 * 2. Sort by least practiced count ASC
 * 3. Tie-break by severityScore DESC (critical > high > medium)
 * 4. Tie-break by rank ASC (rank 1 > rank 2)
 * 5. Tie-break by alphabetical key ASC
 */
export function selectNextActiveTarget(
  context?: TutorLearningContext | null,
  memory?: TutorSessionMemory | null
): string | undefined {
  const details = extractCandidateTargetDetails(context);
  if (details.length === 0) return undefined;

  const masteredSet = new Set(
    (memory?.masteredTargets || []).map((t) => t.toLowerCase().trim())
  );

  const eligible = details.filter((d) => !masteredSet.has(d.key));
  if (eligible.length === 0) return undefined;

  const practiceCounts = memory?.targetPracticeCounts || {};

  const sorted = [...eligible].sort((a, b) => {
    // 1. Least practiced first
    const countA = practiceCounts[a.key] || 0;
    const countB = practiceCounts[b.key] || 0;
    if (countA !== countB) {
      return countA - countB;
    }

    // 2. Higher severity first
    if (b.severityScore !== a.severityScore) {
      return b.severityScore - a.severityScore;
    }

    // 3. Lower rank number first (e.g. priority 1 before priority 2)
    if (a.rank !== b.rank) {
      return a.rank - b.rank;
    }

    // 4. Deterministic alphabetical tie-break
    return a.key.localeCompare(b.key);
  });

  return sorted[0].display;
}

/**
 * Creates the initial session memory state for an AI Tutor roleplay session.
 */
export function createInitialSessionMemory(
  context?: TutorLearningContext | null
): TutorSessionMemory {
  const currentTarget = selectNextActiveTarget(context, null);
  return {
    currentTarget,
    targetPracticeCounts: {},
    masteredTargets: [],
    recentMistakes: [],
    lastCorrection: undefined,
    turnCount: 0,
  };
}

/**
 * Validates whether a detected mistake corresponds to a specific target.
 */
export function isMistakeOnTarget(mistakeTargetRaw: string | undefined, candidateKey: string): boolean {
  if (!mistakeTargetRaw) return false;
  const mKey = mistakeTargetRaw.toLowerCase().trim();
  const cKey = candidateKey.toLowerCase().trim();

  if (mKey === cKey) return true;
  // Substring or word match (e.g. "although" matches "contrast: although vs despite")
  if (cKey.includes(mKey) || mKey.includes(cKey)) return true;

  const mWords = mKey.split(/[\s,:/_-]+/).filter(Boolean);
  const cWords = cKey.split(/[\s,:/_-]+/).filter(Boolean);
  return mWords.some((w) => cWords.includes(w));
}

/**
 * Updates the session memory after an AI Tutor turn has completed.
 * Pure function: returns a new TutorSessionMemory object.
 */
export function recordSessionTurn(
  currentMemory: TutorSessionMemory,
  options: {
    userMessage: string;
    telemetry?: TutorLearningTelemetry;
    feedback?: ChatFeedback;
    context?: TutorLearningContext | null;
  }
): TutorSessionMemory {
  const { telemetry, feedback, context } = options;
  const updatedCounts = { ...currentMemory.targetPracticeCounts };
  const masteredList = [...currentMemory.masteredTargets];
  const recentMistakes: SessionMistakeRecord[] = [...currentMemory.recentMistakes];
  let lastCorrection: SessionCorrectionRecord | undefined = currentMemory.lastCorrection;

  // Authoritative local user message (Requirement 12: do not trust model echo)
  const localUserMessage = options.userMessage.trim();

  // 1. Build known candidate keys set for session target validation (Requirement 2)
  const candidateDetails = extractCandidateTargetDetails(context);
  const knownTargetMap = new Map<string, string>(); // lowerKey -> displayName
  for (const cd of candidateDetails) {
    knownTargetMap.set(cd.key, cd.display);
  }
  if (currentMemory.currentTarget) {
    const curKey = currentMemory.currentTarget.toLowerCase().trim();
    if (!knownTargetMap.has(curKey)) {
      knownTargetMap.set(curKey, currentMemory.currentTarget);
    }
  }

  // 2. Validate telemetry.practicedTargets against known session targets (Requirement 1 & 2)
  // Gemini cannot invent arbitrary learning targets!
  const acceptedPracticedTargets = new Set<string>();
  if (telemetry?.practicedTargets && Array.isArray(telemetry.practicedTargets)) {
    for (const raw of telemetry.practicedTargets) {
      if (typeof raw === 'string') {
        const clean = raw.trim();
        const lower = clean.toLowerCase();
        // Check exact match or word match with known session targets
        if (knownTargetMap.has(lower)) {
          acceptedPracticedTargets.add(knownTargetMap.get(lower)!);
        } else {
          // Check if candidate contains this word
          for (const [candKey, candDisplay] of knownTargetMap.entries()) {
            if (candKey === lower || candKey.includes(lower) || lower.includes(candKey)) {
              acceptedPracticedTargets.add(candDisplay);
              break;
            }
          }
        }
      }
    }
  }

  // Fallback to currentTarget if telemetry did not specify any valid known target
  if (acceptedPracticedTargets.size === 0 && currentMemory.currentTarget) {
    acceptedPracticedTargets.add(currentMemory.currentTarget);
  }

  // 3. Process detected mistakes (Requirement 4 & 12)
  const targetMistakesMap = new Map<string, boolean>(); // targetKey -> hasMistake
  if (telemetry?.detectedMistakes && Array.isArray(telemetry.detectedMistakes)) {
    for (const m of telemetry.detectedMistakes) {
      if (!m || typeof m !== 'object') continue;
      const targetName = typeof m.target === 'string' && m.target.trim()
        ? m.target.trim()
        : currentMemory.currentTarget || 'general';

      const validMistakeType: MistakeType =
        m.type &&
        ['meaning', 'spelling', 'listening', 'pronunciation', 'collocation', 'grammar', 'reading', 'writing', 'other'].includes(
          m.type
        )
          ? m.type
          : 'other';

      // Always bind userAnswer to authoritative local userMessage (Requirement 12)
      recentMistakes.unshift({
        target: sanitizeLearnerText(targetName, 40),
        mistakeType: validMistakeType,
        userAnswer: sanitizeLearnerText(localUserMessage, 150),
        correction: sanitizeLearnerText(m.correction || feedback?.correction || '', 150),
        explanation: sanitizeLearnerText(m.explanation || feedback?.explanation || '', 200),
        timestamp: Date.now(),
      });

      // Mark mistake on matching targets
      for (const practicedTarget of acceptedPracticedTargets) {
        if (isMistakeOnTarget(targetName, practicedTarget)) {
          targetMistakesMap.set(practicedTarget.toLowerCase().trim(), true);
        }
      }
    }
  }

  // Record feedback correction if provided
  if (feedback?.correction && feedback.correction !== localUserMessage) {
    lastCorrection = {
      target: currentMemory.currentTarget,
      original: sanitizeLearnerText(localUserMessage, 150),
      correction: sanitizeLearnerText(feedback.correction, 150),
      explanation: sanitizeLearnerText(feedback.explanation || '', 200),
    };
  }

  // Bounded recent mistakes list (max 5)
  if (recentMistakes.length > 5) {
    recentMistakes.length = 5;
  }

  // 4. Update practice counts and evaluate mastery deterministically (Requirement 3)
  for (const rawTarget of acceptedPracticedTargets) {
    const key = rawTarget.toLowerCase().trim();
    const newCount = (updatedCounts[key] || 0) + 1;
    updatedCounts[key] = newCount;

    // Requirement 4: Mistake matching is target-specific!
    const hadMistakeOnThisTarget = targetMistakesMap.get(key) === true;

    // Requirement 3: Mastery must be CODE-DECIDED, not model-decided!
    // A target reaches same-session temporary mastery if and only if:
    // a) It is a known candidate target in this session
    // b) It has reached >= 2 successful practices (count >= 2)
    // c) No target-specific error occurred on it in this turn
    const isMastered =
      knownTargetMap.has(key) &&
      newCount >= 2 &&
      !hadMistakeOnThisTarget;

    if (isMastered) {
      if (!masteredList.some((m) => m.toLowerCase().trim() === key)) {
        masteredList.push(rawTarget);
      }
    }
  }

  const tempMemory: TutorSessionMemory = {
    currentTarget: currentMemory.currentTarget,
    targetPracticeCounts: updatedCounts,
    masteredTargets: masteredList,
    recentMistakes,
    lastCorrection,
    turnCount: currentMemory.turnCount + 1,
  };

  // 5. Deterministic Adaptive Target Rotation (Requirement 6)
  let nextTarget = currentMemory.currentTarget;
  const isCurrentMastered =
    currentMemory.currentTarget &&
    masteredList.some(
      (m) => m.toLowerCase().trim() === currentMemory.currentTarget?.toLowerCase().trim()
    );

  if (isCurrentMastered || acceptedPracticedTargets.size > 0) {
    const rotated = selectNextActiveTarget(context, tempMemory);
    if (rotated) {
      nextTarget = rotated;
    } else if (isCurrentMastered) {
      nextTarget = undefined; // All eligible candidate targets are mastered
    }
  }

  return {
    ...tempMemory,
    currentTarget: nextTarget,
  };
}

/**
 * Formats transient session memory into a compact, prompt-safe instruction block.
 * Uses refined non-absolute directives (Requirement 7).
 */
export function formatSessionMemoryForPrompt(memory?: TutorSessionMemory | null): string {
  if (!memory || (memory.turnCount === 0 && !memory.currentTarget)) {
    return '';
  }

  const lines: string[] = [];
  lines.push('[SESSION PROGRESS MEMORY]');
  lines.push(`Session Turn: ${memory.turnCount}`);

  if (memory.currentTarget) {
    const count = memory.targetPracticeCounts[memory.currentTarget.toLowerCase().trim()] || 0;
    lines.push(
      `Active Practice Target: "${sanitizeLearnerText(memory.currentTarget, 40)}" (Practiced: ${count} times)`
    );
  }

  if (memory.masteredTargets.length > 0) {
    const masteredStr = memory.masteredTargets
      .slice(0, 5)
      .map((t) => sanitizeLearnerText(t, 30))
      .join(', ');
    lines.push(`Mastered in this session: ${masteredStr}`);
  }

  if (memory.lastCorrection?.correction) {
    lines.push(
      `Recent Correction: "${sanitizeLearnerText(memory.lastCorrection.correction, 60)}"`
    );
  }

  lines.push('Pedagogical Directives:');
  if (memory.currentTarget) {
    lines.push(
      `- Create a natural scenario situation that subtly elicits active target "${sanitizeLearnerText(memory.currentTarget, 40)}".`
    );
    lines.push(
      `- Do NOT ask repetitive or quiz-style direct questions (avoid "translate this" or "make a sentence with X").`
    );
  }
  if (memory.masteredTargets.length > 0) {
    const masteredItemsStr = memory.masteredTargets.slice(0, 5).join(', ');
    lines.push(
      `- Do not deliberately quiz or drill mastered targets again in this session: [${masteredItemsStr}]. They may still appear naturally in conversation.`
    );
    lines.push(
      `- Session mastery overrides long-term learning priority for deliberate practice during the current session only.`
    );
  }

  return lines.join('\n');
}

/**
 * Derives 2-3 top session focus display items for the UI from learning context.
 * Returns empty array if learner has no history or no viable targets.
 */
export function deriveSessionFocusItems(
  context?: TutorLearningContext | null,
  limit: number = 3
): string[] {
  if (!context || !context.hasLearningHistory) return [];
  const targets = extractCandidateTargets(context);
  const seen = new Set<string>();
  const results: string[] = [];
  for (const t of targets) {
    const norm = t.toLowerCase().trim();
    if (norm && !seen.has(norm)) {
      seen.add(norm);
      results.push(t);
      if (results.length >= limit) break;
    }
  }
  return results;
}
