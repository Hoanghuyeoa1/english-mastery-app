// src/services/__tests__/writingCheckpointService.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  evaluateWritingSectionResult,
  submitWritingSection,
  isWritingAttemptSubmitted,
  getWritingAttemptResult,
  resetWritingAssessments,
  processWritingMistakes,
  countWords,
} from '../writingCheckpointService';
import type { WritingPrompt } from '../../types/fourSkills';
import type { EssayGradingResult, VocabWord } from '../../types';
import {
  createInitialCheckpointState,
  startCheckpointSession,
  saveSectionDraft,
  advanceToNextSection,
  checkpointStateToResumableActivity,
  restoreCheckpointStateFromActivity,
  resetFinalizedAttempts,
} from '../checkpointSessionLifecycle';

describe('Writing Checkpoint Service (Phase 8)', () => {
  const mockPrompt: WritingPrompt = {
    id: 'wp_test_1',
    title: 'Introducing Yourself and Your Daily Life',
    type: 'Personal Note',
    category: 'Daily Life',
    level: 'A1',
    minWords: 30,
    maxWords: 60,
    prompt: 'Write a short paragraph about yourself, your age, where you live, and what you do every day.',
    guidelines: ['State your name and hometown', 'Mention your occupation', 'Describe one daily activity'],
    recommendedVocab: [{ word: 'student', meaning: 'học sinh / sinh viên' }],
    modelAnswer: 'My name is Nam. I live in Hanoi. I am a student. Every day I wake up early and study English.',
  };

  const sampleValidEssay =
    'My name is Nam. I live in Hanoi, Vietnam. I am twenty years old and I am a university student. Every day I wake up at seven and study English with my friends. It is very fun.'; // 37 words

  const mockTrustedGradingResult: EssayGradingResult = {
    overallScore: 82,
    overallCEFR: 'B2',
    wordCount: 37,
    criteria: {
      taskAchievement: { score: 85, cefrLevel: 'B2', feedback: 'Tốt' },
      coherenceCohesion: { score: 80, cefrLevel: 'B2', feedback: 'Mạch lạc' },
      lexicalResource: { score: 80, cefrLevel: 'B2', feedback: 'Từ vựng ổn' },
      grammaticalAccuracy: { score: 83, cefrLevel: 'B2', feedback: 'Ngữ pháp tốt' },
    },
    strengths: ['Bố cục tốt'],
    improvements: ['Nâng cao từ vựng'],
    diffSegments: [
      { type: 'unchanged', originalText: 'My name is Nam. ' },
      {
        type: 'correction',
        originalText: 'I lives in Hanoi',
        revisedText: 'I live in Hanoi',
        explanation: 'Sửa lỗi chia động từ số ít với chủ ngữ I',
      },
    ],
    fullRevisedEssay: 'My name is Nam. I live in Hanoi...',
    isFallback: false,
  };

  beforeEach(() => {
    resetWritingAssessments();
    resetFinalizedAttempts();
    vi.restoreAllMocks();
  });

  // =========================================================================
  // 1. WORD COUNT UTILITY
  // =========================================================================
  describe('Word Count Helper', () => {
    it('counts words accurately across multiple spaces and newlines', () => {
      expect(countWords('')).toBe(0);
      expect(countWords('   ')).toBe(0);
      expect(countWords('Hello world')).toBe(2);
      expect(countWords('  Hello   world \n test \t word  ')).toBe(4);
    });
  });

  // =========================================================================
  // 2. TRUSTED GRADING (HAPPY PATH)
  // =========================================================================
  describe('Trusted Grading Evaluation', () => {
    it('evaluates valid essay with genuine AI grading result deterministically', () => {
      const result = evaluateWritingSectionResult({
        attemptId: 'cefr:A1:write-trusted-1',
        level: 'A1',
        prompt: mockPrompt,
        essay: sampleValidEssay,
        gradingResult: mockTrustedGradingResult,
      });

      expect(result.status).toBe('evaluated');
      expect(result.hasSufficientEvidence).toBe(true);
      expect(result.isTrusted).toBe(true);
      expect(result.isFallback).toBe(false);
      expect(result.score).toBe(82); // (85 + 80 + 80 + 83) / 4 = 82
      expect(result.passedFloor).toBe(true);
      expect(result.wordCount).toBe(37);
      expect(result.minWordsRequired).toBe(30);
    });

    it('marks passedFloor false when overall score is below CEFR floor', () => {
      const lowScoreGrading: EssayGradingResult = {
        ...mockTrustedGradingResult,
        criteria: {
          taskAchievement: { score: 40, cefrLevel: 'A1', feedback: 'Sơ sài' },
          coherenceCohesion: { score: 40, cefrLevel: 'A1', feedback: 'Rời rạc' },
          lexicalResource: { score: 40, cefrLevel: 'A1', feedback: 'Thiếu từ vựng' },
          grammaticalAccuracy: { score: 40, cefrLevel: 'A1', feedback: 'Nhiều lỗi' },
        },
      };

      const result = evaluateWritingSectionResult({
        attemptId: 'cefr:A1:write-floor-fail',
        level: 'A1',
        prompt: mockPrompt,
        essay: sampleValidEssay,
        gradingResult: lowScoreGrading,
      });

      expect(result.status).toBe('evaluated');
      expect(result.score).toBe(40);
      expect(result.passedFloor).toBe(false); // A1 requiredFloor is 55
      expect(result.requiredFloor).toBe(55);
    });
  });

  // =========================================================================
  // 3. ZERO FABRICATED SCORE & TRUST BOUNDARY AUDIT
  // =========================================================================
  describe('Trust Boundary (NO FAKE OR FALLBACK CERTIFICATION SCORES!)', () => {
    it('returns insufficient_evidence and null score when AI response is a mock fallback', () => {
      const fallbackResult: EssayGradingResult = {
        ...mockTrustedGradingResult,
        isFallback: true, // Mock fallback
      };

      const result = evaluateWritingSectionResult({
        attemptId: 'cefr:A1:write-fallback-1',
        level: 'A1',
        prompt: mockPrompt,
        essay: sampleValidEssay,
        gradingResult: fallbackResult,
      });

      expect(result.status).toBe('insufficient_evidence');
      expect(result.score).toBeNull(); // NEVER use fallback score
      expect(result.hasSufficientEvidence).toBe(false);
      expect(result.isFallback).toBe(true);
      expect(result.reason).toBe('ai_fallback_untrusted');
    });

    it('returns insufficient_evidence when essay word count is below minimum required', () => {
      const shortEssay = 'My name is Nam. I am student.'; // 7 words < 30 minWords
      const result = evaluateWritingSectionResult({
        attemptId: 'cefr:A1:write-short-1',
        level: 'A1',
        prompt: mockPrompt,
        essay: shortEssay,
        gradingResult: mockTrustedGradingResult,
      });

      expect(result.status).toBe('insufficient_evidence');
      expect(result.score).toBeNull();
      expect(result.reason).toBe('word_count_insufficient');
      expect(result.hasSufficientEvidence).toBe(false);
    });

    it('returns insufficient_evidence when essay is completely empty', () => {
      const result = evaluateWritingSectionResult({
        attemptId: 'cefr:A1:write-empty-1',
        level: 'A1',
        prompt: mockPrompt,
        essay: '   ',
        gradingResult: mockTrustedGradingResult,
      });

      expect(result.status).toBe('insufficient_evidence');
      expect(result.score).toBeNull();
      expect(result.reason).toBe('empty_essay');
    });

    it('returns insufficient_evidence when prompt is missing', () => {
      const result = evaluateWritingSectionResult({
        attemptId: 'cefr:A1:write-null-p',
        level: 'A1',
        prompt: null,
        essay: sampleValidEssay,
        gradingResult: mockTrustedGradingResult,
      });

      expect(result.status).toBe('insufficient_evidence');
      expect(result.score).toBeNull();
      expect(result.reason).toBe('missing_prompt');
    });

    it('returns insufficient_evidence and null score on malformed criteria with NaN', () => {
      const malformedResult: EssayGradingResult = {
        ...mockTrustedGradingResult,
        criteria: {
          taskAchievement: { score: NaN as any, cefrLevel: 'B2', feedback: '' },
          coherenceCohesion: { score: 80, cefrLevel: 'B2', feedback: '' },
          lexicalResource: { score: 80, cefrLevel: 'B2', feedback: '' },
          grammaticalAccuracy: { score: 80, cefrLevel: 'B2', feedback: '' },
        },
      };

      const result = evaluateWritingSectionResult({
        attemptId: 'cefr:A1:write-malformed-1',
        level: 'A1',
        prompt: mockPrompt,
        essay: sampleValidEssay,
        gradingResult: malformedResult,
      });

      expect(result.status).toBe('insufficient_evidence');
      expect(result.score).toBeNull();
      expect(result.reason).toBe('malformed_result');
    });
  });

  // =========================================================================
  // 4. OFFLINE DRAFT RETENTION & STATUS
  // =========================================================================
  describe('Offline Handling & Retention', () => {
    it('sets status to pending with reason offline and retains score as null without throwing', () => {
      const result = evaluateWritingSectionResult({
        attemptId: 'cefr:A1:write-offline-1',
        level: 'A1',
        prompt: mockPrompt,
        essay: sampleValidEssay,
        isOffline: true,
      });

      expect(result.status).toBe('pending');
      expect(result.score).toBeNull();
      expect(result.reason).toBe('offline');
      expect(result.wordCount).toBe(37);
    });

    it('handles offline via submitWritingSection directly', async () => {
      const result = await submitWritingSection({
        attemptId: 'cefr:A1:write-offline-submit',
        level: 'A1',
        prompt: mockPrompt,
        essay: sampleValidEssay,
        isOffline: true,
      });

      expect(result.status).toBe('pending');
      expect(result.score).toBeNull();
      expect(result.reason).toBe('offline');
      expect(isWritingAttemptSubmitted('cefr:A1:write-offline-submit')).toBe(false);
    });
  });

  // =========================================================================
  // 5. TIMEOUT HANDLING
  // =========================================================================
  describe('Timeout Protection', () => {
    it('catches slow AI response exceeding timeoutMs and sets status pending with reason timeout', async () => {
      const slowGradeFn = vi.fn(
        () =>
          new Promise<EssayGradingResult>((resolve) => {
            setTimeout(() => resolve(mockTrustedGradingResult), 500);
          })
      );

      const result = await submitWritingSection({
        attemptId: 'cefr:A1:write-timeout-1',
        level: 'A1',
        prompt: mockPrompt,
        essay: sampleValidEssay,
        timeoutMs: 50, // 50ms timeout < 500ms response
        gradeFn: slowGradeFn,
      });

      expect(result.status).toBe('pending');
      expect(result.score).toBeNull();
      expect(result.reason).toBe('timeout');
      expect(isWritingAttemptSubmitted('cefr:A1:write-timeout-1')).toBe(false);
    });
  });

  // =========================================================================
  // 6. ATTEMPT INTEGRITY: DOUBLE SUBMIT & DELAYED RESPONSE
  // =========================================================================
  describe('Attempt Integrity & Stale Response Protection', () => {
    it('locks in-flight concurrent requests to avoid duplicate AI calls', async () => {
      let callCount = 0;
      const mockGradeFn = vi.fn(async () => {
        callCount++;
        await new Promise((r) => setTimeout(r, 40));
        return mockTrustedGradingResult;
      });

      const attemptId = 'cefr:A1:concurrent-submit';

      // Submit concurrently
      const promise1 = submitWritingSection({
        attemptId,
        level: 'A1',
        prompt: mockPrompt,
        essay: sampleValidEssay,
        gradeFn: mockGradeFn,
      });
      const promise2 = submitWritingSection({
        attemptId,
        level: 'A1',
        prompt: mockPrompt,
        essay: sampleValidEssay,
        gradeFn: mockGradeFn,
      });

      const [res1, res2] = await Promise.all([promise1, promise2]);

      expect(callCount).toBe(1); // Only 1 AI call launched!
      expect(res1.score).toBe(82);
      expect(res2.score).toBe(82);
      expect(isWritingAttemptSubmitted(attemptId)).toBe(true);
    });

    it('enforces first valid submission wins on duplicate submit calls', async () => {
      const attemptId = 'cefr:A1:idempotent-first-wins';

      const res1 = await submitWritingSection({
        attemptId,
        level: 'A1',
        prompt: mockPrompt,
        essay: sampleValidEssay,
        gradeFn: async () => mockTrustedGradingResult,
      });

      expect(res1.status).toBe('evaluated');
      expect(res1.score).toBe(82);

      // Subsequent submit attempt with modified essay or worse result
      const res2 = await submitWritingSection({
        attemptId,
        level: 'A1',
        prompt: mockPrompt,
        essay: 'Completely new text',
        gradeFn: async () => ({
          ...mockTrustedGradingResult,
          overallScore: 30,
        }),
      });

      // INVARIANT: First valid submission prevails!
      expect(res2.score).toBe(82);
      expect(res2.evaluatedAt).toBe(res1.evaluatedAt);
    });

    it('discards delayed/stale responses when request token was superseded by a retry', async () => {
      const attemptId = 'cefr:A1:stale-token-test';

      let resolveSlowCall: (val: any) => void;
      const slowPromise = new Promise<EssayGradingResult>((res) => {
        resolveSlowCall = res;
      });

      // 1. Initial slow call (Token 1)
      const firstCall = submitWritingSection({
        attemptId,
        level: 'A1',
        prompt: mockPrompt,
        essay: sampleValidEssay,
        gradeFn: () => slowPromise,
        timeoutMs: 5000,
      });

      // 2. Immediate fast retry (Token 2 supersedes Token 1)
      resetWritingAssessments(); // resets in-flight lock to simulate user triggering new action
      const retryResult = await submitWritingSection({
        attemptId,
        level: 'A1',
        prompt: mockPrompt,
        essay: sampleValidEssay,
        gradeFn: async () => mockTrustedGradingResult,
      });

      expect(retryResult.score).toBe(82);
      expect(retryResult.status).toBe('evaluated');

      // 3. Slow call from Token 1 finally resolves
      resolveSlowCall!(mockTrustedGradingResult);
      const staleResult = await firstCall;

      // Stale call must NOT overwrite the attempt
      expect(getWritingAttemptResult(attemptId)?.score).toBe(82);
    });
  });

  // =========================================================================
  // 7. ANSWER PERSISTENCE & RESUME SAFETY
  // =========================================================================
  describe('Answer Persistence & Resume Safety', () => {
    it('persists written text in session state draft updates', () => {
      let state = createInitialCheckpointState('A1');
      state = startCheckpointSession(state);

      state = advanceToNextSection(state, 85); // to reading
      state = advanceToNextSection(state, 90); // to speaking
      state = advanceToNextSection(state, 80); // to writing
      expect(state.stage).toBe('writing');

      // Save draft
      state = saveSectionDraft(state, {
        writing: sampleValidEssay,
      });
      expect(state.answers.writing).toBe(sampleValidEssay);
    });

    it('converts to ResumableActivity and restores writingDraft faithfully', () => {
      let state = createInitialCheckpointState('B1');
      state = startCheckpointSession(state);
      state = advanceToNextSection(state, 80);
      state = advanceToNextSection(state, 80);
      state = advanceToNextSection(state, 80);

      state = saveSectionDraft(state, {
        writing: sampleValidEssay,
      });

      const activity = checkpointStateToResumableActivity(state, 'B1 Checkpoint');
      expect(activity.checkpoint.writingDraft).toBe(sampleValidEssay);
      expect(activity.checkpoint.currentSection).toBe('writing');

      const restored = restoreCheckpointStateFromActivity(activity);
      expect(restored).not.toBeNull();
      expect(restored?.answers.writing).toBe(sampleValidEssay);
      expect(restored?.stage).toBe('writing');
    });
  });

  // =========================================================================
  // 8. MISTAKE BANK INTEGRATION & DEDUPLICATION
  // =========================================================================
  describe('Mistake Bank Pipeline & Deduplication', () => {
    it('captures correction diffSegments only for trusted evaluations and deduplicates on replay', () => {
      const mockRecordMistake = vi.fn();
      const attemptId = 'cefr:A1:writing-mistake-dedupe';

      const evalResult = evaluateWritingSectionResult({
        attemptId,
        level: 'A1',
        prompt: mockPrompt,
        essay: sampleValidEssay,
        gradingResult: mockTrustedGradingResult,
      });

      // 1. First mistake recording
      const count1 = processWritingMistakes({
        attemptId,
        promptTitle: mockPrompt.title,
        evaluation: evalResult,
        fullEssay: sampleValidEssay,
        recordMistake: mockRecordMistake,
      });

      expect(count1).toBe(1);
      expect(mockRecordMistake).toHaveBeenCalledTimes(1);
      expect(mockRecordMistake).toHaveBeenCalledWith(
        expect.anything(),
        'writing',
        expect.objectContaining({
          type: 'grammar',
          userAnswer: 'I lives in Hanoi',
        })
      );

      // 2. Second mistake recording (simulating replay / modal remount)
      const count2 = processWritingMistakes({
        attemptId,
        promptTitle: mockPrompt.title,
        evaluation: evalResult,
        fullEssay: sampleValidEssay,
        recordMistake: mockRecordMistake,
      });

      // INVARIANT: Deduplicated!
      expect(count2).toBe(0);
      expect(mockRecordMistake).toHaveBeenCalledTimes(1);
    });

    it('NEVER records mistakes when evaluation is a mock fallback', () => {
      const mockRecordMistake = vi.fn();
      const fallbackResult = evaluateWritingSectionResult({
        attemptId: 'cefr:A1:writing-fallback-no-mistake',
        level: 'A1',
        prompt: mockPrompt,
        essay: sampleValidEssay,
        gradingResult: {
          ...mockTrustedGradingResult,
          isFallback: true,
        },
      });

      const count = processWritingMistakes({
        attemptId: 'cefr:A1:writing-fallback-no-mistake',
        promptTitle: mockPrompt.title,
        evaluation: fallbackResult,
        fullEssay: sampleValidEssay,
        recordMistake: mockRecordMistake,
      });

      expect(count).toBe(0);
      expect(mockRecordMistake).not.toHaveBeenCalled();
    });
  });
});
