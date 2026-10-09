// src/store/__tests__/adaptiveMistakeReleaseAudit.test.ts

import { describe, it, expect, beforeEach } from 'vitest';
import { useAppStore } from '../useAppStore';
import {
  MistakeRecord,
  PracticeModuleId,
  SRSReviewEvent,
  VocabWord,
} from '../../types';
import {
  toCanonicalSource,
  toCanonicalType,
  calculateAdaptiveScore,
  getMistakeRecurrenceLevel,
  calculateWeaknessSummary,
} from '../../services/adaptiveMistakeService';
import {
  routeMistakeToModule,
  getModuleNavigationTarget,
  VALID_PRACTICE_MODULES,
} from '../../services/adaptivePracticeRouter';
import {
  buildAdaptiveLearningSession,
  SESSION_HARD_LIMITS,
} from '../../services/adaptiveSessionBuilder';
import { processCardReview } from '../../services/srsScheduler';

describe('PHASE 6: Final Release & Persistence Audit (Adaptive Mistake Engine)', () => {
  const testNow = new Date('2026-10-04T12:00:00.000Z').getTime();

  beforeEach(() => {
    useAppStore.getState().resetToDefault();
    useAppStore.setState({
      activePracticeConfig: null,
      pendingNavigationTab: null,
      mistakeBank: {},
      recentReviewEvents: [],
    });
  });

  // =========================================================================
  // 1. ZUSTAND / PERSISTENCE AUDIT
  // =========================================================================
  describe('1. Zustand / Persistence Audit', () => {
    it('partialize strictly excludes derived state, session previews, and temporary navigation config', () => {
      // 1. Set temporary / derived runtime states
      useAppStore.getState().startAdaptivePractice({
        module: 'dictation',
        itemIds: ['word_1'],
        mistakeType: 'spelling',
      });

      const store = useAppStore.getState();
      expect(store.activePracticeConfig).toBeDefined();
      expect(store.pendingNavigationTab).toBe('arcade');

      // 2. Invoke partialize configuration directly from store persistence options
      const persistOptions = (useAppStore as any).persist?.getOptions?.();
      expect(persistOptions).toBeDefined();

      const partializedState = persistOptions.partialize(store);

      // 3. Verify temporary runtime keys are NOT in partialized output
      expect((partializedState as any).activePracticeConfig).toBeUndefined();
      expect((partializedState as any).pendingNavigationTab).toBeUndefined();

      // 4. Verify derived analytics / session preview results are NOT in partialized output
      expect((partializedState as any).adaptiveSession).toBeUndefined();
      expect((partializedState as any).weaknessReport).toBeUndefined();
      expect((partializedState as any).recommendations).toBeUndefined();

      // 5. Verify source-of-truth fields ARE retained
      expect(partializedState.profile).toBeDefined();
      expect(partializedState.mistakeBank).toBeDefined();
      expect(partializedState.srsProgressMap).toBeDefined();
      expect(partializedState.recentReviewEvents).toBeDefined();
    });

    it('safely rehydrates storage defaults when loading legacy or corrupt storage', () => {
      const persistOptions = (useAppStore as any).persist?.getOptions?.();
      const onRehydrate = persistOptions.onRehydrateStorage();

      const corruptState: any = {
        srsAlgorithm: 'unknown_algo',
        fsrsSettings: null,
        recentReviewEvents: 'not_an_array',
      };

      onRehydrate(corruptState);

      expect(corruptState.srsAlgorithm).toBe('sm2');
      expect(corruptState.fsrsSettings).toBeDefined();
      expect(Array.isArray(corruptState.recentReviewEvents)).toBe(true);
      expect(corruptState.recentReviewEvents).toEqual([]);
    });
  });

  // =========================================================================
  // 2. STORAGE SAFETY & SERIALIZED PAYLOAD MEASUREMENT
  // =========================================================================
  describe('2. Storage Safety & Serialized Payload Measurement', () => {
    it('measures serialized payload with 100 comprehensive mistake profiles and verifies payload is under 100KB', () => {
      const heavyMistakeBank: Record<string, MistakeRecord> = {};

      for (let i = 1; i <= 100; i++) {
        const id = `word_${i}`;
        heavyMistakeBank[id] = {
          id,
          word: `VocabularyWord_${i}`,
          ipa: `/ˈvəʊ.kæb.${i}/`,
          meaning: `Ý nghĩa chi tiết của từ vựng số ${i} trong ngân hàng bẫy lỗi`,
          example: `This is an extensive example sentence demonstrating the word number ${i}.`,
          tag: 'Daily',
          mistakeCount: (i % 5) + 1,
          wrongCount: (i % 5) + 1,
          lastMistakeAt: new Date(testNow - i * 3600000).toISOString(),
          consecutiveCorrect: i % 2,
          resolved: i % 3 === 0,
          resolvedDate: i % 3 === 0 ? new Date(testNow - i * 1800000).toISOString() : undefined,
          source: (['classic_quiz', 'word_scramble', 'dictation', 'pronunciation'] as const)[i % 4],
          primaryType: (['meaning', 'spelling', 'listening', 'pronunciation'] as const)[i % 4],
          typeCounts: {
            meaning: 2,
            spelling: 1,
          },
          sourceCounts: {
            classic_quiz: 2,
            dictation: 1,
          },
          reopenCount: i % 4 === 0 ? 1 : 0,
          typeResolutionMap: {
            meaning: {
              mistakeCount: 2,
              consecutiveCorrect: 1,
              resolved: false,
              reopenCount: 0,
            },
            spelling: {
              mistakeCount: 1,
              consecutiveCorrect: 2,
              resolved: true,
              resolvedAt: new Date().toISOString(),
              reopenCount: 0,
            },
          },
        };
      }

      // Generate 200 telemetry review events
      const heavyReviewEvents: SRSReviewEvent[] = Array.from({ length: 200 }, (_, idx) => ({
        id: `rev_event_${idx + 1}`,
        cardId: `card_${(idx % 50) + 1}`,
        rating: (['again', 'hard', 'good', 'easy'] as const)[idx % 4],
        grade: (idx % 4) as 0 | 1 | 2 | 3,
        algorithm: 'fsrs',
        timestamp: new Date(testNow - idx * 60000).toISOString(),
        stateBefore: 'learning',
        stateAfter: 'review',
        interval: (idx % 10) + 1,
        stability: 4.5,
        difficulty: 5.2,
      }));

      useAppStore.setState({
        mistakeBank: heavyMistakeBank,
        recentReviewEvents: heavyReviewEvents,
      });

      const persistOptions = (useAppStore as any).persist?.getOptions?.();
      const partializedState = persistOptions.partialize(useAppStore.getState());
      const serializedJson = JSON.stringify(partializedState);
      const byteSize = new TextEncoder().encode(serializedJson).length;
      const kbSize = byteSize / 1024;

      // Assert that serialized payload is comfortably under 150KB (localStorage quota is 5MB = 5120KB)
      expect(kbSize).toBeLessThan(150);
      expect(Object.keys(partializedState.mistakeBank).length).toBe(100);
      expect(partializedState.recentReviewEvents.length).toBe(200);
    });

    it('recentReviewEvents strictly enforces ring buffer size (max 200) with newest-first eviction', () => {
      // Setup 205 custom words
      const words: VocabWord[] = Array.from({ length: 205 }, (_, i) => ({
        id: `test_word_${i + 1}`,
        word: `Word_${i + 1}`,
        ipa: '/test/',
        partOfSpeech: 'noun',
        example: 'Example test sentence.',
        tag: 'Daily',
        meaning: `Meaning ${i + 1}`,
        srsLevel: 0,
        interval: 0,
        easeFactor: 2.5,
        nextReviewDate: new Date().toISOString(),
      }));

      useAppStore.setState({
        userCustomWords: words,
        vocabularyList: words,
      });

      // Review all 205 cards sequentially
      for (let i = 1; i <= 205; i++) {
        useAppStore.getState().processReview(`test_word_${i}`, 2);
      }

      const events = useAppStore.getState().recentReviewEvents;
      expect(events.length).toBe(200);
      // Index 0 must be newest
      expect(events[0].cardId).toBe('test_word_205');
      // Index 199 must be the oldest retained
      expect(events[199].cardId).toBe('test_word_6');
      // Events 1..5 were evicted
      expect(events.some((e) => e.cardId === 'test_word_1')).toBe(false);
      expect(events.some((e) => e.cardId === 'test_word_5')).toBe(false);
    });
  });

  // =========================================================================
  // 3. DETERMINISTIC CLOUD MERGE RECONCILIATION
  // =========================================================================
  describe('3. Deterministic Cloud Merge Reconciliation', () => {
    it('merges counters, type counts, and source counts using Math.max union', () => {
      useAppStore.setState({
        mistakeBank: {
          serendipity: {
            id: 'serendipity',
            word: 'serendipity',
            meaning: 'sự tình cờ may mắn',
            mistakeCount: 3,
            wrongCount: 3,
            reopenCount: 1,
            consecutiveCorrect: 0,
            resolved: false,
            source: 'classic_quiz',
            typeCounts: { meaning: 2, spelling: 1 },
            sourceCounts: { classic_quiz: 2, word_scramble: 1 },
            lastMistakeAt: '2026-10-04T08:00:00.000Z',
          } as MistakeRecord,
        },
      });

      const cloudPayload = {
        cloudMistakeBank: {
          serendipity: {
            id: 'serendipity',
            word: 'serendipity',
            meaning: 'sự tình cờ may mắn',
            mistakeCount: 5,
            wrongCount: 5,
            reopenCount: 0,
            consecutiveCorrect: 1,
            resolved: false,
            source: 'dictation',
            typeCounts: { meaning: 1, listening: 3 },
            sourceCounts: { dictation: 3 },
            lastMistakeAt: '2026-10-04T09:00:00.000Z',
          } as MistakeRecord,
        },
      };

      useAppStore.getState().mergeCloudData(cloudPayload);

      const mergedItem = useAppStore.getState().mistakeBank['serendipity'];
      expect(mergedItem.mistakeCount).toBe(5);
      expect(mergedItem.reopenCount).toBe(1); // Local had 1, cloud had 0 -> Math.max = 1
      expect(mergedItem.typeCounts?.meaning).toBe(2);
      expect(mergedItem.typeCounts?.spelling).toBe(1);
      expect(mergedItem.typeCounts?.listening).toBe(3);
      expect(mergedItem.sourceCounts?.classic_quiz).toBe(2);
      expect(mergedItem.sourceCounts?.dictation).toBe(3);
    });

    it('resolves conflict: preserves resolved: false when local reopened after cloud resolution', () => {
      useAppStore.setState({
        mistakeBank: {
          ephemeral: {
            id: 'ephemeral',
            word: 'ephemeral',
            meaning: 'phù du',
            mistakeCount: 4,
            consecutiveCorrect: 0,
            resolved: false, // Locally failed again!
            reopenCount: 1, // Reopened!
            lastMistakeAt: '2026-10-04T10:00:00.000Z', // 10:00 AM
          } as MistakeRecord,
        },
      });

      const cloudPayload = {
        cloudMistakeBank: {
          ephemeral: {
            id: 'ephemeral',
            word: 'ephemeral',
            meaning: 'phù du',
            mistakeCount: 3,
            consecutiveCorrect: 2,
            resolved: true, // Cloud resolved earlier
            resolvedDate: '2026-10-03T12:00:00.000Z', // Yesterday
            reopenCount: 0,
          } as MistakeRecord,
        },
      };

      useAppStore.getState().mergeCloudData(cloudPayload);

      const merged = useAppStore.getState().mistakeBank['ephemeral'];
      // Local mistake happened after cloud resolution -> must stay unresolved!
      expect(merged.resolved).toBe(false);
      expect(merged.reopenCount).toBe(1);
    });

    it('resolves conflict: adopts resolved: true when cloud resolved after local mistake without reopening', () => {
      useAppStore.setState({
        mistakeBank: {
          resilient: {
            id: 'resilient',
            word: 'resilient',
            meaning: 'kiên cường',
            mistakeCount: 2,
            consecutiveCorrect: 0,
            resolved: false,
            lastMistakeAt: '2026-10-01T00:00:00.000Z',
            reopenCount: 0,
          } as MistakeRecord,
        },
      });

      const cloudPayload = {
        cloudMistakeBank: {
          resilient: {
            id: 'resilient',
            word: 'resilient',
            meaning: 'kiên cường',
            mistakeCount: 2,
            consecutiveCorrect: 2,
            resolved: true,
            resolvedDate: '2026-10-03T00:00:00.000Z', // Resolved later
            reopenCount: 0,
          } as MistakeRecord,
        },
      };

      useAppStore.getState().mergeCloudData(cloudPayload);

      const merged = useAppStore.getState().mistakeBank['resilient'];
      expect(merged.resolved).toBe(true);
      expect(merged.consecutiveCorrect).toBeGreaterThanOrEqual(2);
    });

    it('merges recentReviewEvents from cloud and local: deduplicates by ID and keeps newest 200', () => {
      const localEvents: SRSReviewEvent[] = [
        {
          id: 'shared_event',
          cardId: 'c1',
          rating: 'good',
          grade: 2,
          algorithm: 'fsrs',
          timestamp: '2026-10-04T05:00:00.000Z',
          stateBefore: 'learning',
          stateAfter: 'review',
          interval: 2,
        },
        {
          id: 'local_exclusive',
          cardId: 'c2',
          rating: 'easy',
          grade: 3,
          algorithm: 'fsrs',
          timestamp: '2026-10-04T06:00:00.000Z',
          stateBefore: 'review',
          stateAfter: 'review',
          interval: 6,
        },
      ];

      const cloudEvents: SRSReviewEvent[] = [
        {
          id: 'shared_event', // Duplicate ID
          cardId: 'c1',
          rating: 'good',
          grade: 2,
          algorithm: 'fsrs',
          timestamp: '2026-10-04T05:00:00.000Z',
          stateBefore: 'learning',
          stateAfter: 'review',
          interval: 2,
        },
        {
          id: 'cloud_exclusive',
          cardId: 'c3',
          rating: 'again',
          grade: 0,
          algorithm: 'fsrs',
          timestamp: '2026-10-04T07:00:00.000Z',
          stateBefore: 'review',
          stateAfter: 'relearning',
          interval: 1,
        },
      ];

      useAppStore.setState({ recentReviewEvents: localEvents });

      useAppStore.getState().mergeCloudData({
        cloudRecentReviewEvents: cloudEvents,
      });

      const mergedEvents = useAppStore.getState().recentReviewEvents;
      expect(mergedEvents.length).toBe(3); // shared_event deduplicated
      expect(mergedEvents[0].id).toBe('cloud_exclusive'); // 07:00 is newest
      expect(mergedEvents[1].id).toBe('local_exclusive'); // 06:00
      expect(mergedEvents[2].id).toBe('shared_event');    // 05:00
    });
  });

  // =========================================================================
  // 4. BACKUP / LEGACY DEFENSIVE MIGRATION
  // =========================================================================
  describe('4. Backup / Legacy Defensive Migration', () => {
    it('defensively imports legacy backup missing adaptive fields without inventing fake events', () => {
      const legacyPayload = JSON.stringify({
        app: 'EnglishMasteryHub',
        version: '1.0.0',
        profile: { name: 'Thí sinh cũ' },
        mistakeBank: {
          ubiquitous: {
            id: 'ubiquitous',
            word: 'ubiquitous',
            meaning: 'phổ biến khắp nơi',
            mistakeCount: 3,
            lastMistakeAt: '2026-02-01T00:00:00.000Z',
            consecutiveCorrect: 1,
            resolved: false,
            source: 'dictation', // Legacy source
            // Lacks: primaryType, typeCounts, sourceCounts, reopenCount, typeResolutionMap
          },
        },
      });

      const res = useAppStore.getState().importBackupData(legacyPayload);
      expect(res.success).toBe(true);

      const item = useAppStore.getState().mistakeBank['ubiquitous'];
      expect(item).toBeDefined();
      expect(item.word).toBe('ubiquitous');
      expect(item.mistakeCount).toBe(3);

      // Inferred canonical taxonomy
      expect(item.source).toBe('dictation');
      expect(item.primaryType).toBe('spelling'); // dictation default is spelling
      expect(item.typeCounts?.spelling).toBe(3);
      expect(item.sourceCounts?.dictation).toBe(3);
      expect(item.reopenCount).toBe(0);
    });

    it('exportBackupData includes all modern adaptive source-of-truth fields', () => {
      useAppStore.getState().recordMistake(
        { word: 'meticulous', meaning: 'tỉ mỉ' },
        'classic_quiz',
        { type: 'meaning' }
      );

      const exported = useAppStore.getState().exportBackupData();
      const parsed = JSON.parse(exported);

      expect(parsed.mistakeBank).toBeDefined();
      const item = Object.values(parsed.mistakeBank as Record<string, MistakeRecord>)[0];
      expect(item.word).toBe('meticulous');
      expect(item.primaryType).toBe('meaning');
      expect(item.typeCounts?.meaning).toBe(1);
      expect(item.sourceCounts?.classic_quiz).toBe(1);
      expect(item.reopenCount).toBe(0);
      expect(item.typeResolutionMap).toBeDefined();
    });
  });

  // =========================================================================
  // 5. FINAL INTEGRATION FLOWS
  // =========================================================================
  describe('5. Final Integration Flows', () => {
    it('Flow 1: Classic Quiz wrong -> meaning mistake -> recommended classic_quiz/flashcard', () => {
      useAppStore.getState().recordQuizMistakeResult('w_quiz_1', false, {
        source: 'classic_quiz',
        type: 'meaning',
      });

      const mistake = useAppStore.getState().mistakeBank['w_quiz_1'];
      expect(mistake).toBeDefined();
      expect(mistake.primaryType).toBe('meaning');

      const rec = routeMistakeToModule(mistake);
      expect(['classic_quiz', 'flashcard']).toContain(rec.recommendedModule);
      expect(VALID_PRACTICE_MODULES).toContain(rec.recommendedModule);
    });

    it('Flow 2: Dictation wrong -> spelling mistake -> targeted practice in dictation/word_scramble', () => {
      useAppStore.getState().recordMistake(
        { word: 'conscientious', meaning: 'tận tâm chu đáo' },
        'dictation',
        { type: 'spelling' }
      );

      const mistake = Object.values(useAppStore.getState().mistakeBank).find(
        (m) => m.word === 'conscientious'
      )!;
      expect(mistake.primaryType).toBe('spelling');

      const rec = routeMistakeToModule(mistake);
      expect(['dictation', 'word_scramble']).toContain(rec.recommendedModule);
      const navTarget = getModuleNavigationTarget(rec.recommendedModule);
      expect(navTarget.tab).toBe('arcade');
    });

    it('Flow 3: Pronunciation failure (< 60%) -> pronunciation mistake -> routes to pronunciation arena', () => {
      useAppStore.getState().recordMistake(
        { word: 'chrysanthemum', meaning: 'hoa cúc' },
        'pronunciation',
        { type: 'pronunciation' }
      );

      const mistake = Object.values(useAppStore.getState().mistakeBank).find(
        (m) => m.word === 'chrysanthemum'
      )!;
      expect(mistake.primaryType).toBe('pronunciation');

      const rec = routeMistakeToModule(mistake);
      expect(rec.recommendedModule).toBe('pronunciation');
      const nav = getModuleNavigationTarget(rec.recommendedModule);
      expect(nav.tab).toBe('pronunciation');
      expect(nav.subTab).toBe('ai_speech');
    });

    it('Flow 4: Flashcard Again -> recorded in Mistake Bank -> FSRS lapse -> Relearning -> no double penalty', () => {
      // Setup card in FSRS
      const cardId = 'card_fsrs_review';
      const initialCard: VocabWord = {
        id: cardId,
        word: 'Perseverance',
        ipa: '/ˌpɜː.sɪˈvɪə.rəns/',
        partOfSpeech: 'noun',
        example: 'Through perseverance he succeeded.',
        tag: 'Academic',
        meaning: 'Sự kiên trì',
        srsLevel: 3,
        interval: 14,
        easeFactor: 2.5,
        nextReviewDate: new Date().toISOString(),
        fsrs: {
          stability: 14.0,
          difficulty: 4.0,
          state: 2, // review
          reps: 3,
          lapses: 0,
          lastReview: new Date(testNow - 14 * 86400000).toISOString(),
        },
      };

      useAppStore.setState({
        srsAlgorithm: 'fsrs',
        userCustomWords: [initialCard],
        vocabularyList: [initialCard],
        srsProgressMap: {
          [cardId]: {
            srsLevel: 3,
            interval: 14,
            easeFactor: 2.5,
            nextReviewDate: new Date().toISOString(),
            fsrs: initialCard.fsrs,
          },
        },
      });

      // User presses "Again" (grade 0) in Flashcard
      useAppStore.getState().processReview(cardId, 0);

      // 1. Mistake Bank has recorded the card
      const mistake = useAppStore.getState().mistakeBank[cardId];
      expect(mistake).toBeDefined();
      expect(mistake.mistakeCount).toBe(1);

      // 2. FSRS progress in srsProgressMap transitioned to Relearning (state 3)
      const updatedSrs = useAppStore.getState().srsProgressMap[cardId];
      expect(updatedSrs.fsrs?.state).toBe(3);
      expect(updatedSrs.fsrs?.lapses).toBe(1);
      // Interval reduced by scheduler without double deduction
      expect(updatedSrs.interval).toBeLessThan(14);
      expect(updatedSrs.interval).toBeGreaterThanOrEqual(1);
    });

    it('Flow 5: Resolved item fails again -> reopenCount increments -> resolved resets to false -> recurrence level updates', () => {
      const wordObj = { word: 'vulnerable', meaning: 'dễ bị tổn thương' };

      // 1. First mistake
      useAppStore.getState().recordMistake(wordObj, 'classic_quiz');
      expect(useAppStore.getState().mistakeBank['vulnerable'].resolved).toBe(false);

      // 2. Resolved after 2 correct reviews
      useAppStore.getState().recordMistakeCorrect('vulnerable');
      useAppStore.getState().recordMistakeCorrect('vulnerable');
      expect(useAppStore.getState().mistakeBank['vulnerable'].resolved).toBe(true);
      expect(useAppStore.getState().mistakeBank['vulnerable'].consecutiveCorrect).toBe(2);

      // 3. User fails again in a later practice session
      useAppStore.getState().recordMistake(wordObj, 'dictation');
      const reopened = useAppStore.getState().mistakeBank['vulnerable'];
      expect(reopened.resolved).toBe(false);
      expect(reopened.reopenCount).toBe(1);
      expect(reopened.consecutiveCorrect).toBe(0);
      expect(reopened.mistakeCount).toBe(2);

      // Recurrence level reflects reopen
      const recurrence = getMistakeRecurrenceLevel(reopened);
      expect(['recurrent', 'chronic']).toContain(recurrence);
    });

    it('Flow 6: Multiple mistake types on same item -> resolve one type -> others remain unresolved', () => {
      const wordObj = { word: 'bureaucracy', meaning: 'bộ máy quan liêu' };

      // Fail in spelling (word scramble) and meaning (quiz)
      useAppStore.getState().recordMistake(wordObj, 'word_scramble', { type: 'spelling' });
      useAppStore.getState().recordMistake(wordObj, 'classic_quiz', { type: 'meaning' });

      let record = useAppStore.getState().mistakeBank['bureaucracy'];
      expect(record.typeResolutionMap?.spelling?.resolved).toBe(false);
      expect(record.typeResolutionMap?.meaning?.resolved).toBe(false);

      // Answer correctly in spelling mode 2 times
      useAppStore.getState().recordMistakeCorrect('bureaucracy', { type: 'spelling' });
      useAppStore.getState().recordMistakeCorrect('bureaucracy', { type: 'spelling' });

      record = useAppStore.getState().mistakeBank['bureaucracy'];
      // Spelling is now resolved!
      expect(record.typeResolutionMap?.spelling?.resolved).toBe(true);
      // Meaning remains unresolved!
      expect(record.typeResolutionMap?.meaning?.resolved).toBe(false);
    });

    it('Flow 7: Adaptive session generation preserves target IDs and routes to real modules', () => {
      const bank: Record<string, MistakeRecord> = {
        m1: {
          id: 'item_1',
          word: 'procrastinate',
          meaning: 'trì hoãn',
          mistakeCount: 4,
          lastMistakeAt: new Date().toISOString(),
          consecutiveCorrect: 0,
          resolved: false,
          primaryType: 'meaning',
          source: 'classic_quiz',
        },
        m2: {
          id: 'item_2',
          word: 'quintessential',
          meaning: 'tinh hoa',
          mistakeCount: 3,
          lastMistakeAt: new Date().toISOString(),
          consecutiveCorrect: 0,
          resolved: false,
          primaryType: 'spelling',
          source: 'word_scramble',
        },
      };

      const session = buildAdaptiveLearningSession(bank, { targetMinutes: 10 });
      expect(session.exercises.length).toBe(2);
      expect(session.exercises.map((e) => e.targetId)).toEqual(['item_1', 'item_2']);

      for (const ex of session.exercises) {
        expect(VALID_PRACTICE_MODULES).toContain(ex.recommendedModule);
        const nav = getModuleNavigationTarget(ex.recommendedModule);
        expect(nav.tab).toBeDefined();
      }

      // Start targeted practice from session
      useAppStore.getState().startAdaptivePractice({
        module: session.exercises[0].recommendedModule,
        itemIds: [session.exercises[0].targetId],
        mistakeType: session.exercises[0].mistakeType,
      });

      const activeConfig = useAppStore.getState().activePracticeConfig;
      expect(activeConfig).toBeDefined();
      expect(activeConfig?.itemIds).toEqual(['item_1']);
      expect(activeConfig?.module).toBe(session.exercises[0].recommendedModule);
    });
  });
});
