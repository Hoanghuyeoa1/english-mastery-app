// src/services/__tests__/tutorFeedbackBridge.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { useAppStore } from '../../store/useAppStore';
import {
  normalizeGrammarPattern,
  ingestTutorFeedback,
  enrollTutorCollocationToSRS,
  clearIngestionHistory,
} from '../tutorFeedbackBridge';
import { deriveTutorLearningContext } from '../tutorLearningContext';
import { extractCandidateTargets } from '../tutorSessionManager';
import { toCanonicalType } from '../adaptiveMistakeService';
import type { TutorLearningTelemetry, MistakeRecord } from '../../types';

describe('Phase 3 — AI Tutor Feedback → Learning System Bridge Hardening', () => {
  beforeEach(() => {
    // Reset in-memory deduplication cache
    clearIngestionHistory();

    // Reset Zustand store state to pristine defaults before each test
    useAppStore.setState({
      mistakeBank: {},
      userCollocations: [],
      userCustomWords: [],
      srsProgressMap: {},
      recentReviewEvents: [],
      fourSkillsScores: { listening: [], reading: [], speaking: [], writing: [] },
      profile: {
        ...useAppStore.getState().profile,
        name: 'Test Learner',
      },
    });
  });

  // =========================================================================
  // 1. Trusted valid grammar telemetry persists
  // =========================================================================
  it('1. trusted valid grammar telemetry persists into Mistake Bank with canonical key', () => {
    const trustedTelemetry: TutorLearningTelemetry = {
      isTrusted: true,
      practicedTargets: ['although'],
      detectedMistakes: [
        {
          target: 'contrast clauses (although vs despite)',
          type: 'grammar',
          userAnswer: 'despite he was tired',
          correction: 'although he was tired',
          explanation: 'Dùng although đi với mệnh đề.',
        },
      ],
    };

    const res = ingestTutorFeedback({
      telemetry: trustedTelemetry,
      userMessage: 'He finished the project despite he was tired.',
      turnId: 'turn_test_1',
    });

    expect(res.ingested).toBe(true);
    expect(res.mistakesRecorded).toBe(1);

    const state = useAppStore.getState();
    const record = state.mistakeBank['grammar_although_vs_despite'];
    expect(record).toBeDefined();
    expect(record.source).toBe('ai_tutor');
    expect(record.primaryType).toBe('grammar');
    expect(record.mistakeCount).toBe(1);
    expect(record.word).toBe('although vs despite');
  });

  // =========================================================================
  // 2. Untrusted/fallback telemetry ignored
  // =========================================================================
  it('2. untrusted/fallback telemetry ignored without modifying learning state', () => {
    const fallbackTelemetry: TutorLearningTelemetry = {
      isTrusted: false,
      detectedMistakes: [
        {
          target: 'contrast clauses (although vs despite)',
          type: 'grammar',
          userAnswer: 'despite he was tired',
        },
      ],
    };

    const res = ingestTutorFeedback({
      telemetry: fallbackTelemetry,
      userMessage: 'He finished it despite he was tired.',
    });

    expect(res.ingested).toBe(false);
    expect(res.reason).toBe('untrusted_or_empty_telemetry');
    expect(Object.keys(useAppStore.getState().mistakeBank)).toHaveLength(0);
  });

  // =========================================================================
  // 3. Hallucinated target unrelated to user turn rejected
  // =========================================================================
  it('3. hallucinated target unrelated to user turn is rejected by local evidence validation', () => {
    const hallucinatedTelemetry: TutorLearningTelemetry = {
      isTrusted: true,
      detectedMistakes: [
        {
          target: 'quantum mechanics',
          type: 'meaning',
          userAnswer: 'quantum mechanics is difficult',
          explanation: 'Chủ đề vật lý lượng tử.',
        },
      ],
    };

    const res = ingestTutorFeedback({
      telemetry: hallucinatedTelemetry,
      userMessage: 'Good morning, how are you today?', // No relation whatsoever
      candidateTargets: ['introduce_yourself'],
      currentTarget: 'introduce_yourself',
    });

    expect(res.ingested).toBe(false);
    expect(res.mistakesRecorded).toBe(0);
    expect(Object.keys(useAppStore.getState().mistakeBank)).toHaveLength(0);
  });

  // =========================================================================
  // 4. Actual local user turn overrides Gemini echo
  // =========================================================================
  it('4. actual local user turn overrides Gemini echo for stored userAnswer and context', () => {
    const actualUserUtterance = 'He came to work despite he was sick.';
    const modelEchoedAnswer = 'Mangled Gemini hallucinated echo';

    const telemetry: TutorLearningTelemetry = {
      isTrusted: true,
      detectedMistakes: [
        {
          target: 'contrast clauses (although vs despite)',
          type: 'grammar',
          userAnswer: modelEchoedAnswer,
          correction: 'although he was sick',
        },
      ],
    };

    ingestTutorFeedback({
      telemetry,
      userMessage: actualUserUtterance,
      turnId: 'turn_authoritative_test',
    });

    const record = useAppStore.getState().mistakeBank['grammar_although_vs_despite'];
    expect(record).toBeDefined();
    // Authoritative user answer must be derived from actual local utterance, not model echo
    expect(record.lastUserAnswer).toBe(actualUserUtterance.slice(0, 150));
    expect(record.lastUserAnswer).not.toContain(modelEchoedAnswer);
  });

  // =========================================================================
  // 5. Duplicate mistake in same payload counted once
  // =========================================================================
  it('5. duplicate mistake in same payload counted once', () => {
    const telemetry: TutorLearningTelemetry = {
      isTrusted: true,
      detectedMistakes: [
        {
          target: 'although',
          type: 'grammar',
          userAnswer: 'despite he was tired',
          correction: 'although he was tired',
        },
        {
          target: 'contrast clauses (although vs despite)',
          type: 'grammar',
          userAnswer: 'despite he was tired',
          correction: 'although he was tired',
        },
      ],
    };

    const res = ingestTutorFeedback({
      telemetry,
      userMessage: 'He went out despite he was tired.',
      turnId: 'turn_payload_dedup',
    });

    expect(res.ingested).toBe(true);
    expect(res.mistakesRecorded).toBe(1);

    const records = Object.values(useAppStore.getState().mistakeBank);
    expect(records).toHaveLength(1);
    expect(records[0].mistakeCount).toBe(1);
  });

  // =========================================================================
  // 6. Same response ingested twice counted once
  // =========================================================================
  it('6. same response ingested twice counted once (idempotent)', () => {
    const telemetry: TutorLearningTelemetry = {
      isTrusted: true,
      detectedMistakes: [
        {
          target: 'contrast clauses (although vs despite)',
          type: 'grammar',
          correction: 'although he was tired',
        },
      ],
    };

    const options = {
      telemetry,
      userMessage: 'He walked home despite he was tired.',
      turnId: 'turn_idempotent_1',
    };

    // First ingestion call
    const res1 = ingestTutorFeedback(options);
    expect(res1.ingested).toBe(true);
    expect(res1.mistakesRecorded).toBe(1);
    expect(useAppStore.getState().mistakeBank['grammar_although_vs_despite'].mistakeCount).toBe(1);

    // Accidental second ingestion of the identical turn
    const res2 = ingestTutorFeedback(options);
    expect(res2.ingested).toBe(false);
    expect(res2.reason).toBe('duplicate_turn_ingestion');
    expect(res2.mistakesRecorded).toBe(0);

    // Mistake count remains exactly 1
    expect(useAppStore.getState().mistakeBank['grammar_although_vs_despite'].mistakeCount).toBe(1);
  });

  // =========================================================================
  // 7. Same error next distinct turn counts recurrence
  // =========================================================================
  it('7. same error in next distinct user turn counts recurrence (+1)', () => {
    const telemetry: TutorLearningTelemetry = {
      isTrusted: true,
      detectedMistakes: [
        {
          target: 'contrast clauses (although vs despite)',
          type: 'grammar',
          correction: 'although it rained',
        },
      ],
    };

    // Turn 1
    ingestTutorFeedback({
      telemetry,
      userMessage: 'We left despite it was raining.',
      turnId: 'turn_seq_1',
    });
    expect(useAppStore.getState().mistakeBank['grammar_although_vs_despite'].mistakeCount).toBe(1);

    // Turn 2: Distinct turn repeats the same error
    ingestTutorFeedback({
      telemetry,
      userMessage: 'They succeeded despite they were exhausted.',
      turnId: 'turn_seq_2',
    });

    const record = useAppStore.getState().mistakeBank['grammar_although_vs_despite'];
    expect(record.mistakeCount).toBe(2);
    expect(record.wrongCount).toBe(2);
  });

  // =========================================================================
  // 8. Resolved mistake recurrence follows existing reopen semantics
  // =========================================================================
  it('8. resolved mistake recurrence reopens mistake record and resets consecutive correct', () => {
    // Seed pre-existing resolved mistake
    useAppStore.setState({
      mistakeBank: {
        grammar_although_vs_despite: {
          id: 'grammar_although_vs_despite',
          word: 'although vs despite',
          meaning: 'Mệnh đề tương phản',
          mistakeCount: 2,
          wrongCount: 2,
          consecutiveCorrect: 2,
          resolved: true,
          resolvedDate: '2026-10-01T00:00:00.000Z',
          source: 'ai_tutor',
          primaryType: 'grammar',
          sourceCounts: { ai_tutor: 2 },
          typeCounts: { grammar: 2 },
        } as MistakeRecord,
      },
    });

    // Ingest recurrence in AI Tutor
    ingestTutorFeedback({
      telemetry: {
        isTrusted: true,
        detectedMistakes: [
          {
            target: 'contrast clauses (although vs despite)',
            type: 'grammar',
            correction: 'although it was late',
          },
        ],
      },
      userMessage: 'He kept working despite it was late.',
      turnId: 'turn_reopen_test',
    });

    const updated = useAppStore.getState().mistakeBank['grammar_although_vs_despite'];
    expect(updated.resolved).toBe(false); // REOPENED!
    expect(updated.consecutiveCorrect).toBe(0); // RESET!
    expect(updated.mistakeCount).toBe(3);
    expect(updated.reopenCount).toBe(1);
  });

  // =========================================================================
  // 9. Explicit type beats ai_tutor default type
  // =========================================================================
  it('9. explicit valid type beats ai_tutor source default type', () => {
    expect(toCanonicalType('grammar', 'ai_tutor')).toBe('grammar');
    expect(toCanonicalType('collocation', 'ai_tutor')).toBe('collocation');
    expect(toCanonicalType('spelling', 'ai_tutor')).toBe('spelling');
    expect(toCanonicalType('pronunciation', 'ai_tutor')).toBe('pronunciation');
    expect(toCanonicalType('meaning', 'ai_tutor')).toBe('meaning');

    // Only falls back to other if no type or unmapped
    expect(toCanonicalType(undefined, 'ai_tutor')).toBe('other');
  });

  // =========================================================================
  // 10. Unknown type sanitized
  // =========================================================================
  it('10. unknown arbitrary model type is safely sanitized without polluting enum', () => {
    const sanitized = toCanonicalType('arbitrary_model_syntax_hallucination', 'ai_tutor');
    expect(sanitized).toBe('other');
  });

  // =========================================================================
  // 11. Text-only pronunciation claim not persisted
  // =========================================================================
  it('11. text-only pronunciation claim is not persisted; requires speech evidence', () => {
    const pronTelemetry: TutorLearningTelemetry = {
      isTrusted: true,
      detectedMistakes: [
        {
          target: 'asynchronous',
          type: 'pronunciation',
          correction: 'asynchronous /eɪˈsɪŋkrənəs/',
        },
      ],
    };

    // Case A: Text-only mode (hasSpeechEvidence: false)
    const resTextOnly = ingestTutorFeedback({
      telemetry: pronTelemetry,
      userMessage: 'I am using asynchronous programming.',
      hasSpeechEvidence: false,
      turnId: 'pron_text_turn',
    });

    expect(resTextOnly.ingested).toBe(false);
    expect(resTextOnly.mistakesRecorded).toBe(0);
    expect(Object.keys(useAppStore.getState().mistakeBank)).toHaveLength(0);

    // Case B: Speech mode with physical audio evidence (hasSpeechEvidence: true)
    const resWithSpeech = ingestTutorFeedback({
      telemetry: pronTelemetry,
      userMessage: 'I am using asynchronous programming.',
      hasSpeechEvidence: true,
      turnId: 'pron_speech_turn',
    });

    expect(resWithSpeech.ingested).toBe(true);
    expect(resWithSpeech.mistakesRecorded).toBe(1);
    expect(useAppStore.getState().mistakeBank['pron_asynchronous']).toBeDefined();
    expect(useAppStore.getState().mistakeBank['pron_asynchronous'].primaryType).toBe('pronunciation');
  });

  // =========================================================================
  // 12. Grammar mistake does not auto-create collocation
  // =========================================================================
  it('12. grammar mistake does not auto-create collocation or vocabulary cards', () => {
    ingestTutorFeedback({
      telemetry: {
        isTrusted: true,
        detectedMistakes: [
          {
            target: 'contrast clauses (although vs despite)',
            type: 'grammar',
            correction: 'Although he was tired, he finished on time.',
          },
        ],
      },
      userMessage: 'He finished on time despite he was tired.',
      turnId: 'grammar_no_cross_create',
    });

    const state = useAppStore.getState();
    expect(Object.keys(state.mistakeBank)).toHaveLength(1);
    expect(state.userCollocations).toHaveLength(0); // STRICT INVARIANT: ZERO collocation created!
  });

  // =========================================================================
  // 13. Collocation SRS policy behaves exactly as chosen (EXPLICIT USER SAVE ONLY)
  // =========================================================================
  it('13. collocation SRS policy: captures mistake in bank, suggests phrase, enrolls SRS only upon explicit action', () => {
    const collocTelemetry: TutorLearningTelemetry = {
      isTrusted: true,
      detectedMistakes: [
        {
          target: 'make conclusions',
          type: 'collocation',
          correction: 'draw conclusions',
          explanation: 'Dùng cụm từ tự nhiên: draw conclusions.',
        },
      ],
    };

    // 1. Ingestion: Mistake captured in Mistake Bank, suggested in result, but NOT enrolled into SRS
    const res = ingestTutorFeedback({
      telemetry: collocTelemetry,
      userMessage: 'We need to make conclusions from data.',
      autoEnrollCollocationSRS: false, // Default: EXPLICIT USER SAVE ONLY
      turnId: 'colloc_policy_turn',
    });

    expect(res.ingested).toBe(true);
    expect(res.mistakesRecorded).toBe(1);
    expect(res.collocationsSaved).toBe(0);
    expect(res.collocationSuggestions).toContain('draw conclusions');

    let state = useAppStore.getState();
    expect(state.mistakeBank['colloc_draw_conclusions']).toBeDefined();
    expect(state.userCollocations).toHaveLength(0); // Not auto-enrolled!

    // 2. Explicit User Action (e.g. user clicks "Add to SRS" in UI)
    const enrollRes = enrollTutorCollocationToSRS('draw conclusions');
    expect(enrollRes.success).toBe(true);

    state = useAppStore.getState();
    expect(state.userCollocations).toHaveLength(1);
    expect(state.userCollocations[0].phrase).toBe('draw conclusions');
    expect(state.userCollocations[0].sources).toContain('ai_tutor');
    expect(state.srsProgressMap[state.userCollocations[0].id]).toBeDefined();
  });

  // =========================================================================
  // 14. Duplicate collocation preserves schedule
  // =========================================================================
  it('14. duplicate collocation preserves existing SRS schedule and merges provenance', () => {
    const store = useAppStore.getState();

    // 1. Existing collocation card already learned in writing
    const existing = store.saveCollocationToSRS({
      phrase: 'draw conclusions',
      meaning: 'rút ra kết luận',
      exampleEn: 'We draw conclusions from results.',
      exampleVi: 'Chúng tôi rút ra kết luận từ kết quả.',
      source: 'writing',
      sources: ['writing'],
    });

    // Advance SRS progress on the existing card
    useAppStore.setState((s) => ({
      srsProgressMap: {
        ...s.srsProgressMap,
        [existing.id]: {
          srsLevel: 3,
          interval: 15,
          easeFactor: 2.6,
          nextReviewDate: '2026-10-25T00:00:00.000Z',
          lastReviewedDate: '2026-10-10T00:00:00.000Z',
        },
      },
    }));

    // 2. Re-enrolling identical collocation ("Draw conclusions.") from AI Tutor
    const reSave = store.saveCollocationToSRS({
      phrase: 'Draw conclusions.',
      meaning: 'rút ra kết luận từ dữ liệu',
      exampleEn: 'We draw conclusions from results.',
      exampleVi: 'Chúng tôi rút ra kết luận từ dữ liệu.',
      source: 'ai_tutor',
      sources: ['ai_tutor'],
    });

    expect(reSave.isDuplicate).toBe(true);
    expect(reSave.id).toBe(existing.id);

    const updatedState = useAppStore.getState();
    expect(updatedState.userCollocations).toHaveLength(1);
    // Sources merged to union
    expect(updatedState.userCollocations[0].sources).toEqual(expect.arrayContaining(['writing', 'ai_tutor']));

    // STRICT INVARIANT: SRS progress was not reset!
    const prog = updatedState.srsProgressMap[existing.id];
    expect(prog.srsLevel).toBe(3);
    expect(prog.interval).toBe(15);
    expect(prog.easeFactor).toBe(2.6);
  });

  // =========================================================================
  // 15. Grammar alias grouping deterministic
  // =========================================================================
  it('15. grammar alias grouping is deterministic for reversible pairs', () => {
    const pairs = [
      { t1: 'although vs despite', t2: 'despite vs although', expected: 'grammar_although_vs_despite' },
      { t1: 'because vs because of', t2: 'because of vs because', expected: 'grammar_because_vs_because_of' },
      { t1: 'present perfect vs past simple', t2: 'past simple vs present perfect', expected: 'grammar_present_perfect_vs_past_simple' },
    ];

    for (const p of pairs) {
      expect(normalizeGrammarPattern(p.t1).patternKey).toBe(p.expected);
      expect(normalizeGrammarPattern(p.t2).patternKey).toBe(p.expected);
    }
  });

  // =========================================================================
  // 16. Unrelated grammar patterns stay distinct
  // =========================================================================
  it('16. unrelated novel grammar topics remain distinct without aggressive merging', () => {
    const g1 = normalizeGrammarPattern('inversion with negative adverbials');
    const g2 = normalizeGrammarPattern('cleft sentences');
    const g3 = normalizeGrammarPattern('participle clauses');

    expect(g1.patternKey).toBe('grammar_inversion_with_negative_adverbials');
    expect(g2.patternKey).toBe('grammar_cleft_sentences');
    expect(g3.patternKey).toBe('grammar_participle_clauses');

    expect(g1.patternKey).not.toBe(g2.patternKey);
    expect(g2.patternKey).not.toBe(g3.patternKey);

    // Malformed/empty input fallback safely
    const fallback = normalizeGrammarPattern('   !@#$   ');
    expect(fallback.patternKey).toBe('grammar_general');
  });

  // =========================================================================
  // 17. Repeated cloud merge does not inflate counters
  // =========================================================================
  it('17. repeated cloud merge of identical data does not inflate counters', () => {
    const store = useAppStore.getState();

    // Local state has mistakeCount = 3
    useAppStore.setState({
      mistakeBank: {
        grammar_although_vs_despite: {
          id: 'grammar_although_vs_despite',
          word: 'although vs despite',
          meaning: 'Mệnh đề tương phản',
          mistakeCount: 3,
          wrongCount: 3,
          resolved: false,
          lastMistakeAt: '2026-10-04T12:00:00.000Z',
          source: 'ai_tutor',
          primaryType: 'grammar',
          sourceCounts: { ai_tutor: 3 },
          typeCounts: { grammar: 3 },
        } as MistakeRecord,
      },
    });

    const cloudPayload = {
      mistakeBank: {
        grammar_although_vs_despite: {
          id: 'grammar_although_vs_despite',
          word: 'although vs despite',
          meaning: 'Mệnh đề tương phản',
          mistakeCount: 3,
          wrongCount: 3,
          consecutiveCorrect: 0,
          resolved: false,
          lastMistakeAt: '2026-10-04T12:00:00.000Z',
          source: 'ai_tutor',
          primaryType: 'grammar',
          sourceCounts: { ai_tutor: 3 },
          typeCounts: { grammar: 3 },
        } as MistakeRecord,
      },
    };

    // Merge 5 times repeatedly
    for (let i = 0; i < 5; i++) {
      store.mergeCloudData(cloudPayload);
    }

    const state = useAppStore.getState();
    const item = state.mistakeBank['grammar_although_vs_despite'];
    expect(item.mistakeCount).toBe(3); // STRICT INVARIANT: NOT 6, 9, 12, 15!
    expect(item.wrongCount).toBe(3);
    expect(item.sourceCounts?.ai_tutor).toBe(3);
    expect(item.typeCounts?.grammar).toBe(3);
  });

  // =========================================================================
  // 18. Structured grammar IDs survive cloud merge
  // =========================================================================
  it('18. structured grammar IDs survive cloud merge and merge counts deterministically', () => {
    const store = useAppStore.getState();

    // Device A state
    useAppStore.setState({
      mistakeBank: {
        grammar_although_vs_despite: {
          id: 'grammar_although_vs_despite',
          word: 'although vs despite',
          meaning: 'Mệnh đề tương phản',
          mistakeCount: 2,
          wrongCount: 2,
          consecutiveCorrect: 0,
          resolved: false,
          lastMistakeAt: '2026-10-04T10:00:00.000Z',
          source: 'ai_tutor',
          primaryType: 'grammar',
          sourceCounts: { ai_tutor: 2 },
          typeCounts: { grammar: 2 },
        } as MistakeRecord,
      },
      userCollocations: [
        {
          id: 'colloc_1',
          phrase: 'draw conclusions',
          meaning: 'rút ra kết luận',
          exampleEn: 'We draw conclusions from results.',
          exampleVi: 'Chúng tôi rút ra kết luận từ kết quả.',
          sources: ['writing'],
          createdAt: '2026-10-01T00:00:00.000Z',
        },
      ],
    });

    // Device B cloud payload
    const cloudPayload = {
      mistakeBank: {
        grammar_although_vs_despite: {
          id: 'grammar_although_vs_despite',
          word: 'although vs despite',
          meaning: 'Mệnh đề tương phản',
          mistakeCount: 3,
          wrongCount: 3,
          consecutiveCorrect: 0,
          resolved: false,
          lastMistakeAt: '2026-10-04T12:00:00.000Z',
          source: 'ai_tutor',
          primaryType: 'grammar',
          sourceCounts: { ai_tutor: 3 },
          typeCounts: { grammar: 3 },
        } as MistakeRecord,
      },
      userCollocations: [
        {
          id: 'colloc_1',
          phrase: 'draw conclusions',
          meaning: 'rút ra kết luận',
          exampleEn: 'We draw conclusions from results.',
          exampleVi: 'Chúng tôi rút ra kết luận từ kết quả.',
          sources: ['ai_tutor'],
          createdAt: '2026-10-02T00:00:00.000Z',
        },
      ],
    };

    store.mergeCloudData(cloudPayload);

    const updated = useAppStore.getState();
    const mistakes = Object.values(updated.mistakeBank);
    expect(mistakes).toHaveLength(1);
    expect(mistakes[0].id).toBe('grammar_although_vs_despite');
    expect(mistakes[0].mistakeCount).toBe(3);
    expect(mistakes[0].sourceCounts?.ai_tutor).toBe(3);

    // Collocation sources merged
    expect(updated.userCollocations).toHaveLength(1);
    expect(updated.userCollocations[0].sources).toEqual(expect.arrayContaining(['writing', 'ai_tutor']));
  });

  // =========================================================================
  // 19. Backup roundtrip preserves ai_tutor metadata
  // =========================================================================
  it('19. backup export/import roundtrip preserves AI Tutor metadata losslessly', () => {
    // 1. Ingest feedback
    ingestTutorFeedback({
      telemetry: {
        isTrusted: true,
        detectedMistakes: [
          {
            target: 'contrast clauses (although vs despite)',
            type: 'grammar',
            correction: 'although he was tired',
          },
        ],
      },
      userMessage: 'He finished despite he was tired.',
      turnId: 'roundtrip_turn',
    });

    // Explicitly enroll collocation
    enrollTutorCollocationToSRS('draw conclusions');

    const originalState = useAppStore.getState();
    const backupJson = JSON.stringify({
      mistakeBank: originalState.mistakeBank,
      userCollocations: originalState.userCollocations,
      srsProgressMap: originalState.srsProgressMap,
    });

    // Clear store
    useAppStore.setState({
      mistakeBank: {},
      userCollocations: [],
      srsProgressMap: {},
    });

    // Restore from backup
    const parsed = JSON.parse(backupJson);
    useAppStore.setState({
      mistakeBank: parsed.mistakeBank,
      userCollocations: parsed.userCollocations,
      srsProgressMap: parsed.srsProgressMap,
    });

    const restored = useAppStore.getState();
    const grammarRecord = restored.mistakeBank['grammar_although_vs_despite'];
    expect(grammarRecord).toBeDefined();
    expect(grammarRecord.source).toBe('ai_tutor');
    expect(grammarRecord.primaryType).toBe('grammar');
    expect(grammarRecord.sourceCounts?.ai_tutor).toBe(1);
    expect(grammarRecord.typeCounts?.grammar).toBe(1);

    const collocRecord = restored.userCollocations.find((c) => c.phrase === 'draw conclusions');
    expect(collocRecord).toBeDefined();
    expect(collocRecord?.sources).toContain('ai_tutor');
    expect(restored.srsProgressMap[collocRecord!.id]).toBeDefined();
  });

  // =========================================================================
  // 20. Hallucinated mistake does not enter next Tutor Learning Context
  // =========================================================================
  it('20. hallucinated mistake is rejected and does NOT enter next Tutor Learning Context', () => {
    const hallucinatedTelemetry: TutorLearningTelemetry = {
      isTrusted: true,
      detectedMistakes: [
        {
          target: 'quantum mechanics',
          type: 'meaning',
          userAnswer: 'quantum mechanics is hard',
        },
      ],
    };

    ingestTutorFeedback({
      telemetry: hallucinatedTelemetry,
      userMessage: 'I really love apples and bananas.',
      turnId: 'anti_hallucination_turn',
    });

    // Derive context
    const nextContext = deriveTutorLearningContext(useAppStore.getState());
    expect(nextContext.weakVocabulary.some((w) => w.word === 'quantum mechanics')).toBe(false);
    expect(nextContext.learningPriorities.some((p) => p.targetItems.includes('quantum mechanics'))).toBe(false);
  });

  // =========================================================================
  // 21. Valid persisted mistake does enter next Tutor Learning Context
  // =========================================================================
  it('21. valid persisted mistake enters next Tutor Learning Context to close the loop', () => {
    ingestTutorFeedback({
      telemetry: {
        isTrusted: true,
        detectedMistakes: [
          {
            target: 'contrast clauses (although vs despite)',
            type: 'grammar',
            correction: 'although he was tired',
          },
        ],
      },
      userMessage: 'He came to work despite he was tired.',
      turnId: 'loop_closure_turn',
    });

    const nextContext = deriveTutorLearningContext(useAppStore.getState());
    expect(nextContext.hasLearningHistory).toBe(true);
    expect(nextContext.grammarWeaknesses).toHaveLength(1);
    expect(nextContext.grammarWeaknesses[0].patternOrTopic).toBe('although vs despite');
    expect(nextContext.grammarWeaknesses[0].errorCount).toBe(1);

    const candidates = extractCandidateTargets(nextContext);
    expect(candidates).toContain('although vs despite');
  });

  // =========================================================================
  // 22. No direct FSRS mutation
  // =========================================================================
  it('22. mistake ingestion does NOT directly mutate existing SRS scheduling', () => {
    // Setup existing card in SRS
    useAppStore.setState({
      srsProgressMap: {
        card_existing_1: {
          srsLevel: 3,
          interval: 18,
          easeFactor: 2.5,
          nextReviewDate: '2026-10-30T00:00:00.000Z',
          lastReviewedDate: '2026-10-12T00:00:00.000Z',
          fsrs: {
            stability: 7.2,
            difficulty: 4.8,
            reps: 4,
            lapses: 0,
            state: 2,
            lastReview: '2026-10-12T00:00:00.000Z',
          },
        },
      },
    });

    const snapshotBefore = JSON.parse(JSON.stringify(useAppStore.getState().srsProgressMap));

    // Ingest AI Tutor feedback
    ingestTutorFeedback({
      telemetry: {
        isTrusted: true,
        detectedMistakes: [
          {
            target: 'contrast clauses (although vs despite)',
            type: 'grammar',
            correction: 'although he was tired',
          },
        ],
      },
      userMessage: 'He finished it despite he was tired.',
      turnId: 'fsrs_safety_turn',
    });

    const snapshotAfter = useAppStore.getState().srsProgressMap;
    // STRICT INVARIANT: existing card scheduling parameters remain deep-equal!
    expect(snapshotAfter['card_existing_1']).toEqual(snapshotBefore['card_existing_1']);
  });
});
