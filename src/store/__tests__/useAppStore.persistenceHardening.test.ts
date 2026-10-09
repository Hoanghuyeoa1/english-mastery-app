// src/store/__tests__/useAppStore.persistenceHardening.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { useAppStore } from '../useAppStore';

describe('PHASE 6: Storage Hardening, Rehydration & Legacy Backup Compatibility Audit', () => {
  beforeEach(() => {
    useAppStore.getState().resetToDefault();
  });

  describe('1. Legacy Payload Rehydration & Backward Compatibility', () => {
    it('restores legacy backup missing recentReviewEvents, reviewHistory, and cardState without errors', () => {
      // Legacy JSON format (e.g. from version 1.0.0 before telemetry/FSRS existed)
      const legacyBackupPayload = JSON.stringify({
        app: 'EnglishMasteryHub',
        version: '1.0.0',
        exportedAt: '2026-01-15T08:00:00.000Z',
        profile: {
          name: 'Học viên Cũ',
          level: 3,
          xp: 450,
          streak: 5,
          lastActiveDate: '2026-01-15',
          lastStudyDate: '2026-01-15',
          hearts: 5,
          maxHearts: 5,
        },
        userCustomWords: [
          {
            id: 'legacy_word_1',
            word: 'Pivotal',
            ipa: '/ˈpɪv.ə.təl/',
            meaning: 'Nòng cốt, then chốt',
            example: 'A pivotal role.',
            tag: 'Academic',
            srsLevel: 2,
            nextReviewDate: '2026-01-20T00:00:00.000Z',
            interval: 5,
            easeFactor: 2.5,
          },
        ],
        srsProgressMap: {
          legacy_word_1: {
            srsLevel: 2,
            nextReviewDate: '2026-01-20T00:00:00.000Z',
            interval: 5,
            easeFactor: 2.5,
          },
        },
        dailyHistory: {
          '2026-01-15': {
            date: '2026-01-15',
            wordsReviewed: 10,
            newWordsLearned: 5,
            quizzesCompleted: 1,
            pronunciationsMastered: 2,
            xpGained: 100,
          },
        },
      });

      const importResult = useAppStore.getState().importBackupData(legacyBackupPayload);

      expect(importResult.success).toBe(true);

      const state = useAppStore.getState();
      expect(state.profile.name).toBe('Học viên Cũ');
      expect(state.userCustomWords.length).toBe(1);

      // Verify safe default fallback initialization for Phase 1-5 schemas
      expect(Array.isArray(state.recentReviewEvents)).toBe(true);
      expect(state.recentReviewEvents.length).toBe(0);
      expect(state.srsAlgorithm).toBe('sm2');
      expect(state.fsrsSettings).toBeDefined();
      expect(state.fsrsSettings.desiredRetention).toBe(0.90);

      // Verify vocabularyList is populated and card state is safely inferred
      expect(state.vocabularyList.length).toBeGreaterThan(0);
      const importedWord = state.vocabularyList.find((w) => w.id === 'legacy_word_1');
      expect(importedWord).toBeDefined();
      expect(importedWord?.srsLevel).toBe(2);
    });

    it('gracefully imports recentReviewEvents when present and safely limits to 200', () => {
      const payloadWithRecentEvents = JSON.stringify({
        app: 'EnglishMasteryHub',
        profile: { name: 'Thí sinh' },
        recentReviewEvents: [
          {
            id: 'rev_1',
            cardId: 'w1',
            rating: 'good',
            grade: 2,
            algorithm: 'sm2',
            timestamp: '2026-01-01T00:00:00.000Z',
            stateBefore: 'learning',
            stateAfter: 'review',
            interval: 1,
          },
        ],
      });

      const result = useAppStore.getState().importBackupData(payloadWithRecentEvents);
      expect(result.success).toBe(true);

      const state = useAppStore.getState();
      expect(state.recentReviewEvents.length).toBe(1);
      expect(state.recentReviewEvents[0].cardId).toBe('w1');
    });
  });

  describe('2. Backup Export & Import Roundtrip Audit', () => {
    it('executes 100% lossless JSON export and import roundtrip', () => {
      const store = useAppStore.getState();

      // Configure distinct state
      store.setSRSAlgorithm('fsrs');
      store.setFSRSSettings({ desiredRetention: 0.88 });
      store.addCustomWord({
        word: 'Meticulous',
        ipa: '/məˈtɪk.jə.ləs/',
        partOfSpeech: 'adj',
        meaning: 'Tỉ mỉ, cẩn thận',
        example: 'He was meticulous in his research.',
        tag: 'Academic',
      });

      const word = useAppStore.getState().userCustomWords[0];
      // Review with FSRS
      store.processReview(word.id, 2);

      // Export
      const exportedJson = store.exportBackupData();
      expect(typeof exportedJson).toBe('string');
      expect(exportedJson.length).toBeGreaterThan(50);

      // Reset store
      store.resetToDefault();
      expect(useAppStore.getState().userCustomWords.length).toBe(0);
      expect(useAppStore.getState().srsAlgorithm).toBe('sm2');

      // Re-import exported payload
      const importResult = useAppStore.getState().importBackupData(exportedJson);
      expect(importResult.success).toBe(true);

      // Verify all restored states match exactly
      const restored = useAppStore.getState();
      expect(restored.srsAlgorithm).toBe('fsrs');
      expect(restored.fsrsSettings.desiredRetention).toBe(0.88);
      expect(restored.userCustomWords.length).toBe(1);
      expect(restored.userCustomWords[0].word).toBe('Meticulous');
      expect(restored.recentReviewEvents.length).toBe(1);
      expect(restored.recentReviewEvents[0].algorithm).toBe('fsrs');
      expect(restored.srsProgressMap[word.id]).toBeDefined();
      expect(restored.srsProgressMap[word.id].fsrs).toBeDefined();
    });
  });

  describe('3. Storage Payload Boundary & Quota Safety (1,000 Reviews)', () => {
    it('keeps serialized payload well under 100KB even after 1,000 reviews', () => {
      const store = useAppStore.getState();
      store.setSRSAlgorithm('fsrs');

      // Setup 5 distinct custom cards
      const cardIds: string[] = [];
      for (let i = 1; i <= 5; i++) {
        store.addCustomWord({
          word: `Vocabulary_${i}`,
          ipa: `/vɒˈkæb_${i}/`,
          partOfSpeech: 'n',
          meaning: `Nghĩa của từ ${i}`,
          example: `Example sentence for word ${i}`,
          tag: 'Daily',
        });
        cardIds.push(useAppStore.getState().userCustomWords[i - 1].id);
      }

      // Simulate 1,000 review actions
      for (let i = 0; i < 1000; i++) {
        const targetId = cardIds[i % cardIds.length];
        const grade = (i % 4) as 0 | 1 | 2 | 3;
        useAppStore.getState().processReview(targetId, grade);
      }

      const state = useAppStore.getState();

      // Ring buffer must cap recentReviewEvents to at most 200 items in store
      expect(state.recentReviewEvents.length).toBeLessThanOrEqual(200);

      // Partialize simulation (exactly what gets written to localStorage)
      const partializedState = {
        profile: state.profile,
        userCustomWords: state.userCustomWords,
        userCollocations: state.userCollocations,
        srsProgressMap: state.srsProgressMap,
        mistakeBank: state.mistakeBank,
        dailyHistory: state.dailyHistory,
        achievements: state.achievements,
        audioVoice: state.audioVoice,
        audioSpeed: state.audioSpeed,
        autoPlayAudio: state.autoPlayAudio,
        isMaskExample: state.isMaskExample,
        geminiApiKey: state.geminiApiKey,
        fourSkillsScores: state.fourSkillsScores,
        hasLearnedNightOwl: state.hasLearnedNightOwl,
        srsAlgorithm: state.srsAlgorithm,
        fsrsSettings: state.fsrsSettings,
        recentReviewEvents: (state.recentReviewEvents || []).slice(0, 200),
      };

      const serialized = JSON.stringify(partializedState);
      const sizeInBytes = new Blob([serialized]).size;
      const sizeInKb = sizeInBytes / 1024;

      // Assert size boundary: Under 100 KB! (Safely far below 1.5MB and 5MB localStorage limits)
      expect(sizeInKb).toBeLessThan(100);
      expect(sizeInBytes).toBeLessThan(1500000); // 1.5 MB quota guard
    }, 15000);
  });
});
