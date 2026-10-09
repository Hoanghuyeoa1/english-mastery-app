// src/services/__tests__/phase5TutorE2ERegression.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { useAppStore } from '../../store/useAppStore';
import {
  deriveTutorLearningContext,
  getTutorLearningContext,
  serializeTutorContextForPrompt,
  TUTOR_PROMPT_BUDGET,
} from '../tutorLearningContext';
import {
  extractCandidateTargets,
  selectNextActiveTarget,
  createInitialSessionMemory,
  deriveSessionFocusItems,
} from '../tutorSessionManager';
import {
  buildTutorSystemPrompt,
  parseStructuredTutorResponse,
  generateAIResponse,
  ROLEPLAY_SCENARIOS,
} from '../geminiService';
import {
  ingestTutorFeedback,
  clearIngestionHistory,
} from '../tutorFeedbackBridge';
import type {
  TutorLearningTelemetry,
  MistakeRecord,
  SRSProgress,
  VocabWord,
  CollocationItem,
} from '../../types';

describe('PHASE 5: Personalized AI Tutor Final E2E Regression & Release Audit', () => {
  beforeEach(() => {
    clearIngestionHistory();
    useAppStore.setState({
      geminiApiKey: '',
      mistakeBank: {},
      userCollocations: [],
      userCustomWords: [],
      srsProgressMap: {},
      recentReviewEvents: [],
      fourSkillsScores: { listening: [], reading: [], speaking: [], writing: [] },
      profile: {
        name: 'Audit Learner',
        level: 1,
        xp: 100,
        streak: 3,
        lastActiveDate: '2026-10-04',
        lastStudyDate: '2026-10-04',
        hearts: 5,
        maxHearts: 5,
        avatarSeed: 'audit',
        targetDailyWords: 20,
        targetDailyNewWords: 15,
        extraNewWordsBonus: 0,
        isOnboarded: true,
      },
    });
  });

  // =========================================================================
  // 1. COMPLETE END-TO-END CLOSED LOOP AUDIT
  // =========================================================================
  describe('1. Complete Closed-Loop Flow', () => {
    it('executes full closed loop: History -> Context -> Priorities -> Prompt -> Telemetry -> Ingestion -> Future Context', async () => {
      // Step A: Seed initial learner history in Zustand store
      const initialMistake: MistakeRecord = {
        id: 'mb_although',
        word: 'although',
        source: 'ai_tutor',
        primaryType: 'grammar',
        meaning: 'mặc dù',
        lastContext: 'contrast sentences',
        lastUserAnswer: 'despite he was tired',
        lastExpectedAnswer: 'although he was tired',
        mistakeCount: 3,
        consecutiveCorrect: 0,
        resolved: false,
        lastMistakeAt: new Date(Date.now() - 3600000).toISOString(),
      };

      useAppStore.setState({
        mistakeBank: { mb_although: initialMistake },
        fourSkillsScores: {
          listening: [70],
          reading: [75],
          speaking: [60],
          writing: [65],
        },
      });

      // Step B: Derive Tutor Learning Context
      const context1 = deriveTutorLearningContext({
        mistakeBank: useAppStore.getState().mistakeBank,
        fourSkillsScores: useAppStore.getState().fourSkillsScores,
      });

      expect(context1.hasLearningHistory).toBe(true);
      expect(context1.overallCefr).toBe('B1'); // Average score ~68 -> B1
      expect(context1.grammarWeaknesses.length).toBeGreaterThanOrEqual(1);

      // Step C: Verify Priorities & Session Targets
      const focusItems = deriveSessionFocusItems(context1, 3);
      expect(focusItems).toContain('although');

      const sessionMem = createInitialSessionMemory(context1);
      expect(sessionMem.currentTarget?.toLowerCase()).toBe('although');

      // Step D: Build CEFR-calibrated system prompt for Tech Interview scenario
      const scenario = ROLEPLAY_SCENARIOS[0]; // Tech Interview
      const prompt = buildTutorSystemPrompt(scenario, context1, sessionMem);

      expect(prompt).toContain('Target Learner CEFR: B1');
      expect(prompt).toContain('<learner_data>');
      expect(prompt).toContain('although');
      expect(prompt).not.toContain('AIzaSy'); // No API key leak

      // Step E: Simulate AI Tutor response with structured telemetry
      const simulatedTelemetry: TutorLearningTelemetry = {
        isTrusted: true,
        practicedTargets: ['although'],
        detectedMistakes: [
          {
            target: 'contrast clauses (although vs despite)',
            type: 'grammar',
            userAnswer: 'I finished the task despite I was exhausted',
            correction: 'I finished the task although I was exhausted',
            explanation: 'Dùng although đi kèm mệnh đề có chủ ngữ và vị ngữ.',
          },
        ],
        masteryDemonstrated: false,
        grammarFeedback: 'Chú ý phân biệt mệnh đề sau although.',
      };

      // Step F: Ingest feedback into learning system
      const ingestResult = ingestTutorFeedback({
        telemetry: simulatedTelemetry,
        userMessage: 'I finished the task despite I was exhausted, and deployed the microservice.',
        turnId: 'turn_e2e_closed_loop_1',
        currentTarget: sessionMem.currentTarget,
      });

      expect(ingestResult.ingested).toBe(true);
      expect(ingestResult.mistakesRecorded).toBe(1);

      // Step G: Verify Mistake Bank was updated with normalized canonical key
      const storeAfter = useAppStore.getState();
      const canonicalKey = 'grammar_although_vs_despite';
      const persistedMistake = storeAfter.mistakeBank[canonicalKey];
      expect(persistedMistake).toBeDefined();
      expect(persistedMistake.mistakeCount).toBeGreaterThanOrEqual(1);

      // Step H: Derive future tutor context - reflects updated learning state
      const context2 = deriveTutorLearningContext({
        mistakeBank: storeAfter.mistakeBank,
        fourSkillsScores: storeAfter.fourSkillsScores,
      });

      expect(context2.hasLearningHistory).toBe(true);
      // Clean display name is used in future focus items
      const futureFocus = deriveSessionFocusItems(context2, 3);
      expect(futureFocus.some((f) => f.includes('although'))).toBe(true);
    });
  });

  // =========================================================================
  // 2. EDGE CASES AUDIT
  // =========================================================================
  describe('2. Edge Cases Audit', () => {
    // Edge Case 1: Completely new user
    it('Edge Case 1: completely new user produces zero crash, clean defaults, and valid fallback CEFR', () => {
      const emptyContext = deriveTutorLearningContext({});

      expect(emptyContext.hasLearningHistory).toBe(false);
      expect(emptyContext.overallCefr).toBe('A1');
      expect(emptyContext.learningPriorities).toEqual([]);
      expect(emptyContext.weakVocabulary).toEqual([]);
      expect(emptyContext.weakCollocations).toEqual([]);
      expect(emptyContext.grammarWeaknesses).toEqual([]);

      const focusItems = deriveSessionFocusItems(emptyContext);
      expect(focusItems).toEqual([]);

      const nextTarget = selectNextActiveTarget(emptyContext, null);
      expect(nextTarget).toBeUndefined();

      const sessionMem = createInitialSessionMemory(emptyContext);
      expect(sessionMem.currentTarget).toBeUndefined();

      const prompt = buildTutorSystemPrompt(ROLEPLAY_SCENARIOS[0], emptyContext, sessionMem);
      expect(prompt).toBeDefined();
      expect(prompt).not.toContain('<learner_data>'); // No empty learner_data block
    });

    // Edge Case 2: User only has Mistake Bank
    it('Edge Case 2: user with only Mistake Bank prioritizes mistakes without errors', () => {
      const mistake: MistakeRecord = {
        id: 'mb_spell_1',
        word: 'definitely',
        source: 'flashcard',
        primaryType: 'spelling',
        meaning: 'chắc chắn',
        mistakeCount: 5,
        consecutiveCorrect: 0,
        resolved: false,
        lastMistakeAt: new Date().toISOString(),
      };

      const context = deriveTutorLearningContext({
        mistakeBank: { mb_spell_1: mistake },
      });

      expect(context.hasLearningHistory).toBe(true);
      expect(context.weakVocabulary.length).toBeGreaterThanOrEqual(1);
      expect(context.weakVocabulary[0].word).toBe('definitely');

      const focus = deriveSessionFocusItems(context);
      expect(focus).toContain('definitely');
    });

    // Edge Case 3: User only has SRS (Leeches)
    it('Edge Case 3: user with only SRS history correctly identifies leeches and weak vocabulary', () => {
      const wordList: VocabWord[] = [
        {
          id: 'w_paradox',
          word: 'paradox',
          ipa: 'ˈpærədɒks',
          meaning: 'nghịch lý',
          partOfSpeech: 'noun',
          example: 'It is a curious paradox that drinking hot tea can cool you down.',
          tag: 'Academic',
          srsLevel: 1,
          nextReviewDate: new Date(Date.now() - 1000).toISOString(),
          interval: 1,
          easeFactor: 1.5,
          reviewCount: 6,
          againCount: 4, // 4 lapses -> leech
        },
      ];

      const srsMap: Record<string, SRSProgress> = {
        w_paradox: {
          srsLevel: 1,
          nextReviewDate: new Date(Date.now() - 1000).toISOString(),
          interval: 1,
          easeFactor: 1.5,
          againCount: 4,
          reviewCount: 6,
        },
      };

      const context = deriveTutorLearningContext({
        vocabularyList: wordList,
        srsProgressMap: srsMap,
      });

      expect(context.hasLearningHistory).toBe(true);
      expect(context.leechWords.length).toBeGreaterThanOrEqual(1);
      expect(context.leechWords[0].word).toBe('paradox');

      const focus = deriveSessionFocusItems(context);
      expect(focus).toContain('paradox');
    });

    // Edge Case 4: User only has Four Skills scores
    it('Edge Case 4: user with only Four Skills scores calculates calibrated CEFR and skill deficit priorities', () => {
      const contextNoTargets = deriveTutorLearningContext({
        fourSkillsScores: {
          listening: [80, 85],
          reading: [85, 90],
          speaking: [40, 45], // severe deficit
          writing: [75, 80],
        },
      });

      expect(contextNoTargets.hasLearningHistory).toBe(true);
      // Average is ~73 -> CEFR B2
      expect(contextNoTargets.competency.overallCefr).toBe('B2');
      expect(contextNoTargets.competency.speaking.level).toBe('A2');

      // Invariant: Without concrete mistake/speaking targets, no synthetic priorities are fabricated
      expect(contextNoTargets.learningPriorities).toHaveLength(0);

      // But when concrete pronunciation/speaking mistake records exist in mistake bank,
      // pronunciation priority is generated and boosted by speaking deficit
      const contextWithTargets = deriveTutorLearningContext({
        fourSkillsScores: {
          listening: [80, 85],
          reading: [85, 90],
          speaking: [40, 45],
          writing: [75, 80],
        },
        mistakeBank: {
          m_pron: {
            id: 'm_pron',
            word: 'pronunciation',
            primaryType: 'pronunciation',
            source: 'pronunciation',
            mistakeCount: 2,
            resolved: false,
          } as any,
        },
      });

      const pronPriority = contextWithTargets.learningPriorities.find((p) => p.domain === 'pronunciation');
      expect(pronPriority).toBeDefined();
      expect(pronPriority?.targetItems).toContain('pronunciation');
    });

    // Edge Case 5: Corrupted / Partial historical data
    it('Edge Case 5: corrupted/partial historical data is sanitized gracefully without throwing', () => {
      const corruptedSource = {
        mistakeBank: {
          nullEntry: null as any,
          missingWord: { id: 'm_corrupt' } as any,
          invalidType: { id: 'm_bad', word: 'validword', primaryType: 'INVALID_TYPE' as any } as any,
        },
        fourSkillsScores: {
          listening: [NaN, -10, 1000, 75] as any, // contains invalid numbers
          reading: null as any,
          speaking: undefined as any,
          writing: [60],
        },
        srsProgressMap: {
          nullSrs: null as any,
        },
      };

      expect(() => deriveTutorLearningContext(corruptedSource)).not.toThrow();
      const context = deriveTutorLearningContext(corruptedSource);
      expect(context).toBeDefined();
      expect(Number.isFinite(context.competency.overallScore)).toBe(true);
    });

    // Edge Case 6: Duplicate Tutor feedback (Idempotency)
    it('Edge Case 6: duplicate Tutor feedback ingestion does not double-count mistakes or duplicate SRS entries', () => {
      const telemetry: TutorLearningTelemetry = {
        isTrusted: true,
        practicedTargets: ['although'],
        detectedMistakes: [
          {
            target: 'contrast clauses (although vs despite)',
            type: 'grammar',
            userAnswer: 'despite he was tired',
            correction: 'although he was tired',
            explanation: 'Dùng although với mệnh đề.',
          },
        ],
      };

      const res1 = ingestTutorFeedback({
        telemetry,
        userMessage: 'He came despite he was tired.',
        turnId: 'turn_idempotent_test_999',
      });
      expect(res1.ingested).toBe(true);
      expect(res1.mistakesRecorded).toBe(1);

      const countAfterFirst = useAppStore.getState().mistakeBank['grammar_although_vs_despite']?.mistakeCount;

      // Ingest identical turnId again
      const res2 = ingestTutorFeedback({
        telemetry,
        userMessage: 'He came despite he was tired.',
        turnId: 'turn_idempotent_test_999',
      });
      expect(res2.ingested).toBe(false);
      expect(res2.reason).toBe('duplicate_turn_ingestion');

      const countAfterSecond = useAppStore.getState().mistakeBank['grammar_although_vs_despite']?.mistakeCount;
      expect(countAfterSecond).toBe(countAfterFirst); // Not doubled
    });

    // Edge Case 7: Gemini plain-text response
    it('Edge Case 7: Gemini plain-text response falls back to telemetry-neutral payload without spurious errors', () => {
      const plainText = "That's a great experience! How did you handle cache invalidation in Redis?";
      const scenario = ROLEPLAY_SCENARIOS[0];

      const res = parseStructuredTutorResponse(plainText, scenario, 'I built a Redis caching layer');

      expect(res.reply).toBe(plainText);
      expect(res.isFallback).toBe(false);
      expect(res.telemetry?.isTrusted).toBe(true);
      expect(res.telemetry?.detectedMistakes).toHaveLength(0); // Neutral telemetry
      expect(res.telemetry?.practicedTargets).toHaveLength(0);
    });

    // Edge Case 8: Gemini malformed structured response
    it('Edge Case 8: Gemini malformed structured response recovers via robust parser or mock engine without crash', () => {
      const brokenJson = '```json\n{"reply": "Good job!", "feedback": {"explanation": "Clear answer"}\n```'; // missing closing brace
      const scenario = ROLEPLAY_SCENARIOS[0];

      // Scanner or parser handles cleanly
      const res = parseStructuredTutorResponse(brokenJson, scenario, 'My answer');
      expect(res).toBeDefined();
      expect(typeof res.reply).toBe('string');
      expect(res.reply.length).toBeGreaterThan(0);
    });

    // Edge Case 9: Gemini unavailable / Network failure
    it('Edge Case 9: Gemini unavailable or network failure falls back safely with isTrusted === false', async () => {
      const res = await generateAIResponse(
        '', // Empty key triggers fallback
        ROLEPLAY_SCENARIOS[0],
        'Hello interviewer',
        []
      );

      expect(res.isFallback).toBe(true);
      expect(res.telemetry?.isTrusted).toBe(false);

      // Attempting to ingest untrusted fallback telemetry must be rejected
      const ingestRes = ingestTutorFeedback({
        telemetry: res.telemetry,
        userMessage: 'Hello interviewer',
        turnId: 'turn_untrusted_fallback',
      });
      expect(ingestRes.ingested).toBe(false);
      expect(ingestRes.reason).toBe('untrusted_or_empty_telemetry');
    });

    // Edge Case 10: Large learning history respects prompt budget
    it('Edge Case 10: large learning history strictly satisfies TUTOR_PROMPT_BUDGET.maxChars hard cap', () => {
      // Create 100 mistakes
      const massiveMistakes: Record<string, MistakeRecord> = {};
      for (let i = 1; i <= 100; i++) {
        massiveMistakes[`mb_${i}`] = {
          id: `mb_${i}`,
          word: `word_${i}`,
          source: 'flashcard',
          primaryType: 'spelling',
          meaning: `meaning of word ${i} that is long and detailed`,
          mistakeCount: i,
          consecutiveCorrect: 0,
          resolved: false,
          lastMistakeAt: new Date().toISOString(),
        };
      }

      // Create 50 collocations
      const massiveCollocations: CollocationItem[] = [];
      for (let i = 1; i <= 50; i++) {
        massiveCollocations.push({
          id: `c_${i}`,
          phrase: `collocation phrase number ${i}`,
          meaning: `meaning ${i}`,
          exampleEn: `example ${i}`,
          exampleVi: `ví dụ ${i}`,
          createdAt: new Date().toISOString(),
        });
      }

      const massiveContext = deriveTutorLearningContext({
        mistakeBank: massiveMistakes,
        userCollocations: massiveCollocations,
      });

      const serialized = serializeTutorContextForPrompt(massiveContext);
      expect(serialized.length).toBeLessThanOrEqual(TUTOR_PROMPT_BUDGET.maxChars);

      const targets = extractCandidateTargets(massiveContext);
      expect(targets.length).toBeLessThanOrEqual(20); // MAX_SESSION_CANDIDATE_TARGETS
    });
  });

  // =========================================================================
  // 3. PERSISTENCE & STORAGE SAFETY AUDIT
  // =========================================================================
  describe('3. Persistence & Storage Safety Audit', () => {
    it('ensures all 5 original scenarios are intact and none have mutated IDs or missing properties', () => {
      expect(ROLEPLAY_SCENARIOS).toHaveLength(5);
      const expectedIds = [
        'tech_interview',
        'daily_standup',
        'travel_airport',
        'business_negotiation',
        'ielts_speaking',
      ];

      for (const expectedId of expectedIds) {
        const found = ROLEPLAY_SCENARIOS.find((s) => s.id === expectedId);
        expect(found).toBeDefined();
        expect(found?.title).toBeTruthy();
        expect(found?.role).toBeTruthy();
        expect(found?.aiRole).toBeTruthy();
        expect(found?.systemPrompt).toBeTruthy();
        expect(found?.steps?.length).toBeGreaterThanOrEqual(3);
      }
    });

    it('rehydrates legacy persisted state without crashing and preserves user data integrity', () => {
      // Simulating Zustand rehydration with legacy partial state
      const legacyState = {
        profile: {
          name: 'Legacy User',
          level: 2,
          xp: 250,
          streak: 5,
        },
        mistakeBank: {
          old_word: {
            id: 'old_word',
            word: 'ancient',
            mistakeCount: 2,
            lastMistakeAt: '2026-09-01T00:00:00.000Z',
            consecutiveCorrect: 0,
            resolved: false,
          },
        },
      };

      useAppStore.setState(legacyState as any);

      const derived = getTutorLearningContext();
      expect(derived).toBeDefined();
      expect(derived.hasLearningHistory).toBe(true);
      expect(derived.unresolvedMistakes[0].wordOrPhrase).toBe('ancient');
    });
  });

  // =========================================================================
  describe('4. Release Blocker Audit & Invariant Proof', () => {
    beforeEach(() => {
      clearIngestionHistory();
      useAppStore.setState({
        mistakeBank: {},
        userCollocations: [],
        userCustomWords: [],
        srsProgressMap: {},
        vocabularyList: [],
        recentReviewEvents: [],
        fourSkillsScores: { listening: [], reading: [], speaking: [], writing: [] },
      });
    });

    it('Invariant 1: AI Tutor success / mastery MUST NOT mutate official FSRS/SM-2 scheduling', () => {
      // 1. Setup deep snapshot of an existing SRS card
      const initialSrsCard: SRSProgress = {
        srsLevel: 3,
        interval: 12,
        easeFactor: 2.4,
        nextReviewDate: '2026-10-25T12:00:00.000Z',
        lastReviewedDate: '2026-10-13T12:00:00.000Z',
        firstLearnedAt: '2026-09-01T08:00:00.000Z',
        againCount: 2,
        reviewCount: 8,
        fsrs: {
          stability: 14.5,
          difficulty: 5.2,
          state: 2,
          reps: 8,
          lapses: 2,
          lastReview: '2026-10-13T12:00:00.000Z',
        },
      };

      useAppStore.setState({
        srsProgressMap: {
          w_paradox: { ...initialSrsCard },
        },
        mistakeBank: {
          vocab_paradox: {
            id: 'vocab_paradox',
            word: 'paradox',
            mistakeCount: 3,
            consecutiveCorrect: 0,
            resolved: false,
            primaryType: 'meaning',
            source: 'ai_tutor',
          } as any,
        },
      });

      const beforeSrsSnapshot = structuredClone(useAppStore.getState().srsProgressMap);

      // 2. Process trusted AI Tutor telemetry with masteryDemonstrated=true
      const ingestRes = ingestTutorFeedback({
        telemetry: {
          isTrusted: true,
          masteryDemonstrated: true,
          practicedTargets: ['paradox'],
          detectedMistakes: [],
        },
        userMessage: 'This paradox highlights the contrast between expectations and reality.',
        currentTarget: 'paradox',
        turnId: 'turn_mastery_invariant_1',
      });

      expect(ingestRes.ingested).toBe(true);
      expect(ingestRes.mistakesResolved).toBe(1);

      // Mistake Bank consecutiveCorrect was updated
      const updatedMistake = useAppStore.getState().mistakeBank['vocab_paradox'];
      expect(updatedMistake.consecutiveCorrect).toBe(1);

      // CRITICAL INVARIANT: SRS progress must remain 100% strictly identical
      const afterSrsProgress = useAppStore.getState().srsProgressMap;
      expect(afterSrsProgress).toEqual(beforeSrsSnapshot);
      expect(afterSrsProgress.w_paradox.srsLevel).toBe(3);
      expect(afterSrsProgress.w_paradox.interval).toBe(12);
      expect(afterSrsProgress.w_paradox.nextReviewDate).toBe('2026-10-25T12:00:00.000Z');
      expect(afterSrsProgress.w_paradox.fsrs?.stability).toBe(14.5);
      expect(afterSrsProgress.w_paradox.fsrs?.difficulty).toBe(5.2);
    });

    it('Invariant 1b: AI Tutor detected mistake MUST NOT trigger automatic FSRS lapse or interval penalty', () => {
      const initialSrsCard: SRSProgress = {
        srsLevel: 4,
        interval: 20,
        easeFactor: 2.5,
        nextReviewDate: '2026-11-01T00:00:00.000Z',
        fsrs: {
          stability: 22.0,
          difficulty: 4.8,
          state: 2,
          reps: 10,
          lapses: 0,
          lastReview: '2026-10-12T00:00:00.000Z',
        },
      };

      useAppStore.setState({
        srsProgressMap: {
          w_paradox: { ...initialSrsCard },
        },
      });

      const beforeSrsSnapshot = structuredClone(useAppStore.getState().srsProgressMap);

      // Process detected mistake from AI Tutor
      ingestTutorFeedback({
        telemetry: {
          isTrusted: true,
          masteryDemonstrated: false,
          practicedTargets: ['paradox'],
          detectedMistakes: [
            {
              target: 'paradox',
              type: 'meaning',
              userAnswer: 'paradox means normal situation',
              correction: 'contradictory situation',
              explanation: 'A paradox is a self-contradictory statement.',
            },
          ],
        },
        userMessage: 'I think paradox means a normal situation.',
        currentTarget: 'paradox',
        turnId: 'turn_mistake_no_lapse',
      });

      // Mistake Bank records mistake
      const mistakeRecord = Object.values(useAppStore.getState().mistakeBank).find(
        (m) => m.word.toLowerCase() === 'paradox'
      );
      expect(mistakeRecord).toBeDefined();

      // Official SRS scheduling MUST NOT be penalized
      const afterSrsProgress = useAppStore.getState().srsProgressMap;
      expect(afterSrsProgress).toEqual(beforeSrsSnapshot);
      expect(afterSrsProgress.w_paradox.fsrs?.lapses).toBe(0);
      expect(afterSrsProgress.w_paradox.interval).toBe(20);
    });

    it('Invariant 2: Mistake Bank mastery resolves weakness after repeated usage while SRS schedule remains unchanged', () => {
      // Setup existing mistake record in Mistake Bank and an SRS card with future due date
      useAppStore.setState({
        mistakeBank: {
          grammar_although_vs_despite: {
            id: 'grammar_although_vs_despite',
            word: 'although vs despite',
            primaryType: 'grammar',
            mistakeCount: 2,
            consecutiveCorrect: 0,
            resolved: false,
          } as any,
        },
        srsProgressMap: {
          colloc_despite: {
            srsLevel: 2,
            interval: 6,
            nextReviewDate: '2026-10-18T00:00:00.000Z',
          } as any,
        },
      });

      const beforeSrsSnapshot = structuredClone(useAppStore.getState().srsProgressMap);

      // Turn 1: First correct usage
      ingestTutorFeedback({
        telemetry: {
          isTrusted: true,
          masteryDemonstrated: true,
          practicedTargets: ['although vs despite'],
        },
        userMessage: 'Although the traffic was congested, I arrived punctually.',
        currentTarget: 'although vs despite',
        turnId: 'turn_mastery_t1',
      });

      let mbRecord = useAppStore.getState().mistakeBank['grammar_although_vs_despite'];
      expect(mbRecord.consecutiveCorrect).toBe(1);
      expect(mbRecord.resolved).toBe(false);
      expect(useAppStore.getState().srsProgressMap).toEqual(beforeSrsSnapshot);

      // Turn 2: Second correct usage -> meets threshold consecutiveCorrect >= 2
      ingestTutorFeedback({
        telemetry: {
          isTrusted: true,
          masteryDemonstrated: true,
          practicedTargets: ['although vs despite'],
        },
        userMessage: 'She was enthusiastic despite having a long day at work.',
        currentTarget: 'although vs despite',
        turnId: 'turn_mastery_t2',
      });

      mbRecord = useAppStore.getState().mistakeBank['grammar_although_vs_despite'];
      expect(mbRecord.consecutiveCorrect).toBe(2);
      expect(mbRecord.resolved).toBe(true); // RESOLVED!

      // SRS due date & scheduling remain completely untouched!
      expect(useAppStore.getState().srsProgressMap).toEqual(beforeSrsSnapshot);
      expect(useAppStore.getState().srsProgressMap.colloc_despite.nextReviewDate).toBe('2026-10-18T00:00:00.000Z');
    });

    it('Invariant 3: LRU ingestion cache scope enforces composite session/turn keying and bounded size', () => {
      const telemetry: TutorLearningTelemetry = {
        isTrusted: true,
        detectedMistakes: [
          {
            target: 'paradox',
            type: 'meaning',
            userAnswer: 'paradox',
            explanation: 'Meaning error',
          },
        ],
      };

      // 1. Same AI response / same turn retried -> ignored
      const firstRes = ingestTutorFeedback({
        telemetry,
        userMessage: 'This is a paradox.',
        turnId: 'turn_100',
        sessionId: 'session_alpha',
        userId: 'user_1',
      });
      expect(firstRes.ingested).toBe(true);

      const duplicateRes = ingestTutorFeedback({
        telemetry,
        userMessage: 'This is a paradox.',
        turnId: 'turn_100',
        sessionId: 'session_alpha',
        userId: 'user_1',
      });
      expect(duplicateRes.ingested).toBe(false);
      expect(duplicateRes.reason).toBe('duplicate_turn_ingestion');

      // 2. Next genuine turn with same mistake -> accepted
      const nextTurnRes = ingestTutorFeedback({
        telemetry,
        userMessage: 'This is another paradox.',
        turnId: 'turn_101',
        sessionId: 'session_alpha',
        userId: 'user_1',
      });
      expect(nextTurnRes.ingested).toBe(true);

      // 3. Reset Chat / new session with same relative turn ID -> accepted without collision
      const newSessionRes = ingestTutorFeedback({
        telemetry,
        userMessage: 'This is a paradox.',
        turnId: 'turn_100',
        sessionId: 'session_beta',
        userId: 'user_1',
      });
      expect(newSessionRes.ingested).toBe(true);

      // 4. Scenario switch -> accepted
      const switchScenarioRes = ingestTutorFeedback({
        telemetry,
        userMessage: 'This is a paradox.',
        turnId: 'turn_100',
        sessionId: 'daily_standup',
        userId: 'user_1',
      });
      expect(switchScenarioRes.ingested).toBe(true);

      // 5. Different authenticated user -> accepted
      const newUserRes = ingestTutorFeedback({
        telemetry,
        userMessage: 'This is a paradox.',
        turnId: 'turn_100',
        sessionId: 'session_alpha',
        userId: 'user_2',
      });
      expect(newUserRes.ingested).toBe(true);
    });

    it('Invariant 4: Local Turn Evidence validation accepts pattern variants, rejects model inventions, and enforces local message supremacy', () => {
      // Sub-case 1: Canonical pattern not literal, but actual variant present in user message -> accepted
      const variantRes = ingestTutorFeedback({
        telemetry: {
          isTrusted: true,
          detectedMistakes: [
            {
              target: 'although vs despite',
              type: 'grammar',
              userAnswer: 'despite he was tired',
              correction: 'although he was tired',
              explanation: 'Use although with clause',
            },
          ],
        },
        userMessage: 'Despite he was tired, he kept working diligently on the task.',
        turnId: 'turn_variant_accept',
      });
      expect(variantRes.ingested).toBe(true);
      expect(useAppStore.getState().mistakeBank['grammar_although_vs_despite']).toBeDefined();

      // Sub-case 2: Model-invented unrelated grammar pattern -> rejected
      const hallucinatedRes = ingestTutorFeedback({
        telemetry: {
          isTrusted: true,
          detectedMistakes: [
            {
              target: 'third conditional clauses',
              type: 'grammar',
              userAnswer: 'if he had known',
              explanation: 'Third conditional error',
            },
          ],
        },
        userMessage: 'I love drinking coffee in the morning.',
        turnId: 'turn_hallucination_reject',
      });
      expect(hallucinatedRes.ingested).toBe(false);
      expect(useAppStore.getState().mistakeBank['grammar_third_conditional_clauses']).toBeUndefined();

      // Sub-case 3: Gemini echo differs from actual local message -> local message wins
      const echoRes = ingestTutorFeedback({
        telemetry: {
          isTrusted: true,
          detectedMistakes: [
            {
              target: 'paradox',
              type: 'meaning',
              userAnswer: 'hallucinated model echo',
              explanation: 'Meaning error',
            },
          ],
        },
        userMessage: 'Actual pristine user message mentioning paradox.',
        currentTarget: 'paradox',
        turnId: 'turn_echo_test',
      });
      expect(echoRes.ingested).toBe(true);
      const recorded = Object.values(useAppStore.getState().mistakeBank).find(
        (m) => m.word.toLowerCase() === 'paradox'
      );
      expect(recorded).toBeDefined();
      expect(recorded?.lastUserAnswer).toBe('Actual pristine user message mentioning paradox.');
      expect(recorded?.lastUserAnswer).not.toContain('hallucinated model echo');
    });

    it('Invariant 5: Anti-Self-Reinforcement prevents hallucinated weakness from polluting future prompts', () => {
      // 1. Hallucinated case: Gemini reports weakness on 'quantum physics' when user just greeted
      const halluRes = ingestTutorFeedback({
        telemetry: {
          isTrusted: true,
          detectedMistakes: [
            {
              target: 'quantum physics',
              type: 'meaning',
              userAnswer: 'quantum physics',
            },
          ],
        },
        userMessage: 'Good afternoon, nice to meet you!',
        turnId: 'turn_anti_self_reinforce_1',
      });
      expect(halluRes.ingested).toBe(false);

      // Context and future prompt must NOT contain quantum physics
      const context1 = getTutorLearningContext();
      const prompt1 = buildTutorSystemPrompt(ROLEPLAY_SCENARIOS[0], context1);
      expect(prompt1).not.toContain('quantum physics');

      // 2. Valid case: user really makes error with evidence
      const validRes = ingestTutorFeedback({
        telemetry: {
          isTrusted: true,
          detectedMistakes: [
            {
              target: 'although vs despite',
              type: 'grammar',
              userAnswer: 'despite he was tired',
              correction: 'although he was tired',
              explanation: 'Clause usage error',
            },
          ],
        },
        userMessage: 'Despite he was tired, he came to the office.',
        turnId: 'turn_anti_self_reinforce_2',
      });
      expect(validRes.ingested).toBe(true);

      // Future context now includes the real weakness
      const context2 = getTutorLearningContext();
      const prompt2 = buildTutorSystemPrompt(ROLEPLAY_SCENARIOS[0], context2);
      expect(prompt2).toContain('although vs despite');

      // In neither case was SRS scheduling touched
      expect(Object.keys(useAppStore.getState().srsProgressMap)).toHaveLength(0);
    });
  });
});
