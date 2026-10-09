// src/services/__tests__/speakingCheckpointService.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  gradeSpeakingCheckpointSection,
  submitSpeakingSection,
  isSpeakingAttemptSubmitted,
  getSpeakingAttemptResult,
  resetSpeakingAssessments,
  processSpeakingMistakes,
} from '../speakingCheckpointService';
import type { SpeakingPrompt, SpeakingTurn } from '../../data/fourSkillsData';
import type { VocabWord } from '../../types';
import {
  createInitialCheckpointState,
  startCheckpointSession,
  saveSectionDraft,
  advanceToNextSection,
  checkpointStateToResumableActivity,
  restoreCheckpointStateFromActivity,
  resetFinalizedAttempts,
} from '../checkpointSessionLifecycle';

describe('Speaking Checkpoint Service (Phase 7)', () => {
  const mockPrompt: SpeakingPrompt = {
    id: 'sp_test_1',
    title: 'Meeting a Colleague',
    category: 'Daily Conversation',
    level: 'A1',
    suggestedDuration: '30s',
    scenario: 'Introducing yourself to a new colleague.',
    talkingPoints: ['Name', 'Role'],
    turns: [
      {
        turnIndex: 0,
        partnerPrompt: 'Hello! I am Sarah, nice to meet you!',
        targetSentence: 'Hello Sarah! My name is Minh, nice to meet you too.',
        phonetic: '/həˈləʊ ˈseərə/',
        meaningVi: 'Xin chào Sarah, tôi là Minh.',
        keyKeywords: ['hello Sarah', 'my name is', 'nice to meet you'],
        sampleAudioText: 'Hello Sarah! My name is Minh, nice to meet you too.',
      },
      {
        turnIndex: 1,
        partnerPrompt: 'What do you do here?',
        targetSentence: 'I am a software engineer in the tech department.',
        phonetic: '/aɪ æm ə ˈsɒftweə/',
        meaningVi: 'Tôi là kỹ sư phần mềm.',
        keyKeywords: ['software engineer', 'tech department'],
        sampleAudioText: 'I am a software engineer in the tech department.',
      },
    ],
  };

  const mockVocabList: VocabWord[] = [
    {
      id: 'v_engineer',
      word: 'engineer',
      meaning: 'kỹ sư',
      partOfSpeech: 'noun',
      ipa: '/ˌendʒɪˈnɪər/',
      example: 'He is an engineer.',
      tag: 'Daily',
      srsLevel: 0,
      nextReviewDate: '2026-01-01T00:00:00.000Z',
      interval: 1,
      easeFactor: 2.5,
    },
  ];

  beforeEach(() => {
    resetSpeakingAssessments();
    resetFinalizedAttempts();
    vi.restoreAllMocks();
  });

  // =========================================================================
  // 1. SUPPORTED SUCCESSFUL RECOGNITION & TRUSTED-ONLY SCORING
  // =========================================================================
  describe('Supported Successful Recognition & Trusted-Only Scoring', () => {
    it('evaluates successful speech recognition with high alignment score (100%)', () => {
      const result = gradeSpeakingCheckpointSection({
        attemptId: 'cefr:A1:att-speak-1',
        level: 'A1',
        prompt: mockPrompt,
        turns: mockPrompt.turns,
        isBrowserSupported: true,
        spokenTranscripts: {
          0: 'Hello Sarah! My name is Minh, nice to meet you too.',
          1: 'I am a software engineer in the tech department.',
        },
      });

      expect(result.status).toBe('evaluated');
      expect(result.hasSufficientEvidence).toBe(true);
      expect(result.score).toBe(100);
      expect(result.passedFloor).toBe(true);
      expect(result.evaluatedTurnsCount).toBe(2);
      expect(result.totalTurnsCount).toBe(2);
      expect(result.turnEvaluations).toHaveLength(2);
      expect(result.turnEvaluations.every((t) => t.trustedEvidence && t.passedTurn)).toBe(true);
    });

    it('calculates partial alignment score deterministically based on real spoken text', () => {
      // Turn 0 speaks accurately, Turn 1 misses several words
      const result = gradeSpeakingCheckpointSection({
        attemptId: 'cefr:A1:att-speak-2',
        level: 'A1',
        prompt: mockPrompt,
        turns: mockPrompt.turns,
        isBrowserSupported: true,
        spokenTranscripts: {
          0: 'Hello Sarah! My name is Minh, nice to meet you too.', // 100%
          1: 'I am software in tech.', // partial match (~50-60%)
        },
      });

      expect(result.status).toBe('evaluated');
      expect(result.score).toBeGreaterThanOrEqual(60);
      expect(result.score).toBeLessThan(100);
      expect(result.turnEvaluations[0].accuracyScore).toBe(100);
      expect(result.turnEvaluations[1].accuracyScore).toBeLessThan(100);
    });

    it('marks passedFloor as false when real spoken score is below required floor threshold', () => {
      const result = gradeSpeakingCheckpointSection({
        attemptId: 'cefr:A1:att-speak-3',
        level: 'A1',
        prompt: mockPrompt,
        turns: mockPrompt.turns,
        isBrowserSupported: true,
        spokenTranscripts: {
          0: 'Yes hi bye', // Very low alignment
          1: 'No something else', // Very low alignment
        },
      });

      expect(result.status).toBe('evaluated');
      expect(result.score).toBeLessThan(55); // A1 floor is 55
      expect(result.passedFloor).toBe(false);
      expect(result.requiredFloor).toBe(55);
    });
  });

  // =========================================================================
  // 2. TRUST BOUNDARY: MIC DENIED, UNSUPPORTED BROWSER, RECOGNITION ERROR
  // =========================================================================
  describe('Trust Boundary & Failure Modes (NO FAKE SCORES!)', () => {
    it('returns insufficient_evidence and null score when browser does not support Web Speech API', () => {
      const result = gradeSpeakingCheckpointSection({
        attemptId: 'cefr:A1:att-unsup-1',
        level: 'A1',
        prompt: mockPrompt,
        turns: mockPrompt.turns,
        isBrowserSupported: false, // Unsupported browser
        spokenTranscripts: {
          0: 'Hello Sarah',
          1: 'I am engineer',
        },
      });

      expect(result.status).toBe('insufficient_evidence');
      expect(result.score).toBeNull(); // NEVER fake score or fallback 85%
      expect(result.hasSufficientEvidence).toBe(false);
      expect(result.reason).toBe('unsupported_browser');
      expect(result.passedFloor).toBe(false);
    });

    it('returns insufficient_evidence and null score when microphone permission is denied', () => {
      const result = gradeSpeakingCheckpointSection({
        attemptId: 'cefr:A1:att-denied-1',
        level: 'A1',
        prompt: mockPrompt,
        turns: mockPrompt.turns,
        isBrowserSupported: true,
        spokenTranscripts: {},
        turnMetadata: {
          0: { isTrusted: false, error: 'permission-denied' },
        },
      });

      expect(result.status).toBe('insufficient_evidence');
      expect(result.score).toBeNull(); // ZERO fallback
      expect(result.hasSufficientEvidence).toBe(false);
      expect(result.reason).toBe('permission_denied');
      expect(result.passedFloor).toBe(false);
    });

    it('returns insufficient_evidence when speech recognition encounters audio-capture or network error', () => {
      const result = gradeSpeakingCheckpointSection({
        attemptId: 'cefr:A1:att-err-1',
        level: 'A1',
        prompt: mockPrompt,
        turns: mockPrompt.turns,
        isBrowserSupported: true,
        spokenTranscripts: {
          0: 'Hello Sarah',
        },
        turnMetadata: {
          1: { isTrusted: false, error: 'audio-capture' },
        },
      });

      expect(result.status).toBe('insufficient_evidence');
      expect(result.score).toBeNull();
      expect(result.hasSufficientEvidence).toBe(false);
      expect(result.reason).toBe('recognition_error');
    });

    it('returns insufficient_evidence when evidence is flagged as untrusted (invalid evidence)', () => {
      const result = gradeSpeakingCheckpointSection({
        attemptId: 'cefr:A1:att-untrusted-1',
        level: 'A1',
        prompt: mockPrompt,
        turns: mockPrompt.turns,
        isBrowserSupported: true,
        spokenTranscripts: {
          0: 'Hello Sarah',
          1: 'I am engineer',
        },
        turnMetadata: {
          0: { isTrusted: false },
        },
      });

      expect(result.status).toBe('insufficient_evidence');
      expect(result.score).toBeNull();
      expect(result.reason).toBe('invalid_evidence');
    });
  });

  // =========================================================================
  // 3. EMPTY RESULT & MISSING TRANSCRIPT
  // =========================================================================
  describe('Empty Result & Missing Turns', () => {
    it('returns insufficient_evidence when turn transcript is empty or whitespace only', () => {
      const result = gradeSpeakingCheckpointSection({
        attemptId: 'cefr:A1:att-empty-1',
        level: 'A1',
        prompt: mockPrompt,
        turns: mockPrompt.turns,
        isBrowserSupported: true,
        spokenTranscripts: {
          0: 'Hello Sarah! My name is Minh, nice to meet you too.',
          1: '   ', // Empty whitespace
        },
      });

      expect(result.status).toBe('insufficient_evidence');
      expect(result.score).toBeNull();
      expect(result.reason).toBe('empty_transcript');
      expect(result.hasSufficientEvidence).toBe(false);
    });

    it('returns insufficient_evidence when user has not recorded any turn', () => {
      const result = gradeSpeakingCheckpointSection({
        attemptId: 'cefr:A1:att-empty-2',
        level: 'A1',
        prompt: mockPrompt,
        turns: mockPrompt.turns,
        isBrowserSupported: true,
        spokenTranscripts: {}, // 0 turns completed
      });

      expect(result.status).toBe('insufficient_evidence');
      expect(result.score).toBeNull();
      expect(result.reason).toBe('empty_transcript');
    });

    it('returns insufficient_evidence when prompt is missing or has zero turns', () => {
      const resultNullPrompt = gradeSpeakingCheckpointSection({
        attemptId: 'cefr:A1:att-null-p',
        level: 'A1',
        prompt: null,
        isBrowserSupported: true,
        spokenTranscripts: { 0: 'Hello' },
      });
      expect(resultNullPrompt.status).toBe('insufficient_evidence');
      expect(resultNullPrompt.reason).toBe('missing_prompt');

      const resultEmptyTurns = gradeSpeakingCheckpointSection({
        attemptId: 'cefr:A1:att-empty-t',
        level: 'A1',
        prompt: { ...mockPrompt, turns: [] },
        isBrowserSupported: true,
        spokenTranscripts: { 0: 'Hello' },
      });
      expect(resultEmptyTurns.status).toBe('insufficient_evidence');
      expect(resultEmptyTurns.reason).toBe('empty_turns');
    });
  });

  // =========================================================================
  // 4. DUPLICATE SUBMIT & DUPLICATE CALLBACK PROTECTION
  // =========================================================================
  describe('Duplicate Submit Protection (First Valid Submission Wins)', () => {
    it('caches first submission and returns cached result on duplicate submit attempts', () => {
      const attemptId = 'cefr:A1:speaking-idempotent-1';

      expect(isSpeakingAttemptSubmitted(attemptId)).toBe(false);

      // First submission: 100% correct
      const firstResult = submitSpeakingSection({
        attemptId,
        level: 'A1',
        prompt: mockPrompt,
        turns: mockPrompt.turns,
        isBrowserSupported: true,
        spokenTranscripts: {
          0: 'Hello Sarah! My name is Minh, nice to meet you too.',
          1: 'I am a software engineer in the tech department.',
        },
      });

      expect(firstResult.status).toBe('evaluated');
      expect(firstResult.score).toBe(100);
      expect(isSpeakingAttemptSubmitted(attemptId)).toBe(true);

      // Second submission: attempts to replace with 0% / broken transcripts
      const secondResult = submitSpeakingSection({
        attemptId,
        level: 'A1',
        prompt: mockPrompt,
        turns: mockPrompt.turns,
        isBrowserSupported: true,
        spokenTranscripts: {
          0: 'Gibberish',
          1: 'Broken',
        },
      });

      // INVARIANT: First submission must prevail!
      expect(secondResult.score).toBe(100);
      expect(secondResult.evaluatedAt).toBe(firstResult.evaluatedAt);

      const retrieved = getSpeakingAttemptResult(attemptId);
      expect(retrieved).not.toBeNull();
      expect(retrieved?.score).toBe(100);
    });

    it('does not cache insufficient_evidence attempts so learner can complete valid recording', () => {
      const attemptId = 'cefr:A1:speaking-fixable-attempt';

      // 1. Initial attempt with missing transcripts -> insufficient evidence
      const initial = submitSpeakingSection({
        attemptId,
        level: 'A1',
        prompt: mockPrompt,
        turns: mockPrompt.turns,
        isBrowserSupported: true,
        spokenTranscripts: {},
      });

      expect(initial.status).toBe('insufficient_evidence');
      expect(isSpeakingAttemptSubmitted(attemptId)).toBe(false);

      // 2. Subsequent submission with complete transcripts -> evaluated and cached
      const valid = submitSpeakingSection({
        attemptId,
        level: 'A1',
        prompt: mockPrompt,
        turns: mockPrompt.turns,
        isBrowserSupported: true,
        spokenTranscripts: {
          0: 'Hello Sarah! My name is Minh, nice to meet you too.',
          1: 'I am a software engineer in the tech department.',
        },
      });

      expect(valid.status).toBe('evaluated');
      expect(valid.score).toBe(100);
      expect(isSpeakingAttemptSubmitted(attemptId)).toBe(true);
    });
  });

  // =========================================================================
  // 5. ANSWER PERSISTENCE & RESUME SAFETY
  // =========================================================================
  describe('Answer Persistence & Resume Safety', () => {
    it('persists spoken transcripts in session state draft updates', () => {
      let state = createInitialCheckpointState('A1');
      state = startCheckpointSession(state);

      // Advance from listening -> reading -> speaking
      state = advanceToNextSection(state, 90); // to reading
      state = advanceToNextSection(state, 85); // to speaking
      expect(state.stage).toBe('speaking');
      expect(state.currentSection).toBe('speaking');

      // Save speaking transcripts turn by turn
      state = saveSectionDraft(state, {
        speaking: { 0: 'Hello Sarah! My name is Minh, nice to meet you too.' },
      });
      expect(state.answers.speaking[0]).toBe('Hello Sarah! My name is Minh, nice to meet you too.');

      state = saveSectionDraft(state, {
        speaking: { 1: 'I am a software engineer in the tech department.' },
      });
      expect(state.answers.speaking[1]).toBe('I am a software engineer in the tech department.');
    });

    it('converts to ResumableActivity and restores faithfully without losing spoken transcripts', () => {
      let state = createInitialCheckpointState('B2');
      state = startCheckpointSession(state);
      state = advanceToNextSection(state, 90);
      state = advanceToNextSection(state, 85);

      state = saveSectionDraft(state, {
        speaking: {
          0: 'First turn transcript speech evidence',
          1: 'Second turn transcript speech evidence',
        },
      });

      // Convert to resumable activity
      const activity = checkpointStateToResumableActivity(state, 'CEFR B2 Checkpoint Exam');
      expect(activity.type).toBe('checkpoint');
      expect(activity.checkpoint.speakingTranscripts).toEqual({
        0: 'First turn transcript speech evidence',
        1: 'Second turn transcript speech evidence',
      });
      expect(activity.checkpoint.currentSection).toBe('speaking');

      // Restore from activity
      const restored = restoreCheckpointStateFromActivity(activity);
      expect(restored).not.toBeNull();
      expect(restored?.level).toBe('B2');
      expect(restored?.stage).toBe('speaking');
      expect(restored?.answers.speaking).toEqual({
        0: 'First turn transcript speech evidence',
        1: 'Second turn transcript speech evidence',
      });
      expect(restored?.sectionScores.listening).toBe(90);
      expect(restored?.sectionScores.reading).toBe(85);
    });
  });

  // =========================================================================
  // 6. MISTAKE BANK INTEGRATION & DEDUPLICATION
  // =========================================================================
  describe('Mistake Bank Pipeline & Deduplication', () => {
    it('captures pronunciation mistake only for failed turns (< 60%) and deduplicates on replay', () => {
      const mockRecordMistake = vi.fn();
      const attemptId = 'cefr:A1:speaking-mistake-dedupe';

      const evalResult = gradeSpeakingCheckpointSection({
        attemptId,
        level: 'A1',
        prompt: mockPrompt,
        turns: mockPrompt.turns,
        isBrowserSupported: true,
        spokenTranscripts: {
          0: 'Hello Sarah! My name is Minh, nice to meet you too.', // 100% -> PASS, no mistake
          1: 'Wrong answer gibberish words', // < 60% -> FAIL -> captures mistake
        },
      });

      expect(evalResult.status).toBe('evaluated');

      // 1. First mistake recording
      const recordedCount1 = processSpeakingMistakes({
        attemptId,
        promptTitle: mockPrompt.title,
        evaluation: evalResult,
        turns: mockPrompt.turns,
        vocabularyList: mockVocabList,
        recordMistake: mockRecordMistake,
      });

      expect(recordedCount1).toBe(1);
      expect(mockRecordMistake).toHaveBeenCalledTimes(1);
      expect(mockRecordMistake).toHaveBeenCalledWith(
        expect.anything(),
        'pronunciation',
        expect.objectContaining({
          type: 'pronunciation',
          userAnswer: 'Wrong answer gibberish words',
        })
      );

      // 2. Second mistake recording (simulating replay / re-mount)
      const recordedCount2 = processSpeakingMistakes({
        attemptId,
        promptTitle: mockPrompt.title,
        evaluation: evalResult,
        turns: mockPrompt.turns,
        vocabularyList: mockVocabList,
        recordMistake: mockRecordMistake,
      });

      // Invariant: Deduplicated! Should NOT record again
      expect(recordedCount2).toBe(0);
      expect(mockRecordMistake).toHaveBeenCalledTimes(1);
    });
  });
});
