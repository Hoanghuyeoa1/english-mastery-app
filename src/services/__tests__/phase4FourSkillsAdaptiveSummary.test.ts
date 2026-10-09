import { describe, it, expect, beforeEach } from 'vitest';
import { useAppStore, composeVocabularyList } from '../../store/useAppStore';
import type { FSRSState, SRSProgress } from '../../types';
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

describe('Phase 4: Four Skills Adaptive Summary + Data Safety & Dedup Audit', () => {
  beforeEach(() => {
    // Reset Zustand store state before each test
    useAppStore.setState({
      srsProgressMap: {},
      userCustomWords: [],
      userCollocations: [],
      vocabularyList: composeVocabularyList({}, []),
      mistakeBank: {},
      dailyHistory: {},
      profile: {
        name: 'Learner FourSkills',
        level: 1,
        xp: 100,
        streak: 1,
        lastActiveDate: new Date().toISOString().split('T')[0],
        lastStudyDate: new Date().toISOString().split('T')[0],
        hearts: 5,
        maxHearts: 5,
        avatarSeed: 'Learner',
        targetDailyWords: 15,
        targetDailyNewWords: 15,
        extraNewWordsBonus: 0,
        isOnboarded: true,
        targetGoal: 'daily',
        geminiApiKey: '',
      },
    });
  });

  describe('1. Four Skills Adaptive Summary - Pure Derivation & Accurate Counts', () => {
    it('tính toán chính xác readingWordsSaved từ userCustomWords và srsProgressMap', () => {
      const store = useAppStore.getState();

      // Lưu 5 từ vựng qua luồng Reading
      const sampleWords = ['meticulous', 'resilient', 'ubiquitous', 'serendipity', 'ephemeral'];
      for (const word of sampleWords) {
        captureReadingVocabulary({
          rawWord: word,
          readingSentence: `This is an authentic sentence context featuring the word ${word}.`,
          srsProgressMap: useAppStore.getState().srsProgressMap,
          userCustomWords: useAppStore.getState().userCustomWords,
          saveToSRS: store.saveToSRS,
        });
      }

      const state = useAppStore.getState();
      const summary = deriveFourSkillsSummary({
        userCustomWords: state.userCustomWords,
        srsProgressMap: state.srsProgressMap,
        mistakeBank: state.mistakeBank,
        userCollocations: state.userCollocations,
        vocabularyList: state.vocabularyList,
      });

      expect(summary.readingWordsSaved).toBe(5);
    });

    it('tính toán chính xác listeningUnresolvedMistakes từ mistakeBank', () => {
      const store = useAppStore.getState();

      // Ghi nhận 3 lỗi nghe chưa giải quyết
      captureListeningMistake({
        questionPrompt: 'What does the speaker mean by "paradigm" shift?',
        userAnswer: 'parallel',
        expectedAnswer: 'paradigm',
        lessonTitle: 'Lecture 1',
        recordMistake: store.recordMistake,
      });

      captureListeningMistake({
        questionPrompt: 'Listen and identify the target "hypothesis"',
        userAnswer: 'hyperbole',
        expectedAnswer: 'hypothesis',
        lessonTitle: 'Lecture 2',
        recordMistake: store.recordMistake,
      });

      captureListeningMistake({
        questionPrompt: 'Target vocabulary identification: "dynamics"',
        userAnswer: 'Economic issues',
        expectedAnswer: 'dynamics',
        lessonTitle: 'Lecture 3',
        recordMistake: store.recordMistake,
      });

      // Thêm 1 lỗi listening đã được resolved
      store.recordMistake(
        { id: 'listen_resolved', word: 'comprehend', meaning: 'hiểu' },
        'listening',
        { type: 'listening' }
      );
      store.recordMistakeCorrect('listen_resolved', { type: 'listening' });
      store.recordMistakeCorrect('listen_resolved', { type: 'listening' });

      const state = useAppStore.getState();
      const summary = deriveFourSkillsSummary({
        userCustomWords: state.userCustomWords,
        srsProgressMap: state.srsProgressMap,
        mistakeBank: state.mistakeBank,
        userCollocations: state.userCollocations,
        vocabularyList: state.vocabularyList,
      });

      expect(summary.listeningUnresolvedMistakes).toBe(3);
    });

    it('tính toán chính xác writingCollocationsToReview (due hoặc srsLevel === 0)', () => {
      const store = useAppStore.getState();

      // Lưu 2 collocation mới từ bài viết (mặc định srsLevel = 0, nextReviewDate = now)
      captureWritingCollocation({
        phrase: 'conduct research',
        meaning: 'tiến hành nghiên cứu',
        usageContext: 'Writing Essay',
        userCollocations: store.userCollocations,
        saveCollocationToSRS: store.saveCollocationToSRS,
      });

      captureWritingCollocation({
        phrase: 'play a vital role',
        meaning: 'đóng vai trò quan trọng',
        usageContext: 'Writing Essay',
        userCollocations: useAppStore.getState().userCollocations,
        saveCollocationToSRS: store.saveCollocationToSRS,
      });

      const state = useAppStore.getState();
      const summary = deriveFourSkillsSummary({
        userCustomWords: state.userCustomWords,
        srsProgressMap: state.srsProgressMap,
        mistakeBank: state.mistakeBank,
        userCollocations: state.userCollocations,
        vocabularyList: state.vocabularyList,
      });

      expect(summary.writingCollocationsToReview).toBe(2);
    });

    it('tính toán chính xác speakingPronunciationItems từ hàng đợi phát âm deduplicated', () => {
      const store = useAppStore.getState();

      const pronWords = ['entrepreneur', 'phenomenon', 'infrastructure', 'archaeology'];
      for (const w of pronWords) {
        captureSpeakingMistake({
          targetWord: w,
          userPronunciationScore: 40, // < 60 -> fail
          sentence: `Pronounce the word ${w} clearly.`,
          recordMistake: store.recordMistake,
        });
      }

      const state = useAppStore.getState();
      const summary = deriveFourSkillsSummary({
        userCustomWords: state.userCustomWords,
        srsProgressMap: state.srsProgressMap,
        mistakeBank: state.mistakeBank,
        userCollocations: state.userCollocations,
        vocabularyList: state.vocabularyList,
      });

      expect(summary.speakingPronunciationItems).toBe(4);
      expect(summary.totalWeakItems).toBe(4);
    });

    it('kết hợp đầy đủ đúng định dạng tổng hợp: Reading: 5, Listening: 3, Writing: 2, Speaking: 4', () => {
      const store = useAppStore.getState();

      // 1. Reading: 5 words saved
      ['alpha', 'beta', 'gamma', 'delta', 'epsilon'].forEach((w) => {
        captureReadingVocabulary({
          rawWord: w,
          readingSentence: `Context for ${w}`,
          srsProgressMap: useAppStore.getState().srsProgressMap,
          userCustomWords: useAppStore.getState().userCustomWords,
          saveToSRS: store.saveToSRS,
        });
      });

      // 2. Listening: 3 unresolved mistakes
      ['l1', 'l2', 'l3'].forEach((qId) => {
        captureListeningMistake({
          question: {
            id: qId,
            type: 'vocab_context',
            question: `Identify the target word: "${qId}_word"`,
          },
          userAnswer: 'wrong',
          expectedAnswer: `${qId}_word`,
          recordMistake: store.recordMistake,
        });
      });

      // 3. Writing: 2 collocations to review
      ['draw conclusions', 'take into consideration'].forEach((phrase) => {
        captureWritingCollocation({
          phrase,
          meaning: 'Ý nghĩa',
          userCollocations: useAppStore.getState().userCollocations,
          saveCollocationToSRS: store.saveCollocationToSRS,
        });
      });

      // 4. Speaking: 4 pronunciation items
      ['thoroughly', 'hierarchy', 'mischievous', 'anemone'].forEach((word) => {
        captureSpeakingMistake({
          targetWord: word,
          accuracy: 45,
          sentence: `Say ${word}`,
          recordMistake: store.recordMistake,
        });
      });

      const state = useAppStore.getState();
      const summary = deriveFourSkillsSummary({
        userCustomWords: state.userCustomWords,
        srsProgressMap: state.srsProgressMap,
        mistakeBank: state.mistakeBank,
        userCollocations: state.userCollocations,
        vocabularyList: state.vocabularyList,
      });

      expect(summary.readingWordsSaved).toBe(5);
      expect(summary.listeningUnresolvedMistakes).toBe(3);
      expect(summary.writingCollocationsToReview).toBe(2);
      expect(summary.speakingPronunciationItems).toBe(4);
      expect(summary.totalWeakItems).toBe(9); // 3 + 2 + 4
    });
  });

  describe('2. Deduplication Audit Across Whole System', () => {
    it('Vocabulary: Reading, Listening, Dictionary, Flashcard cùng 1 từ không tạo nhiều SRS cards', () => {
      const store = useAppStore.getState();
      const targetWord = 'resilient';

      // 1. Reading lưu từ
      captureReadingVocabulary({
        rawWord: targetWord,
        readingSentence: 'Communities must be resilient in times of adversity.',
        srsProgressMap: store.srsProgressMap,
        userCustomWords: store.userCustomWords,
        saveToSRS: store.saveToSRS,
      });

      // 2. Dictionary / WordManager lưu lại cùng từ đó
      store.addCustomWord({
        word: 'Resilient',
        meaning: 'kiên cường, phục hồi nhanh',
        ipa: '/rɪˈzɪliənt/',
        example: 'He is a resilient person.',
        tag: 'Daily',
        partOfSpeech: 'adjective',
      });

      // 3. Flashcard / Listening cố gắng saveToSRS lại từ đó
      store.saveToSRS('resilient', {
        contextSentence: 'A resilient spirit overcomes hurdles.',
      });

      const state = useAppStore.getState();
      const cards = state.getUnifiedSRSCards();
      const matchingCards = cards.filter((c) => (c.word || c.primaryText).toLowerCase().trim() === 'resilient');

      // Invariant: Bắt buộc chỉ có duy nhất 1 thẻ SRS cho cùng một từ
      expect(matchingCards).toHaveLength(1);
    });

    it('Mistakes: Một user action sai chỉ tăng đúng +1 mistake, không có double producer', () => {
      const store = useAppStore.getState();
      const testWord = 'pronounce_fail';

      const initialCount = store.mistakeBank[testWord]?.mistakeCount || 0;
      expect(initialCount).toBe(0);

      // 1 action sai
      store.recordMistake(
        { id: testWord, word: testWord, meaning: 'test' },
        'pronunciation',
        { type: 'pronunciation' }
      );

      const state1 = useAppStore.getState();
      expect(state1.mistakeBank[testWord].mistakeCount).toBe(1);

      // Thêm 1 lần sai khác
      store.recordMistake(
        { id: testWord, word: testWord, meaning: 'test' },
        'pronunciation',
        { type: 'pronunciation' }
      );

      const state2 = useAppStore.getState();
      expect(state2.mistakeBank[testWord].mistakeCount).toBe(2);
    });

    it('Collocation: Chuẩn hóa canonical key chống duplicate hoa thường, khoảng trắng và dấu câu rìa', () => {
      const store = useAppStore.getState();

      const res1 = captureWritingCollocation({
        phrase: 'reach a consensus',
        meaning: 'đạt được sự đồng thuận',
        userCollocations: store.userCollocations,
        saveCollocationToSRS: store.saveCollocationToSRS,
      });
      expect(res1.success).toBe(true);

      // Biến thể hoa thường, khoảng trắng thừa và dấu ngoặc kép
      const res2 = captureWritingCollocation({
        phrase: '  "Reach   A   Consensus."  ',
        meaning: 'đồng thuận',
        userCollocations: useAppStore.getState().userCollocations,
        saveCollocationToSRS: store.saveCollocationToSRS,
      });
      expect(res2.success).toBe(false);
      expect(res2.isDuplicate).toBe(true);
      expect(res2.id).toBe(res1.id);

      const state = useAppStore.getState();
      expect(state.userCollocations).toHaveLength(1);
    });

    it('Pronunciation: Nhiều failures cùng 1 từ cập nhật profile nhưng KHÔNG tạo queue duplicates', () => {
      const store = useAppStore.getState();
      const targetWord = 'entrepreneur';

      // 3 lần phát âm sai liên tiếp cùng một từ
      captureSpeakingMistake({
        targetWord,
        accuracy: 30,
        turnIndex: 0,
        sentence: 'He is an entrepreneur.',
        recordMistake: store.recordMistake,
      });

      captureSpeakingMistake({
        targetWord,
        accuracy: 40,
        turnIndex: 1,
        sentence: 'She is an ambitious entrepreneur.',
        recordMistake: store.recordMistake,
      });

      captureSpeakingMistake({
        targetWord,
        accuracy: 50,
        turnIndex: 2,
        sentence: 'Entrepreneurs take calculated risks.',
        recordMistake: store.recordMistake,
      });

      const state = useAppStore.getState();
      // Profile ghi nhận tổng số lần sai = 3
      const mistakeEntry = Object.values(state.mistakeBank).find(
        (m) => m.word.toLowerCase() === targetWord
      );
      expect(mistakeEntry).toBeDefined();
      expect(mistakeEntry?.mistakeCount).toBe(3);

      // Hàng đợi getPronunciationPracticeQueue chỉ chứa DUY NHẤT 1 mục (deduped)
      const queue = getPronunciationPracticeQueue(state.mistakeBank, {
        vocabularyList: state.vocabularyList,
      });
      const matchingItems = queue.filter((item) => item.word.toLowerCase() === targetWord);
      expect(matchingItems).toHaveLength(1);
      expect(matchingItems[0].mistakeCount).toBe(3);
    });
  });

  describe('3. FSRS Safety Audit & No Double Penalty', () => {
    it('Four Skills: Mistake từ Listening, Speaking, Writing tuyệt đối KHÔNG mutate trực tiếp FSRS parameters', () => {
      const store = useAppStore.getState();

      const existingFSRSWord: SRSProgress = {
        srsLevel: 4,
        interval: 20,
        easeFactor: 2.7,
        nextReviewDate: '2026-11-01T08:00:00.000Z',
        firstLearnedAt: '2026-08-15T08:00:00.000Z',
        lastReviewedDate: '2026-10-10T08:00:00.000Z',
        againCount: 1,
        reviewCount: 6,
        fsrs: {
          stability: 18.2,
          difficulty: 3.5,
          state: 2 as FSRSState,
          reps: 6,
          lapses: 1,
          lastReview: '2026-10-10T08:00:00.000Z',
        },
      };

      const wordId = 'vocab_fsrs_safety_test';
      useAppStore.setState({
        srsProgressMap: {
          [wordId]: existingFSRSWord,
        },
      });

      const cloneBefore = structuredClone(existingFSRSWord);

      // 1. Listening mistake on this word
      captureListeningMistake({
        questionId: 'q_listen_fsrs',
        questionPrompt: 'Listen and choose "safety_test"',
        userAnswer: 'wrong_word',
        expectedAnswer: 'fsrs_safety_test',
        recordMistake: store.recordMistake,
      });

      // 2. Speaking mistake on this word
      captureSpeakingMistake({
        targetWord: 'fsrs_safety_test',
        accuracy: 35,
        recordMistake: store.recordMistake,
      });

      // 3. Writing mistake on this word
      captureWritingMistake({
        originalText: 'fsrs_safety_test wrong',
        revisedText: 'fsrs_safety_test correct',
        fullEssay: 'Testing fsrs_safety_test wrong in essay context.',
        recordMistake: store.recordMistake,
      });

      const stateAfter = useAppStore.getState();
      const srsAfter = stateAfter.srsProgressMap[wordId];

      // Tuyệt đối không thay đổi FSRS state, interval, easeFactor, hay stability
      expect(srsAfter).toEqual(cloneBefore);
      expect(srsAfter.fsrs?.stability).toBe(18.2);
      expect(srsAfter.fsrs?.difficulty).toBe(3.5);
      expect(srsAfter.fsrs?.lapses).toBe(1); // KHÔNG bị tăng lapse
      expect(srsAfter.againCount).toBe(1);   // KHÔNG bị tăng againCount
      expect(srsAfter.interval).toBe(20);
      expect(srsAfter.srsLevel).toBe(4);
    });

    it('No double penalty: Ghi nhận mistake chỉ ghi weakness vào Mistake Bank, không hạ cấp SRS card', () => {
      const store = useAppStore.getState();

      const initialSRS: SRSProgress = {
        srsLevel: 2,
        interval: 6,
        easeFactor: 2.5,
        nextReviewDate: '2026-10-25T10:00:00.000Z',
      };

      useAppStore.setState({
        srsProgressMap: {
          vocab_penalty_check: initialSRS,
        },
      });

      // Ghi nhận lỗi nghe
      store.recordMistake(
        { id: 'vocab_penalty_check', word: 'penalty_check', meaning: 'kiểm tra' },
        'listening',
        { type: 'listening', userAnswer: 'wrong', expectedAnswer: 'penalty_check' }
      );

      const state = useAppStore.getState();
      // Mistake Bank có bản ghi
      expect(state.mistakeBank['vocab_penalty_check']).toBeDefined();
      expect(state.mistakeBank['vocab_penalty_check'].mistakeCount).toBe(1);

      // Thẻ SRS vẫn giữ nguyên mức 2 và khoảng cách 6 ngày
      expect(state.srsProgressMap['vocab_penalty_check'].srsLevel).toBe(2);
      expect(state.srsProgressMap['vocab_penalty_check'].interval).toBe(6);
    });
  });

  describe('4. Independent Four Skills Behavior', () => {
    it('Reading flow: người dùng đọc bài mà không click Save to SRS thì không phát sinh dữ liệu thừa', () => {
      const stateBefore = useAppStore.getState();
      const customWordsBefore = stateBefore.userCustomWords.length;
      const srsCountBefore = Object.keys(stateBefore.srsProgressMap).length;

      // Người học chỉ hoàn thành bài đọc, không lưu từ nào
      storeRecordMockReadingQuiz(true);

      const stateAfter = useAppStore.getState();
      expect(stateAfter.userCustomWords.length).toBe(customWordsBefore);
      expect(Object.keys(stateAfter.srsProgressMap).length).toBe(srsCountBefore);
    });

    it('Writing flow: hoàn thành bài luận không bắt buộc lưu Collocation hay Mistake', () => {
      const stateBefore = useAppStore.getState();
      const collocationsBefore = stateBefore.userCollocations.length;
      const mistakesBefore = Object.keys(stateBefore.mistakeBank).length;

      // Người học chấm bài nhưng không bấm "+ Collocation SRS" hay "+ Mistake Bank"
      // Hệ thống chỉ tính điểm competency và XP
      const store = useAppStore.getState();
      store.recordSkillScore('writing', 85);
      store.gainXP(50);

      const stateAfter = useAppStore.getState();
      expect(stateAfter.userCollocations.length).toBe(collocationsBefore);
      expect(Object.keys(stateAfter.mistakeBank).length).toBe(mistakesBefore);
      expect(stateAfter.fourSkillsScores.writing).toContain(85);
    });
  });

  describe('5. Strict Source Provenance & Metric Contracts', () => {
    it('Reading provenance: chỉ đếm các từ thực sự có nguồn gốc Reading (sources bao gồm "reading")', () => {
      const store = useAppStore.getState();

      // 1. Lưu 2 từ từ Reading
      captureReadingVocabulary({
        rawWord: 'meticulous',
        readingSentence: 'He is meticulous in his work.',
        srsProgressMap: store.srsProgressMap,
        userCustomWords: store.userCustomWords,
        saveToSRS: store.saveToSRS,
      });
      captureReadingVocabulary({
        rawWord: 'serendipity',
        readingSentence: 'Finding this was serendipity.',
        srsProgressMap: useAppStore.getState().srsProgressMap,
        userCustomWords: useAppStore.getState().userCustomWords,
        saveToSRS: store.saveToSRS,
      });

      // 2. Thêm 3 từ từ Dictionary (không có 'reading' provenance)
      store.addCustomWord({ word: 'banana', meaning: 'quả chuối', ipa: '', example: '', partOfSpeech: 'noun', tag: 'Daily' });
      store.addCustomWord({ word: 'apple', meaning: 'quả táo', ipa: '', example: '', partOfSpeech: 'noun', tag: 'Daily' });
      store.addCustomWord({ word: 'orange', meaning: 'quả cam', ipa: '', example: '', partOfSpeech: 'noun', tag: 'Daily' });

      // 3. Thêm 1 từ legacy không có trường sources
      useAppStore.setState((s) => ({
        userCustomWords: [
          ...s.userCustomWords,
          {
            id: 'custom_legacy',
            word: 'legacy',
            meaning: 'di sản',
            ipa: '',
            example: '',
            partOfSpeech: 'noun',
            tag: 'Daily',
            srsLevel: 1,
            interval: 1,
            easeFactor: 2.5,
            nextReviewDate: new Date().toISOString(),
          },
        ],
        srsProgressMap: {
          ...s.srsProgressMap,
          custom_legacy: {
            srsLevel: 1,
            interval: 1,
            easeFactor: 2.5,
            nextReviewDate: new Date().toISOString(),
          },
        },
      }));

      const state = useAppStore.getState();
      const summary = deriveFourSkillsSummary({
        userCustomWords: state.userCustomWords,
        srsProgressMap: state.srsProgressMap,
        mistakeBank: state.mistakeBank,
        userCollocations: state.userCollocations,
        vocabularyList: state.vocabularyList,
      });

      // Invariant: Chỉ đếm đúng 2 từ có reading provenance, không đếm 3 từ dictionary và 1 từ legacy
      expect(summary.readingWordsSaved).toBe(2);
    });

    it('Writing provenance: chỉ đếm collocation có writing provenance VÀ đã đến hạn ôn tập (due)', () => {
      const store = useAppStore.getState();

      // 1. Collocation từ Writing đến hạn ôn (due - srsLevel 0 hoặc nextReviewDate quá khứ)
      captureWritingCollocation({
        phrase: 'conduct research',
        meaning: 'tiến hành nghiên cứu',
        userCollocations: store.userCollocations,
        saveCollocationToSRS: store.saveCollocationToSRS,
      });

      // 2. Collocation từ Writing CHƯA đến hạn (nextReviewDate 10 ngày sau)
      const futureDate = new Date();
      futureDate.setDate(futureDate.getDate() + 10);
      const resFuture = captureWritingCollocation({
        phrase: 'draw conclusions',
        meaning: 'rút ra kết luận',
        userCollocations: useAppStore.getState().userCollocations,
        saveCollocationToSRS: store.saveCollocationToSRS,
      });

      // Cập nhật SRS của collocation này thành chưa đến hạn
      useAppStore.setState((s) => ({
        srsProgressMap: {
          ...s.srsProgressMap,
          [resFuture.id]: {
            srsLevel: 3,
            interval: 10,
            easeFactor: 2.5,
            nextReviewDate: futureDate.toISOString(),
            sources: ['writing'],
          },
        },
      }));

      // 3. Collocation từ Translator (không có writing provenance) đến hạn ôn
      store.saveCollocationToSRS({
        phrase: 'take into account',
        meaning: 'tính đến',
        exampleEn: 'You should take this into account.',
        exampleVi: 'Bạn nên tính đến điều này.',
        tags: ['translator'],
        source: 'translator',
        sources: ['translator'],
      });

      const state = useAppStore.getState();
      const summary = deriveFourSkillsSummary({
        userCustomWords: state.userCustomWords,
        srsProgressMap: state.srsProgressMap,
        mistakeBank: state.mistakeBank,
        userCollocations: state.userCollocations,
        vocabularyList: state.vocabularyList,
      });

      // Invariant: Chỉ đếm duy nhất 1 collocation có writing provenance VÀ đang due
      expect(summary.writingCollocationsToReview).toBe(1);
    });
  });

  describe('6. Multi-Source Identity Union & Non-Duplication', () => {
    it('Khi một từ được gặp ở Dictionary trước rồi sau đó lưu từ Reading, sources được hợp nhất mà không sinh duplicate card', () => {
      const store = useAppStore.getState();

      // 1. Người dùng thêm từ trong Dictionary
      store.addCustomWord({
        word: 'ubiquitous',
        meaning: 'phổ biến khắp nơi',
        ipa: '',
        example: '',
        partOfSpeech: 'adjective',
        tag: 'Daily',
      });

      const state1 = useAppStore.getState();
      const customWordId = state1.userCustomWords.find(
        (w) => w.word.toLowerCase() === 'ubiquitous'
      )?.id;
      expect(customWordId).toBeDefined();

      const summary1 = deriveFourSkillsSummary({
        userCustomWords: state1.userCustomWords,
        srsProgressMap: state1.srsProgressMap,
        mistakeBank: state1.mistakeBank,
        userCollocations: state1.userCollocations,
        vocabularyList: state1.vocabularyList,
      });
      // Ban đầu chưa có reading provenance
      expect(summary1.readingWordsSaved).toBe(0);

      // 2. Người dùng gặp lại từ 'ubiquitous' trong bài đọc và nhấn Save to SRS
      captureReadingVocabulary({
        rawWord: 'Ubiquitous',
        readingSentence: 'Smartphones have become ubiquitous in modern society.',
        srsProgressMap: state1.srsProgressMap,
        userCustomWords: state1.userCustomWords,
        saveToSRS: store.saveToSRS,
      });

      const state2 = useAppStore.getState();
      const matchingCards = state2.getUnifiedSRSCards().filter(
        (c) => (c.word || c.primaryText).toLowerCase().trim() === 'ubiquitous'
      );

      // Thẻ SRS vẫn duy nhất 1 thẻ (không nhân đôi card)
      expect(matchingCards).toHaveLength(1);

      // Sources của từ và SRS record đã hợp nhất cả dictionary và reading
      const updatedWord = state2.userCustomWords.find(
        (w) => w.word.toLowerCase() === 'ubiquitous'
      );
      expect(updatedWord?.sources).toContain('dictionary');
      expect(updatedWord?.sources).toContain('reading');

      const srsRecord = state2.srsProgressMap[customWordId!];
      expect(srsRecord?.sources).toContain('reading');

      // Metric readingWordsSaved lập tức nhận diện từ này
      const summary2 = deriveFourSkillsSummary({
        userCustomWords: state2.userCustomWords,
        srsProgressMap: state2.srsProgressMap,
        mistakeBank: state2.mistakeBank,
        userCollocations: state2.userCollocations,
        vocabularyList: state2.vocabularyList,
      });
      expect(summary2.readingWordsSaved).toBe(1);
    });

    it('Collocation multi-source: Translator + Writing hợp nhất nguồn mà không sinh 2 bản ghi', () => {
      const store = useAppStore.getState();

      // 1. Lưu từ Translator
      store.saveCollocationToSRS({
        phrase: 'make a decision',
        meaning: 'đưa ra quyết định',
        exampleEn: 'We need to make a decision.',
        exampleVi: 'Chúng ta cần đưa ra quyết định.',
        source: 'translator',
        sources: ['translator'],
      });

      expect(useAppStore.getState().userCollocations).toHaveLength(1);

      // 2. Gặp lại trong bài viết Writing và lưu
      const res = captureWritingCollocation({
        phrase: 'Make A Decision',
        meaning: 'quyết định',
        userCollocations: useAppStore.getState().userCollocations,
        saveCollocationToSRS: store.saveCollocationToSRS,
      });

      expect(res.isDuplicate).toBe(true);
      expect(res.id).toBe(useAppStore.getState().userCollocations[0].id);
      const state = useAppStore.getState();
      // Không nhân đôi bản ghi
      expect(state.userCollocations).toHaveLength(1);

      const colloc = state.userCollocations[0];
      expect(colloc.sources).toContain('translator');
      expect(colloc.sources).toContain('writing');
    });
  });

  describe('7. Dynamic CTA Routing & Workload Specificity', () => {
    it('Writing-only workload: khi CHỈ có Writing collocations to review, CTA điều hướng đến "flashcards" (Unified SRS), tuyệt đối KHÔNG điều hướng sang "mistakes"', () => {
      const summary = {
        readingWordsSaved: 2,
        listeningUnresolvedMistakes: 0,
        speakingPronunciationItems: 0,
        writingCollocationsToReview: 3,
        totalWeakItems: 3,
        hasLearningData: true,
      };

      const cta = getFourSkillsCtaTarget(summary);

      expect(cta.type).toBe('srs_review');
      expect(cta.tab).toBe('flashcards');
      expect(cta.label).toContain('Ôn Cụm từ Viết (3)');
      // Invariant: Không bao giờ route sang mistake bank khi chỉ có collocations
      expect(cta.tab).not.toBe('mistakes');
    });

    it('Listening mistake có độ ưu tiên cao nhất, điều hướng đến "mistakes"', () => {
      const summary = {
        readingWordsSaved: 0,
        listeningUnresolvedMistakes: 2,
        speakingPronunciationItems: 1,
        writingCollocationsToReview: 1,
        totalWeakItems: 4,
        hasLearningData: true,
      };

      const cta = getFourSkillsCtaTarget(summary);

      expect(cta.type).toBe('mistakes');
      expect(cta.tab).toBe('mistakes');
      expect(cta.label).toContain('Luyện lỗi Nghe (2)');
    });

    it('Speaking pronunciation có độ ưu tiên thứ hai, điều hướng đến "pronunciation"', () => {
      const summary = {
        readingWordsSaved: 0,
        listeningUnresolvedMistakes: 0,
        speakingPronunciationItems: 4,
        writingCollocationsToReview: 2,
        totalWeakItems: 6,
        hasLearningData: true,
      };

      const cta = getFourSkillsCtaTarget(summary);

      expect(cta.type).toBe('pronunciation');
      expect(cta.tab).toBe('pronunciation');
      expect(cta.label).toContain('Luyện Phát âm (4)');
    });

    it('Khi totalWeakItems === 0 và có dữ liệu, trả về "none" với label "Up to date" và tab null', () => {
      const summary = {
        readingWordsSaved: 3,
        listeningUnresolvedMistakes: 0,
        speakingPronunciationItems: 0,
        writingCollocationsToReview: 0,
        totalWeakItems: 0,
        hasLearningData: true,
      };

      const cta = getFourSkillsCtaTarget(summary);

      expect(cta.type).toBe('none');
      expect(cta.tab).toBeNull();
      expect(cta.label).toBe('Up to date');
    });
  });

  describe('8. Empty State Contract & FSRS Snapshot Purity', () => {
    it('Brand new user: khi không có tín hiệu học tập nào thì hasLearningData = false và totalWeakItems = 0', () => {
      const summary = deriveFourSkillsSummary({
        userCustomWords: [],
        srsProgressMap: {},
        mistakeBank: {},
        userCollocations: [],
        vocabularyList: [],
      });

      expect(summary.hasLearningData).toBe(false);
      expect(summary.totalWeakItems).toBe(0);
      expect(summary.readingWordsSaved).toBe(0);
      expect(summary.listeningUnresolvedMistakes).toBe(0);
      expect(summary.writingCollocationsToReview).toBe(0);
      expect(summary.speakingPronunciationItems).toBe(0);
    });

    it('FSRS Snapshot Purity: deriveFourSkillsSummary là hàm thuần khiết (pure function), tuyệt đối không làm thay đổi srsProgressMap', () => {
      const initialSRS: Record<string, SRSProgress> = {
        word_test_pure_1: {
          srsLevel: 3,
          interval: 12,
          easeFactor: 2.6,
          nextReviewDate: '2026-10-30T00:00:00.000Z',
          sources: ['reading'],
          fsrs: {
            stability: 15.5,
            difficulty: 4.1,
            state: 2 as FSRSState,
            reps: 5,
            lapses: 0,
            lastReview: '2026-10-18T00:00:00.000Z',
          },
        },
        colloc_test_pure_2: {
          srsLevel: 1,
          interval: 2,
          easeFactor: 2.5,
          nextReviewDate: '2026-10-01T00:00:00.000Z', // past due
          sources: ['writing'],
        },
      };

      const snapshotBefore = JSON.stringify(initialSRS);

      // Gọi deriveFourSkillsSummary nhiều lần
      for (let i = 0; i < 5; i++) {
        deriveFourSkillsSummary({
          userCustomWords: [],
          srsProgressMap: initialSRS,
          mistakeBank: {},
          userCollocations: [
            {
              id: 'colloc_test_pure_2',
              phrase: 'take action',
              meaning: 'hành động',
              exampleEn: 'We must take action now.',
              exampleVi: 'Chúng ta phải hành động ngay.',
              createdAt: '2026-10-01T00:00:00.000Z',
              sources: ['writing'],
            },
          ],
          vocabularyList: [],
        });
      }

      const snapshotAfter = JSON.stringify(initialSRS);

      // Snapshot trước và sau khi derive summary phải đồng nhất 100%
      expect(snapshotAfter).toBe(snapshotBefore);
    });
  });
});

// Helper giả lập hoàn thành quiz bài đọc thông thường
function storeRecordMockReadingQuiz(passed: boolean) {
  const store = useAppStore.getState();
  if (passed) {
    store.gainXP(30);
    store.recordSkillScore('reading', 90);
  }
}
