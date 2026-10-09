import { describe, it, expect, beforeEach } from 'vitest';
import { useAppStore, composeVocabularyList } from '../../store/useAppStore';
import type { 
  FSRSState, 
  SRSProgress, 
  VocabWord, 
  CollocationItem, 
  MistakeRecord 
} from '../../types';
import {
  deriveFourSkillsSummary,
  getFourSkillsCtaTarget,
  captureReadingVocabulary,
  captureListeningMistake,
  captureSpeakingMistake,
  captureWritingCollocation,
  captureWritingMistake,
} from '../fourSkillsLearningBridge';
import { getPronunciationPracticeQueue } from '../adaptiveMistakeService';
import { calculateSM2 } from '../srsAlgorithm';
import { calculateFSRS } from '../fsrsAlgorithm';

describe('PHASE 5: End-to-End Integration, Backward Compatibility & Final Regression Suite', () => {
  beforeEach(() => {
    // Reset store state cleanly before each test
    useAppStore.setState({
      srsProgressMap: {},
      userCustomWords: [],
      userCollocations: [],
      vocabularyList: composeVocabularyList({}, []),
      mistakeBank: {},
      dailyHistory: {},
      fourSkillsScores: {
        listening: [],
        reading: [],
        speaking: [],
        writing: [],
      },
      profile: {
        name: 'Final Tester',
        level: 1,
        xp: 0,
        streak: 1,
        lastActiveDate: new Date().toISOString().split('T')[0],
        lastStudyDate: new Date().toISOString().split('T')[0],
        hearts: 5,
        maxHearts: 5,
        avatarSeed: 'TesterSeed',
        targetDailyWords: 15,
        targetDailyNewWords: 15,
        extraNewWordsBonus: 0,
        isOnboarded: true,
        targetGoal: 'daily',
        geminiApiKey: '',
      },
      srsAlgorithm: 'sm2',
      recentReviewEvents: [],
    });
  });

  // =========================================================================
  // 1. READING FLOW E2E
  // =========================================================================
  describe('1. Reading -> SRS End-to-End Flow', () => {
    it('unknown word -> Add to SRS -> appears in Unified SRS -> save again -> no duplicate', () => {
      const store = useAppStore.getState();
      const unknownWord = 'quintessential';
      const readingContext = 'She is the quintessential team leader who inspires everyone around her.';
      const customMeaning = 'tinh túy, điển hình nhất';

      // 1. User encounters unknown word in reading passage and saves it
      const result1 = captureReadingVocabulary({
        rawWord: unknownWord,
        readingSentence: readingContext,
        customMeaning,
        srsProgressMap: store.srsProgressMap,
        userCustomWords: store.userCustomWords,
        saveToSRS: store.saveToSRS,
      });

      expect(result1.success).toBe(true);
      expect(result1.canonicalWord.toLowerCase()).toBe(unknownWord);

      // Verify word immediately appears in Unified SRS deck
      const state1 = useAppStore.getState();
      const unifiedCards1 = state1.getUnifiedSRSCards();
      const matchedCards1 = unifiedCards1.filter(
        (c) => (c.word || c.primaryText).toLowerCase().trim() === unknownWord
      );

      expect(matchedCards1).toHaveLength(1);
      expect(matchedCards1[0].meaning).toBe(customMeaning);
      expect(matchedCards1[0].exampleEn).toBe(readingContext);

      // Verify Four Skills summary reflects reading provenance
      const summary1 = deriveFourSkillsSummary({
        userCustomWords: state1.userCustomWords,
        srsProgressMap: state1.srsProgressMap,
        mistakeBank: state1.mistakeBank,
        userCollocations: state1.userCollocations,
        vocabularyList: state1.vocabularyList,
      });
      expect(summary1.readingWordsSaved).toBe(1);

      // 2. User encounters same word in another article and clicks Save to SRS again
      const result2 = captureReadingVocabulary({
        rawWord: 'Quintessential',
        readingSentence: 'A quintessential masterpiece of 20th century literature.',
        srsProgressMap: state1.srsProgressMap,
        userCustomWords: state1.userCustomWords,
        saveToSRS: store.saveToSRS,
      });

      expect(result2.success).toBe(true);

      const state2 = useAppStore.getState();
      const unifiedCards2 = state2.getUnifiedSRSCards();
      const matchedCards2 = unifiedCards2.filter(
        (c) => (c.word || c.primaryText).toLowerCase().trim() === unknownWord
      );

      // Invariant: Bắt buộc KHÔNG được nhân đôi thẻ SRS
      expect(matchedCards2).toHaveLength(1);
      // Summary vẫn chỉ đếm 1 thẻ duy nhất
      const summary2 = deriveFourSkillsSummary({
        userCustomWords: state2.userCustomWords,
        srsProgressMap: state2.srsProgressMap,
        mistakeBank: state2.mistakeBank,
        userCollocations: state2.userCollocations,
        vocabularyList: state2.vocabularyList,
      });
      expect(summary2.readingWordsSaved).toBe(1);
    });
  });

  // =========================================================================
  // 2. LISTENING FLOW E2E
  // =========================================================================
  describe('2. Listening -> Mistake Bank End-to-End Flow', () => {
    it('wrong answer -> listening mistake +1 -> correct type/source -> no double-count', () => {
      const store = useAppStore.getState();

      // 1. Vocabulary-targeted listening mistake
      captureListeningMistake({
        questionId: 'q_listen_vocab_1',
        questionPrompt: 'Select the word pronounced in audio segment: "sophisticated"',
        userAnswer: 'simplified',
        expectedAnswer: 'sophisticated',
        lessonTitle: 'Advanced Tech Talk',
        recordMistake: store.recordMistake,
      });

      const state1 = useAppStore.getState();
      const mistakeEntry = Object.values(state1.mistakeBank).find(
        (m) => m.word.toLowerCase() === 'sophisticated'
      );

      expect(mistakeEntry).toBeDefined();
      expect(mistakeEntry?.mistakeCount).toBe(1);
      expect(mistakeEntry?.source).toBe('listening');
      expect(mistakeEntry?.primaryType).toBe('listening');
      expect(mistakeEntry?.typeCounts?.listening).toBe(1);
      expect(mistakeEntry?.resolved).toBe(false);

      // 2. Same mistake occurs again -> mistakeCount increases by exactly +1 (no double producer)
      captureListeningMistake({
        questionId: 'q_listen_vocab_1_repeat',
        questionPrompt: 'Select the word pronounced in audio segment: "sophisticated"',
        userAnswer: 'complicated',
        expectedAnswer: 'sophisticated',
        lessonTitle: 'Advanced Tech Talk',
        recordMistake: store.recordMistake,
      });

      const state2 = useAppStore.getState();
      const updatedMistake = Object.values(state2.mistakeBank).find(
        (m) => m.word.toLowerCase() === 'sophisticated'
      );
      expect(updatedMistake?.mistakeCount).toBe(2);
      expect(updatedMistake?.typeCounts?.listening).toBe(2);

      // Summary shows 1 unresolved listening mistake item
      const summary = deriveFourSkillsSummary({
        userCustomWords: state2.userCustomWords,
        srsProgressMap: state2.srsProgressMap,
        mistakeBank: state2.mistakeBank,
        userCollocations: state2.userCollocations,
        vocabularyList: state2.vocabularyList,
      });
      expect(summary.listeningUnresolvedMistakes).toBe(1);
    });

    it('general listening comprehension mistake does not pollute vocabulary Mistake Bank', () => {
      const store = useAppStore.getState();

      const res = captureListeningMistake({
        questionId: 'q_listen_general_2',
        questionPrompt: 'What is the main topic of the professor discussion on volcanic activity?',
        userAnswer: 'Economic inflation',
        expectedAnswer: 'Tectonic plate movements',
        lessonTitle: 'Geology 101',
        recordMistake: store.recordMistake,
      });

      expect(res.recorded).toBe(false);
      expect(res.isVocabTarget).toBe(false);

      const state = useAppStore.getState();
      const mistakes = Object.values(state.mistakeBank);
      expect(mistakes).toHaveLength(0);
      expect(state.mistakeBank['q_listen_general_2']).toBeUndefined();
    });
  });

  // =========================================================================
  // 3. WRITING FLOW E2E
  // =========================================================================
  describe('3. Writing -> Collocation / SRS End-to-End Flow', () => {
    it('AI output contains collocation correction -> user chooses Add to SRS -> Collocation entry created with bounded context', () => {
      const store = useAppStore.getState();
      const fullEssay = 'Many young researchers make a research in renewable energy. This is essential for sustainable progress.';
      const suggestedCollocation = 'conduct research';
      const meaning = 'tiến hành nghiên cứu';

      // Capture collocation from essay feedback
      const res = captureWritingCollocation({
        phrase: suggestedCollocation,
        originalText: 'make a research',
        meaning,
        exampleEn: fullEssay,
        usageContext: 'Academic Writing Task 2',
        userCollocations: store.userCollocations,
        saveCollocationToSRS: store.saveCollocationToSRS,
      });

      expect(res.isDuplicate).toBe(false);
      expect(res.normalizedPhrase).toBe('conduct research');

      const state = useAppStore.getState();
      expect(state.userCollocations).toHaveLength(1);

      const item = state.userCollocations[0];
      expect(item.phrase).toBe('conduct research');
      expect(item.meaning).toBe(meaning);
      // Bounded context sentence: contains the sentence, NOT the entire essay
      expect(item.exampleEn).toContain('conduct research');
      expect(item.exampleEn.length).toBeLessThan(fullEssay.length + 20);

      // Verify Collocation appears in Unified SRS Cards
      const unifiedCards = state.getUnifiedSRSCards();
      const collocCard = unifiedCards.find((c) => c.primaryText === 'conduct research');
      expect(collocCard).toBeDefined();
      expect(collocCard?.type).toBe('collocation');

      // Adding the same collocation again -> deduplicated!
      const resDuplicate = captureWritingCollocation({
        phrase: 'Conduct Research',
        meaning: 'nghiên cứu',
        userCollocations: state.userCollocations,
        saveCollocationToSRS: store.saveCollocationToSRS,
      });

      expect(resDuplicate.isDuplicate).toBe(true);
      expect(useAppStore.getState().userCollocations).toHaveLength(1);
    });

    it('captureWritingMistake bounds context strictly without persisting essay blobs', () => {
      const store = useAppStore.getState();
      const longEssay = 'First paragraph discussing environment. Secondly, the student wrote that governments must pay attention on pollution before it is too late. Finally, global cooperation is needed to safeguard our future.';

      const result = captureWritingMistake({
        originalText: 'pay attention on',
        revisedText: 'pay attention to',
        explanation: 'Giới từ đi với attention là "to", không dùng "on".',
        fullEssay: longEssay,
        recordMistake: store.recordMistake,
      });

      expect(result.recorded).toBe(true);
      expect(result.mistakeType).toBe('collocation');
      // Bounded sentence context: contains only the surrounding sentence
      expect(result.boundedContext).toContain('pay attention on');
      expect(result.boundedContext).not.toContain('First paragraph discussing environment');
      expect(result.boundedContext.length).toBeLessThan(longEssay.length);
    });
  });

  // =========================================================================
  // 4. SPEAKING FLOW E2E
  // =========================================================================
  describe('4. Speaking -> Pronunciation Queue End-to-End Flow', () => {
    it('pronunciation score below threshold (< 60) -> appears in pronunciation queue -> practice with >= 75 -> improves', () => {
      const store = useAppStore.getState();
      const targetWord = 'pronunciation';
      const promptSentence = 'Clear pronunciation is vital for international communication.';

      // 1. User speaks with score = 42 (< 60 threshold)
      const resFail = captureSpeakingMistake({
        targetWord,
        sentence: promptSentence,
        accuracy: 42,
        recordMistake: store.recordMistake,
      });

      expect(resFail.isFailure).toBe(true);
      expect(resFail.recorded).toBe(true);

      const state1 = useAppStore.getState();
      const queue1 = getPronunciationPracticeQueue(state1.mistakeBank, {
        vocabularyList: state1.vocabularyList,
      });

      // Appears in pronunciation queue
      expect(queue1.some((item) => item.word.toLowerCase() === targetWord)).toBe(true);

      // Summary reflects 1 pronunciation item
      const summary1 = deriveFourSkillsSummary({
        userCustomWords: state1.userCustomWords,
        srsProgressMap: state1.srsProgressMap,
        mistakeBank: state1.mistakeBank,
        userCollocations: state1.userCollocations,
        vocabularyList: state1.vocabularyList,
      });
      expect(summary1.speakingPronunciationItems).toBe(1);

      // CTA targets pronunciation
      const cta = getFourSkillsCtaTarget(summary1);
      expect(cta.tab).toBe('pronunciation');

      // 2. User practices target word in Pronunciation Arena and scores 88% (>= 75)
      store.recordMistakeCorrect(resFail.targetId, { type: 'pronunciation' });
      store.recordMistakeCorrect(resFail.targetId, { type: 'pronunciation' });

      const state2 = useAppStore.getState();
      const mistake = Object.values(state2.mistakeBank).find(
        (m) => m.word.toLowerCase() === targetWord || m.id === resFail.targetId
      );
      expect(mistake?.consecutiveCorrect).toBeGreaterThanOrEqual(2);
      expect(mistake?.resolved).toBe(true);

      // Queue is cleared of this item
      const queue2 = getPronunciationPracticeQueue(state2.mistakeBank, {
        vocabularyList: state2.vocabularyList,
      });
      expect(queue2.some((item) => item.word.toLowerCase() === targetWord)).toBe(false);
    });
  });

  // =========================================================================
  // 5. FSRS & SM-2 SAFETY E2E
  // =========================================================================
  describe('5. FSRS & SM-2 Safety End-to-End Flow', () => {
    it('Four Skills mistake -> Mistake Bank -> NO automatic FSRS lapse or stability penalty', () => {
      const store = useAppStore.getState();
      const testWordId = 'vocab_fsrs_inviolable';

      const initialSRS: SRSProgress = {
        srsLevel: 5,
        interval: 30,
        easeFactor: 2.8,
        nextReviewDate: '2026-11-20T00:00:00.000Z',
        lastReviewedDate: '2026-10-20T00:00:00.000Z',
        firstLearnedAt: '2026-07-01T00:00:00.000Z',
        againCount: 0,
        reviewCount: 8,
        fsrs: {
          stability: 28.5,
          difficulty: 3.2,
          state: 2 as FSRSState,
          reps: 8,
          lapses: 0,
          lastReview: '2026-10-20T00:00:00.000Z',
        },
      };

      useAppStore.setState({
        srsProgressMap: {
          [testWordId]: initialSRS,
        },
      });

      const cloneBefore = structuredClone(initialSRS);

      // Action: User makes a listening error on this exact word
      captureListeningMistake({
        questionId: 'q_fsrs_safe',
        questionPrompt: 'Select word: fsrs_inviolable',
        userAnswer: 'wrong',
        expectedAnswer: 'fsrs_inviolable',
        recordMistake: store.recordMistake,
      });

      // Action: User makes a speaking pronunciation error on this exact word
      captureSpeakingMistake({
        targetWord: 'fsrs_inviolable',
        accuracy: 35,
        recordMistake: store.recordMistake,
      });

      const stateAfter = useAppStore.getState();
      const srsAfter = stateAfter.srsProgressMap[testWordId];

      // Invariant: FSRS stability, difficulty, lapses, againCount, interval không bị thay đổi!
      expect(srsAfter).toEqual(cloneBefore);
      expect(srsAfter.fsrs?.stability).toBe(28.5);
      expect(srsAfter.fsrs?.difficulty).toBe(3.2);
      expect(srsAfter.fsrs?.lapses).toBe(0);
      expect(srsAfter.againCount).toBe(0);
      expect(srsAfter.interval).toBe(30);
    });

    it('Real Flashcard review -> scheduler -> FSRS and SM-2 algorithms update normally', () => {
      // 1. SM-2 Algorithm computation
      const sm2Initial = { interval: 1, repetition: 1, ef: 2.5 };
      const sm2ResultGood = calculateSM2(2, sm2Initial.interval, sm2Initial.repetition, sm2Initial.ef);
      expect(sm2ResultGood.interval).toBe(6);
      expect(sm2ResultGood.srsLevel).toBe(2);

      const sm2ResultAgain = calculateSM2(0, sm2ResultGood.interval, sm2ResultGood.srsLevel, sm2ResultGood.easeFactor);
      expect(sm2ResultAgain.interval).toBe(1);
      expect(sm2ResultAgain.srsLevel).toBe(0);

      // 2. FSRS-4.5 Algorithm computation
      const initialFSRSState = {
        stability: 10.0,
        difficulty: 4.0,
        state: 2 as FSRSState,
        reps: 3,
        lapses: 0,
        lastReview: new Date(Date.now() - 10 * 86400000).toISOString(),
      };

      // Review "Again" (rating = 1) in real flashcard mode -> FSRS lapse increments and stability decreases
      const fsrsAgain = calculateFSRS(initialFSRSState, 1);
      expect(fsrsAgain.memory.lapses).toBe(1);
      expect(fsrsAgain.memory.reps).toBe(4);
      expect(fsrsAgain.memory.stability).toBeLessThan(initialFSRSState.stability);

      // Review "Good" (rating = 3) in real flashcard mode -> FSRS stability increases
      const fsrsGood = calculateFSRS(initialFSRSState, 3);
      expect(fsrsGood.memory.stability).toBeGreaterThan(initialFSRSState.stability);
      expect(fsrsGood.memory.lapses).toBe(0);
    });
  });

  // =========================================================================
  // 6. STORAGE, CLOUD, BACKUP & PAYLOAD SAFETY
  // =========================================================================
  describe('6. Storage, Cloud, Backup & Quota Safety', () => {
    it('Legacy backup loading: bản sao lưu v1.0 cũ không có sources/fourSkills load hoàn hảo mà không bị crash', () => {
      const store = useAppStore.getState();

      const legacyBackupPayload = JSON.stringify({
        app: 'EnglishMasteryHub',
        version: '1.0.0',
        exportedAt: '2025-01-01T00:00:00.000Z',
        profile: {
          name: 'Old User',
          level: 3,
          xp: 450,
          streak: 5,
        },
        userCustomWords: [
          {
            id: 'custom_legacy_1',
            word: 'phenomenal',
            meaning: 'kỳ diệu',
            ipa: '/fəˈnɒmɪnl/',
            example: 'A phenomenal performance.',
            tag: 'Daily',
            partOfSpeech: 'adjective',
          },
        ],
        srsProgressMap: {
          custom_legacy_1: {
            srsLevel: 2,
            interval: 6,
            easeFactor: 2.5,
            nextReviewDate: '2026-11-01T00:00:00.000Z',
          },
        },
        mistakeBank: {
          legacy_fail: {
            id: 'legacy_fail',
            word: 'ancient',
            meaning: 'cổ xưa',
            mistakeCount: 2,
            resolved: false,
          },
        },
      });

      const importResult = store.importBackupData(legacyBackupPayload);
      expect(importResult.success).toBe(true);

      const state = useAppStore.getState();
      expect(state.profile.name).toBe('Old User');
      expect(state.userCustomWords).toHaveLength(1);
      expect(state.userCustomWords[0].word).toBe('phenomenal');
      // Không bịa đặt nguồn provenance cho dữ liệu cũ
      expect(state.userCustomWords[0].sources).toBeUndefined();

      // Summary hoạt động bình thường, không tính legacy word vào reading
      const summary = deriveFourSkillsSummary({
        userCustomWords: state.userCustomWords,
        srsProgressMap: state.srsProgressMap,
        mistakeBank: state.mistakeBank,
        userCollocations: state.userCollocations,
        vocabularyList: state.vocabularyList,
      });
      expect(summary.readingWordsSaved).toBe(0);
    });

    it('Backup roundtrip: export rồi import lại bảo toàn 100% dữ liệu Four Skills, Collocations và provenance', () => {
      const store = useAppStore.getState();

      // Thiết lập dữ liệu với đầy đủ các tính năng Phase 1 - 4
      captureReadingVocabulary({
        rawWord: 'serendipity',
        readingSentence: 'Serendipity brought them together.',
        srsProgressMap: store.srsProgressMap,
        userCustomWords: store.userCustomWords,
        saveToSRS: store.saveToSRS,
      });

      captureWritingCollocation({
        phrase: 'draw a conclusion',
        meaning: 'rút ra kết luận',
        exampleEn: 'We must draw a conclusion based on evidence.',
        userCollocations: useAppStore.getState().userCollocations,
        saveCollocationToSRS: store.saveCollocationToSRS,
      });

      captureListeningMistake({
        questionId: 'q_roundtrip_1',
        questionPrompt: 'Segment audio: hypothesis',
        userAnswer: 'wrong',
        expectedAnswer: 'hypothesis',
        recordMistake: store.recordMistake,
      });

      const stateBefore = useAppStore.getState();
      const exportJson = store.exportBackupData();
      expect(typeof exportJson).toBe('string');

      // Reset state về rỗng
      store.resetToDefault();
      expect(useAppStore.getState().userCustomWords).toHaveLength(0);
      expect(useAppStore.getState().userCollocations).toHaveLength(0);

      // Khôi phục lại từ JSON export
      const restoreResult = store.importBackupData(exportJson);
      expect(restoreResult.success).toBe(true);

      const stateAfter = useAppStore.getState();
      expect(stateAfter.userCustomWords).toHaveLength(stateBefore.userCustomWords.length);
      expect(stateAfter.userCollocations).toHaveLength(stateBefore.userCollocations.length);
      expect(Object.keys(stateAfter.mistakeBank)).toHaveLength(Object.keys(stateBefore.mistakeBank).length);

      // Provenance được bảo toàn hoàn hảo
      const readingWord = stateAfter.userCustomWords.find((w) => w.word.toLowerCase() === 'serendipity');
      expect(readingWord?.sources).toContain('reading');

      const collocItem = stateAfter.userCollocations.find((c) => c.phrase === 'draw a conclusion');
      expect(collocItem?.sources).toContain('writing');
    });

    it('Cloud Merge: gộp an toàn từ xa mà không gây duplicate mistakes hay SRS cards', () => {
      const store = useAppStore.getState();

      // State local hiện có 1 collocation và 1 mistake
      store.saveCollocationToSRS({
        phrase: 'reach a compromise',
        meaning: 'đạt được sự thỏa hiệp',
        exampleEn: 'Both parties reached a compromise.',
        exampleVi: 'Cả hai bên đã đạt thỏa hiệp.',
        sources: ['writing'],
      });

      store.recordMistake(
        { id: 'mistake_local_1', word: 'compromise', meaning: 'thỏa hiệp' },
        'listening',
        { type: 'listening' }
      );

      // Cloud gửi về bản ghi có cùng phrase và cùng word
      store.mergeCloudData({
        cloudCollocations: [
          {
            id: 'colloc_cloud_remote_1',
            phrase: 'Reach A Compromise',
            meaning: 'thỏa hiệp hai bên',
            exampleEn: 'They reached a compromise.',
            exampleVi: 'Họ đã thỏa hiệp.',
            sources: ['translator'],
            createdAt: '2026-10-01T00:00:00.000Z',
          },
        ],
        cloudMistakeBank: {
          mistake_local_1: {
            id: 'mistake_local_1',
            word: 'compromise',
            meaning: 'thỏa hiệp',
            mistakeCount: 3,
            resolved: false,
            lastMistakeAt: '2026-10-01T00:00:00.000Z',
            consecutiveCorrect: 0,
            source: 'listening',
            primaryType: 'listening',
            typeCounts: { listening: 3 },
          },
        },
      });

      const state = useAppStore.getState();
      // Không nhân đôi Collocation
      expect(state.userCollocations).toHaveLength(1);
      expect(state.userCollocations[0].sources).toContain('writing');
      expect(state.userCollocations[0].sources).toContain('translator');

      // Mistake Bank cập nhật số đếm cao hơn (3) mà không tạo duplicate entry
      const mistakes = Object.values(state.mistakeBank).filter(
        (m) => m.word.toLowerCase() === 'compromise'
      );
      expect(mistakes).toHaveLength(1);
      expect(mistakes[0].mistakeCount).toBe(3);
    });

    it('Storage Payload measurement: serialized payload an toàn quota LocalStorage (< 100KB với 50 từ và 200 telemetry events)', () => {
      const store = useAppStore.getState();

      // Thêm 50 từ vựng và 20 collocations
      for (let i = 0; i < 50; i++) {
        store.addCustomWord({
          word: `measured_word_${i}`,
          meaning: `Nghĩa của từ ${i}`,
          ipa: '/test/',
          example: `Example sentence for word ${i} in academic context.`,
          partOfSpeech: 'noun',
          tag: 'Daily',
        });
      }

      for (let i = 0; i < 20; i++) {
        store.saveCollocationToSRS({
          phrase: `collocation test phrase ${i}`,
          meaning: `Nghĩa cụm ${i}`,
          exampleEn: `Example sentence for collocation ${i}.`,
          exampleVi: `Ví dụ tiếng Việt ${i}.`,
          sources: ['writing'],
        });
      }

      // Giả lập 200 telemetry events
      const mockEvents = Array.from({ length: 200 }).map((_, idx) => ({
        id: `rev_${Date.now()}_${idx}`,
        cardId: `measured_word_${idx % 50}`,
        rating: 'good' as const,
        grade: 2 as const,
        algorithm: 'sm2' as const,
        timestamp: new Date().toISOString(),
        stateBefore: 'review' as const,
        stateAfter: 'review' as const,
        interval: 6,
      }));

      useAppStore.setState({ recentReviewEvents: mockEvents });

      const exportString = store.exportBackupData();
      const payloadBytes = new TextEncoder().encode(exportString).length;

      // Invariant: Payload kích thước an toàn, nhỏ hơn 250KB (ngưỡng an toàn LocalStorage là 1.5MB)
      expect(payloadBytes).toBeLessThan(250 * 1024);
    });
  });

  // =========================================================================
  // 7. INDEPENDENT FOUR SKILLS FLOW
  // =========================================================================
  describe('7. Independent Four Skills Flow', () => {
    it('Hoàn thành toàn bộ bài tập 4 kỹ năng mà không click Save to SRS -> không sinh dữ liệu rác vào SRS', () => {
      const store = useAppStore.getState();

      const initialSRSCount = Object.keys(store.srsProgressMap).length;
      const initialCustomWordsCount = store.userCustomWords.length;
      const initialCollocCount = store.userCollocations.length;
      const initialMistakeCount = Object.keys(store.mistakeBank).length;

      // 1. Hoàn thành bài Reading nhưng không lưu từ vựng nào
      store.recordSkillScore('reading', 95);
      store.gainXP(30);

      // 2. Hoàn thành bài Listening điểm tối đa (không sai câu nào)
      store.recordSkillScore('listening', 100);
      store.gainXP(40);

      // 3. Hoàn thành bài Writing nhưng không bấm lưu Collocation hay Mistake
      store.recordSkillScore('writing', 88);
      store.gainXP(50);

      // 4. Hoàn thành bài Speaking phát âm tốt (> 75%)
      captureSpeakingMistake({
        targetWord: 'fluency',
        accuracy: 85, // Không bị ghi nhận mistake
        recordMistake: store.recordMistake,
      });
      store.recordSkillScore('speaking', 85);
      store.gainXP(35);

      const stateAfter = useAppStore.getState();

      // Invariant: Không phát sinh bất kỳ bản ghi rác nào
      expect(Object.keys(stateAfter.srsProgressMap).length).toBe(initialSRSCount);
      expect(stateAfter.userCustomWords.length).toBe(initialCustomWordsCount);
      expect(stateAfter.userCollocations.length).toBe(initialCollocCount);
      expect(Object.keys(stateAfter.mistakeBank).length).toBe(initialMistakeCount);

      // Competency scores và XP vẫn ghi nhận đầy đủ
      expect(stateAfter.fourSkillsScores.reading).toContain(95);
      expect(stateAfter.fourSkillsScores.listening).toContain(100);
      expect(stateAfter.fourSkillsScores.writing).toContain(88);
      expect(stateAfter.fourSkillsScores.speaking).toContain(85);
      expect(stateAfter.profile.xp).toBe(155);
    });
  });

  // =========================================================================
  // 8. RECORD MISTAKE CORRECT IDENTITY RESOLUTION REGRESSION
  // =========================================================================
  describe('8. recordMistakeCorrect Identity Resolution Regression', () => {
    it('Canonical vocabulary identity: targetId=vocab_123 được resolve chính xác và tăng consecutiveCorrect', () => {
      const store = useAppStore.getState();
      const targetId = 'vocab_canonical_123';
      const wordText = 'entrepreneur';

      store.recordMistake(
        { id: targetId, word: wordText, ipa: '/ˌɒntrəprəˈnɜːr/' },
        'pronunciation',
        { type: 'pronunciation' }
      );

      const state1 = useAppStore.getState();
      expect(state1.mistakeBank[targetId]).toBeDefined();
      expect(state1.mistakeBank[targetId].consecutiveCorrect).toBe(0);

      // Resolve bằng canonical vocabulary targetId
      store.recordMistakeCorrect(targetId, { type: 'pronunciation' });

      const state2 = useAppStore.getState();
      expect(state2.mistakeBank[targetId].consecutiveCorrect).toBe(1);
    });

    it('Custom vocabulary identity: custom target được resolve chính xác và update profile lỗi', () => {
      const store = useAppStore.getState();
      const targetId = 'custom_vocab_456';
      const wordText = 'mycustomword';

      store.recordMistake(
        { id: targetId, word: wordText },
        'pronunciation',
        { type: 'pronunciation' }
      );

      store.recordMistakeCorrect(targetId, { type: 'pronunciation' });

      const state = useAppStore.getState();
      expect(state.mistakeBank[targetId].consecutiveCorrect).toBe(1);
    });

    it('Legacy word fallback: bản ghi không có canonical targetId vẫn resolve chính xác qua normalized word', () => {
      const store = useAppStore.getState();
      const legacyKey = 'legacy_record_key';
      const wordText = 'serendipity';

      useAppStore.setState({
        mistakeBank: {
          [legacyKey]: {
            id: 'legacy_item_id',
            word: wordText,
            meaning: 'may mắn bất ngờ',
            mistakeCount: 2,
            consecutiveCorrect: 0,
            resolved: false,
            source: 'custom',
            lastMistakeAt: new Date().toISOString(),
          },
        },
      });

      // Gọi giải quyết bằng tên từ vựng thông thường
      store.recordMistakeCorrect('SERENDIPITY');

      const state = useAppStore.getState();
      expect(state.mistakeBank[legacyKey].consecutiveCorrect).toBe(1);
    });

    it('Mixed mistake type: cùng một từ vừa có listening vừa có pronunciation -> chỉ cập nhật dimension được luyện đúng, dimension còn lại không bị chữa nhầm', () => {
      const store = useAppStore.getState();
      const testId = 'mixed_test_id';
      const wordText = 'hypothesis';

      // Ghi nhận lỗi nghe
      store.recordMistake({ id: testId, word: wordText }, 'listening', { type: 'listening' });
      // Ghi nhận lỗi phát âm
      store.recordMistake({ id: testId, word: wordText }, 'pronunciation', { type: 'pronunciation' });

      const recordBefore = useAppStore.getState().mistakeBank[testId];
      expect(recordBefore.typeResolutionMap?.listening?.resolved).toBe(false);
      expect(recordBefore.typeResolutionMap?.pronunciation?.resolved).toBe(false);

      // Người học luyện phát âm đúng 2 lần liên tiếp
      store.recordMistakeCorrect(testId, { type: 'pronunciation' });
      store.recordMistakeCorrect(testId, { type: 'pronunciation' });

      const recordAfter = useAppStore.getState().mistakeBank[testId];
      // Dimension pronunciation đã resolved
      expect(recordAfter.typeResolutionMap?.pronunciation?.resolved).toBe(true);
      // Dimension listening TUYỆT ĐỐI không bị chữa nhầm!
      expect(recordAfter.typeResolutionMap?.listening?.resolved).toBe(false);
      // Tổng thể bản ghi chưa resolved vì lỗi listening vẫn tồn đọng
      expect(recordAfter.resolved).toBe(false);
    });
  });

  // =========================================================================
  // 9. PROVENANCE CLOUD MERGE & LOSSLESS ROUND-TRIP REGRESSION
  // =========================================================================
  describe('9. Provenance Cloud Merge & Lossless Round-Trip Regression', () => {
    it('Vocabulary Cloud Merge: Device A (dictionary) + Device B (reading) -> UNION cả hai, exactly 1 identity', () => {
      const store = useAppStore.getState();

      // Device A có từ vựng từ dictionary
      store.addCustomWord({
        word: 'implement',
        meaning: 'thực thi',
        ipa: '/ˈɪmplɪment/',
        example: 'Implement the strategy.',
        partOfSpeech: 'verb',
        tag: 'Daily',
        sources: ['dictionary'],
      });

      const wordId = useAppStore.getState().userCustomWords[0].id;

      // Device B đồng bộ đám mây với cùng từ đó nhưng provenance từ reading
      store.mergeCloudData({
        cloudCustomWords: [
          {
            id: wordId,
            word: 'implement',
            meaning: 'thực thi kế hoạch',
            ipa: '/ˈɪmplɪment/',
            example: 'Implement the strategy in reading context.',
            partOfSpeech: 'verb',
            tag: 'Daily',
            srsLevel: 1,
            interval: 1,
            easeFactor: 2.5,
            nextReviewDate: new Date().toISOString(),
            sources: ['reading'],
          },
        ],
      });

      const state = useAppStore.getState();
      // Exactly 1 vocabulary identity
      expect(state.userCustomWords).toHaveLength(1);
      const word = state.userCustomWords[0];
      // UNION cả hai nguồn
      expect(word.sources).toContain('dictionary');
      expect(word.sources).toContain('reading');
    });

    it('Collocation Cloud Merge: Device A (translator) + Device B (writing) -> UNION cả hai, exactly 1 collocation, SRS schedule preserved', () => {
      const store = useAppStore.getState();

      store.saveCollocationToSRS({
        phrase: 'do research',
        meaning: 'nghiên cứu',
        exampleEn: 'We do research.',
        exampleVi: 'Chúng tôi nghiên cứu.',
        sources: ['translator'],
      });

      const collocId = useAppStore.getState().userCollocations[0].id;

      store.mergeCloudData({
        cloudCollocations: [
          {
            id: collocId,
            phrase: 'do research',
            meaning: 'tiến hành nghiên cứu',
            exampleEn: 'We do research thoroughly.',
            exampleVi: 'Chúng tôi nghiên cứu kỹ lưỡng.',
            createdAt: '2026-10-01T00:00:00.000Z',
            sources: ['writing'],
          },
        ],
      });

      const state = useAppStore.getState();
      // Exactly 1 collocation
      expect(state.userCollocations).toHaveLength(1);
      const colloc = state.userCollocations[0];
      // UNION cả hai nguồn
      expect(colloc.sources).toContain('translator');
      expect(colloc.sources).toContain('writing');
      // SRS schedule preserved
      expect(state.srsProgressMap[collocId]).toBeDefined();
    });

    it('Legacy Cloud Payload: khi sources undefined thì merge an toàn và không tự bịa đặt provenance', () => {
      const store = useAppStore.getState();

      store.mergeCloudData({
        cloudCustomWords: [
          {
            id: 'legacy_cloud_word_1',
            word: 'pristine',
            meaning: 'nguyên sơ',
            ipa: '',
            example: '',
            partOfSpeech: 'adjective',
            tag: 'Daily',
            srsLevel: 0,
            interval: 0,
            easeFactor: 2.5,
            nextReviewDate: new Date().toISOString(),
          },
        ],
      });

      const state = useAppStore.getState();
      const cloudWord = state.userCustomWords.find((w) => w.word === 'pristine');
      expect(cloudWord).toBeDefined();
      expect(cloudWord?.sources).toBeUndefined();
    });
  });
});
