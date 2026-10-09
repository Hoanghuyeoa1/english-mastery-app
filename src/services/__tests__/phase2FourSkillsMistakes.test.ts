import { describe, it, expect, beforeEach } from 'vitest';
import { useAppStore, composeVocabularyList } from '../../store/useAppStore';
import type { VocabWord, FSRSMemoryState, VocabTag } from '../../types';
import { 
  calculateWeaknessSummary, 
  generateDetailedWeaknessReport,
  getPronunciationPracticeQueue,
  PRONUNCIATION_FAIL_THRESHOLD,
  PRONUNCIATION_PASS_THRESHOLD,
  resolveListeningQuestionTarget
} from '../adaptiveMistakeService';
import { getModuleNavigationTarget } from '../adaptivePracticeRouter';
import { captureListeningMistake } from '../fourSkillsLearningBridge';
import { resolveCanonicalVocab } from '../wordLookupService';
import { getDictionaryWord } from '../dictionaryIndex';

describe('Phase 2: Listening + Speaking -> Adaptive Mistake Engine & FSRS Safety', () => {
  beforeEach(() => {
    // Reset Zustand store state before each test
    useAppStore.setState({
      srsProgressMap: {},
      userCustomWords: [],
      vocabularyList: composeVocabularyList({}, []),
      mistakeBank: {},
      dailyHistory: {},
      activePracticeConfig: null,
      pendingNavigationTab: null,
    });
  });

  describe('1. Listening -> Mistake Bank & Target Semantics', () => {
    it('ghi nhận lỗi nghe sai: tăng mistakeCount đúng +1, đúng type=listening, source=listening, không double-count', () => {
      const store = useAppStore.getState();

      const listeningItem: Partial<VocabWord> & { word: string; meaning?: string } = {
        id: 'lq_tech_1',
        word: 'microservices architecture',
        meaning: 'kiến trúc vi dịch vụ',
        example: 'The Rise of Distributed Microservices Architecture',
        tag: 'Daily' as VocabTag,
      };

      // Lần sai thứ 1
      store.recordMistake(listeningItem, 'listening', {
        type: 'listening',
        userAnswer: 'monolithic architecture',
        expectedAnswer: 'microservices architecture',
        context: 'Tech Listening Lesson: What is the primary topic?',
      });

      let state = useAppStore.getState();
      const mistakeKey = 'lq_tech_1';
      const record1 = state.mistakeBank[mistakeKey];

      expect(record1).toBeDefined();
      expect(record1.mistakeCount).toBe(1);
      expect(record1.primaryType).toBe('listening');
      expect(record1.source).toBe('listening');
      expect(record1.typeCounts?.listening).toBe(1);
      expect(record1.sourceCounts?.listening).toBe(1);
      expect(record1.lastUserAnswer).toBe('monolithic architecture');
      expect(record1.lastExpectedAnswer).toBe('microservices architecture');
      expect(record1.lastContext).toContain('Tech Listening Lesson');
      expect(record1.resolved).toBe(false);

      // Lần sai thứ 2 (chỉ tăng đúng +1, thành 2)
      store.recordMistake(listeningItem, 'listening', {
        type: 'listening',
        userAnswer: 'service-oriented architecture',
        expectedAnswer: 'microservices architecture',
        context: 'Tech Listening Lesson: What is the primary topic?',
      });

      state = useAppStore.getState();
      const record2 = state.mistakeBank[mistakeKey];
      expect(record2.mistakeCount).toBe(2);
      expect(record2.typeCounts?.listening).toBe(2);
      expect(record2.sourceCounts?.listening).toBe(2);
    });

    it('phân biệt chính xác giữa Vocabulary-targeted listening mistake và General listening comprehension mistake', () => {
      const store = useAppStore.getState();
      const lessonTitle = 'The Rise of Distributed Microservices Architecture';

      // A. Vocabulary-targeted question (có type: 'vocab_context' và từ trích dẫn trong ngoặc kép)
      const vocabQuestion = {
        id: 'lq1_2',
        type: 'vocab_context' as const,
        question: 'In the first paragraph, the word "preeminent" is closest in meaning to:',
        options: ['Obsolete and discarded', 'Foremost and superior', 'Fragile and unstable', 'Temporary and experimental'],
        correctIndex: 1,
        explanation: '"Preeminent" có nghĩa là xuất sắc hàng đầu, vượt trội.',
      };

      const vocabResolution = resolveListeningQuestionTarget(vocabQuestion, lessonTitle, store.vocabularyList);
      expect(vocabResolution.isVocabTarget).toBe(true);
      expect(vocabResolution.targetWord.toLowerCase()).toBe('preeminent');
      expect(vocabResolution.targetId).toMatch(/^(vocab|custom)_/);

      // Kiểm chứng thêm với từ có trong từ điển chuẩn (autonomous) -> ưu tiên canonical ID (vocab_...)
      const dictWord = getDictionaryWord('autonomous');
      if (dictWord) {
        const dictQuestion = {
          id: 'lq1_dict',
          type: 'vocab_context' as const,
          question: 'In the passage, the word "autonomous" means:',
          options: ['Independent', 'Dependent'],
          correctIndex: 0,
          explanation: 'Autonomous means independent.',
        };
        const dictRes = resolveListeningQuestionTarget(dictQuestion, lessonTitle, store.vocabularyList);
        expect(dictRes.isVocabTarget).toBe(true);
        expect(dictRes.targetId).toBe(dictWord.id);
      }

      // B. General listening comprehension question (main_idea, không có target vocabulary)
      const generalQuestion = {
        id: 'lq1_1',
        type: 'main_idea' as const,
        question: 'What is the primary theme of the entire audio passage?',
        options: [
          'The historical evolution of microservices',
          'Why software engineers should write machine code',
          'Installing OpenTelemetry',
          'Economic costs of physical servers',
        ],
        correctIndex: 0,
        explanation: 'Bài nghe bao quát sự phát triển từ Monolith sang Microservices.',
      };

      const generalResolution = resolveListeningQuestionTarget(generalQuestion, lessonTitle, store.vocabularyList);
      expect(generalResolution.isVocabTarget).toBe(false);
      expect(generalResolution.targetId).toBe('lq1_1');
      expect(generalResolution.targetWord).toBe('');

      // Lỗi nghe hiểu tổng quát: captureListeningMistake KHÔNG đưa vào từ vựng Mistake Bank
      const captureResult = captureListeningMistake({
        question: generalQuestion,
        lessonTitle,
        selectedOptIdx: 1,
        recordMistake: store.recordMistake,
      });
      expect(captureResult.recorded).toBe(false);
      expect(captureResult.isVocabTarget).toBe(false);

      const stateAfterGeneralMistake = useAppStore.getState();
      expect(stateAfterGeneralMistake.mistakeBank['lq1_1']).toBeUndefined();

      // BẢO ĐẢM: KHÔNG tạo vocabulary giả trong srsProgressMap hay userCustomWords từ câu hỏi tổng quát
      expect(stateAfterGeneralMistake.srsProgressMap['lq1_1']).toBeUndefined();
      expect(stateAfterGeneralMistake.srsProgressMap[generalQuestion.question]).toBeUndefined();
      expect(stateAfterGeneralMistake.userCustomWords.some((w) => w.id === 'lq1_1')).toBe(false);
      expect(stateAfterGeneralMistake.userCustomWords.some((w) => w.word === generalQuestion.question)).toBe(false);
    });

    it('từ bài nghe chưa có SRS có thể thêm vào Unified SRS mà không tạo duplicate card khi lưu lại', () => {
      const store = useAppStore.getState();

      // Từ vựng gặp trong bài nghe
      const canonical = resolveCanonicalVocab('autonomous', store.vocabularyList);
      expect(canonical).toBeDefined();
      if (!canonical) return;

      // User click "Save to SRS" từ bài nghe
      store.saveToSRS({
        id: canonical.canonicalId,
        word: canonical.canonicalWord.word,
        meaning: canonical.canonicalWord.meaning,
        example: 'Microservices enable autonomous feature teams.',
        tag: 'Daily' as VocabTag,
        srsLevel: 0,
        interval: 1,
        easeFactor: 2.5,
        nextReviewDate: new Date().toISOString(),
        ipa: '/ɔːˈtɒnəməs/',
        partOfSpeech: 'adjective',
      }, { contextSentence: 'Microservices enable autonomous feature teams.' });

      let state = useAppStore.getState();
      expect(state.srsProgressMap[canonical.canonicalId]).toBeDefined();

      const cards1 = state.getUnifiedSRSCards();
      const count1 = cards1.filter((c) => (c.word || c.primaryText).toLowerCase() === 'autonomous').length;
      expect(count1).toBe(1);

      // Lưu lại lần 2: Không tạo thẻ duplicate
      store.saveToSRS({
        id: canonical.canonicalId,
        word: canonical.canonicalWord.word,
        meaning: canonical.canonicalWord.meaning,
        example: 'Microservices enable autonomous feature teams.',
        tag: 'Daily' as VocabTag,
        srsLevel: 0,
        interval: 1,
        easeFactor: 2.5,
        nextReviewDate: new Date().toISOString(),
        ipa: '/ɔːˈtɒnəməs/',
        partOfSpeech: 'adjective',
      }, { contextSentence: 'Microservices enable autonomous feature teams.' });

      state = useAppStore.getState();
      const cards2 = state.getUnifiedSRSCards();
      const count2 = cards2.filter((c) => (c.word || c.primaryText).toLowerCase() === 'autonomous').length;
      expect(count2).toBe(1);
    });
  });

  describe('2. Listening Idempotency across Attempts / Sessions', () => {
    it('bảo đảm idempotency: sai lần 1 tăng +1, double click không tăng thêm; retry làm đúng tăng consecutiveCorrect đúng 1 lần', () => {
      const store = useAppStore.getState();
      const questionId = 'lq_idempotency_1';
      const rawTarget = 'encapsulation';
      const canonical = resolveCanonicalVocab(rawTarget, store.vocabularyList);
      const targetId = canonical?.canonicalId || questionId;

      // Attempt 1: người học trả lời sai
      let quizSubmitted = false;
      const submitAttempt1 = () => {
        if (quizSubmitted) return;
        quizSubmitted = true;
        store.recordMistake(
          { id: targetId, word: rawTarget },
          'listening',
          { type: 'listening', userAnswer: 'inheritance', expectedAnswer: 'encapsulation' }
        );
      };

      submitAttempt1();
      expect(useAppStore.getState().mistakeBank[targetId.toLowerCase()].mistakeCount).toBe(1);

      // Double submit hoặc re-render: cờ quizSubmitted ngăn chặn tăng lần 2
      submitAttempt1();
      submitAttempt1();
      expect(useAppStore.getState().mistakeBank[targetId.toLowerCase()].mistakeCount).toBe(1);

      // User bấm "Làm lại bài kiểm tra" (Retry Quiz session mới)
      quizSubmitted = false;

      // Attempt 2: người học trả lời đúng
      const submitAttempt2Correct = () => {
        if (quizSubmitted) return;
        quizSubmitted = true;
        store.recordMistakeCorrect(targetId, { type: 'listening' });
      };

      submitAttempt2Correct();
      const recordAfterRetry = useAppStore.getState().mistakeBank[targetId.toLowerCase()];
      expect(recordAfterRetry.consecutiveCorrect).toBe(1);
      expect(recordAfterRetry.typeResolutionMap?.listening?.consecutiveCorrect).toBe(1);

      // Double submit retry: không làm tăng chuỗi correct thêm lần nữa
      submitAttempt2Correct();
      expect(useAppStore.getState().mistakeBank[targetId.toLowerCase()].consecutiveCorrect).toBe(1);
    });
  });

  describe('3. Multi-Track Correctness Semantics by Mistake Type', () => {
    it('phát âm đúng Speaking CHỈ giải quyết track pronunciation, KHÔNG vô tình giải quyết track listening của cùng từ', () => {
      const store = useAppStore.getState();
      const word = 'phenomenon';
      const canonical = resolveCanonicalVocab(word, store.vocabularyList);
      expect(canonical).toBeDefined();
      const wordId = canonical!.canonicalId;

      // 1. Gặp lỗi Listening trên từ này
      store.recordMistake(
        { id: wordId, word: 'phenomenon', meaning: 'hiện tượng' },
        'listening',
        { type: 'listening', userAnswer: 'fenomen', expectedAnswer: 'phenomenon' }
      );

      // 2. Gặp lỗi Pronunciation trên cùng từ này
      store.recordMistake(
        { id: wordId, word: 'phenomenon', meaning: 'hiện tượng' },
        'pronunciation',
        { type: 'pronunciation', userAnswer: 'pheno-me-non', expectedAnswer: 'phenomenon' }
      );

      let record = useAppStore.getState().mistakeBank[wordId.toLowerCase()];
      expect(record.typeCounts?.listening).toBe(1);
      expect(record.typeCounts?.pronunciation).toBe(1);
      expect(record.typeResolutionMap?.listening?.resolved).toBe(false);
      expect(record.typeResolutionMap?.pronunciation?.resolved).toBe(false);
      expect(record.resolved).toBe(false);

      // Hàng đợi phát âm ban đầu PHẢI chứa từ này
      let queue = getPronunciationPracticeQueue(useAppStore.getState().mistakeBank, {
        vocabularyList: useAppStore.getState().vocabularyList,
      });
      expect(queue.some((q) => q.word.toLowerCase() === 'phenomenon')).toBe(true);

      // 3. User luyện phát âm và pass 2 lần liên tiếp (chỉ track pronunciation)
      store.recordMistakeCorrect(wordId, { type: 'pronunciation' });
      store.recordMistakeCorrect(wordId, { type: 'pronunciation' });

      record = useAppStore.getState().mistakeBank[wordId.toLowerCase()];
      // Track pronunciation đã resolved!
      expect(record.typeResolutionMap?.pronunciation?.resolved).toBe(true);
      // Track listening VẪN PHẢI unresolved!
      expect(record.typeResolutionMap?.listening?.resolved).toBe(false);
      // Overall record vẫn unresolved vì listening chưa được chữa!
      expect(record.resolved).toBe(false);

      // HÀNG ĐỢI PHÁT ÂM PHẢI TỰ ĐỘNG LOẠI BỎ TỪ NÀY (do pronunciation đã resolved)
      queue = getPronunciationPracticeQueue(useAppStore.getState().mistakeBank, {
        vocabularyList: useAppStore.getState().vocabularyList,
      });
      expect(queue.some((q) => q.word.toLowerCase() === 'phenomenon')).toBe(false);

      // 4. User luyện nghe và trả lời đúng 2 lần liên tiếp (track listening)
      store.recordMistakeCorrect(wordId, { type: 'listening' });
      store.recordMistakeCorrect(wordId, { type: 'listening' });

      record = useAppStore.getState().mistakeBank[wordId.toLowerCase()];
      expect(record.typeResolutionMap?.listening?.resolved).toBe(true);
      // Bây giờ TẤT CẢ các track đều đã resolved -> overall record mới resolved!
      expect(record.resolved).toBe(true);
    });
  });

  describe('4. Speaking Threshold Boundaries (59, 60, 74, 75)', () => {
    it('khóa chặt các mốc giá trị biên: 59 (fail), 60 (neutral), 74 (neutral), 75 (pass)', () => {
      const store = useAppStore.getState();
      const wordItem = { id: 'vocab_boundary', word: 'meticulous' };

      // Helper mô phỏng đúng contract của FourSkillsView Speaking
      const evaluateSpeakingAccuracy = (score: number) => {
        if (score < PRONUNCIATION_FAIL_THRESHOLD) {
          store.recordMistake(wordItem, 'pronunciation', { type: 'pronunciation' });
        } else if (score >= PRONUNCIATION_PASS_THRESHOLD) {
          store.recordMistakeCorrect(wordItem.id, { type: 'pronunciation' });
        }
        // Giữa 60 và 74 là neutral: không ghi nhận mistake mới, không ghi nhận correct
      };

      // Biên 1: Score 59 -> FAIL (< 60) -> Ghi nhận mistake
      evaluateSpeakingAccuracy(59);
      let record = useAppStore.getState().mistakeBank[wordItem.id.toLowerCase()];
      expect(record).toBeDefined();
      expect(record.mistakeCount).toBe(1);
      expect(record.consecutiveCorrect).toBe(0);

      // Biên 2: Score 60 -> NEUTRAL (>= 60 và < 75) -> Giữ nguyên, không tăng mistakeCount, không tăng consecutiveCorrect
      evaluateSpeakingAccuracy(60);
      record = useAppStore.getState().mistakeBank[wordItem.id.toLowerCase()];
      expect(record.mistakeCount).toBe(1);
      expect(record.consecutiveCorrect).toBe(0);

      // Biên 3: Score 74 -> NEUTRAL (>= 60 và < 75) -> Giữ nguyên
      evaluateSpeakingAccuracy(74);
      record = useAppStore.getState().mistakeBank[wordItem.id.toLowerCase()];
      expect(record.mistakeCount).toBe(1);
      expect(record.consecutiveCorrect).toBe(0);

      // Biên 4: Score 75 -> PASS (>= 75) -> Gọi recordMistakeCorrect -> tăng consecutiveCorrect
      evaluateSpeakingAccuracy(75);
      record = useAppStore.getState().mistakeBank[wordItem.id.toLowerCase()];
      expect(record.mistakeCount).toBe(1);
      expect(record.consecutiveCorrect).toBe(1);
      expect(record.typeResolutionMap?.pronunciation?.consecutiveCorrect).toBe(1);
    });
  });

  describe('5. False Pronunciation Target Attribution Prevention', () => {
    it('câu dài nhiều từ khóa khi điểm thấp KHÔNG fan out thành hàng loạt mistake entries giả', () => {
      const store = useAppStore.getState();

      const turn = {
        targetSentence: 'Building resilient, loosely coupled microservices architecture enables autonomous deployments.',
        keyKeywords: ['resilient', 'microservices', 'architecture', 'autonomous', 'deployments'],
        meaningVi: 'Xây dựng vi dịch vụ bền bỉ và ghép lỏng...',
        phonetic: '/.../',
      };

      const userTranscript = 'building bad things';
      const user = userTranscript.toLowerCase().replace(/[^a-z0-9\s]/g, '');

      // Mô phỏng thuật toán chọn duy nhất 1 primary keyword trong FourSkillsView:
      const targetKeyword = turn.keyKeywords.find((kw) => {
        const normKw = kw.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
        return !user.includes(normKw);
      }) || turn.keyKeywords[0] || turn.targetSentence;

      const canonical = resolveCanonicalVocab(targetKeyword, store.vocabularyList);
      const targetId = canonical?.canonicalId || `speaking_0`;
      const targetWord = canonical?.canonicalWord.word || targetKeyword;

      // Ghi nhận lỗi phát âm cho lượt này
      store.recordMistake(
        { id: targetId, word: targetWord },
        'pronunciation',
        { type: 'pronunciation', userAnswer: userTranscript, expectedAnswer: turn.targetSentence }
      );

      const state = useAppStore.getState();
      const mistakeKeys = Object.keys(state.mistakeBank);

      // BẢO ĐẢM: Chỉ duy nhất 1 mistake record được tạo ra per turn, KHÔNG fan out thành 5 records
      expect(mistakeKeys.length).toBe(1);
      expect(mistakeKeys[0]).toBe(targetId.toLowerCase());
      expect(state.mistakeBank[targetId.toLowerCase()].word.toLowerCase()).toBe(targetWord.toLowerCase());
    });
  });

  describe('6. Pronunciation Practice Queue Identity Contract', () => {
    it('hàng đợi phát âm ưu tiên canonical system ID (vocab_...) từ từ điển ngay cả khi record ban đầu mang generic ID', () => {
      const store = useAppStore.getState();
      const dictWord = getDictionaryWord('meticulous');
      expect(dictWord).toBeDefined();

      // Ghi nhận lỗi với generic turn ID (ví dụ: speaking_turn_0)
      store.recordMistake(
        {
          id: 'speaking_turn_0',
          word: 'meticulous',
          meaning: 'tỉ mỉ, cẩn thận',
        },
        'pronunciation',
        { type: 'pronunciation', userAnswer: 'meticlas', expectedAnswer: 'meticulous' }
      );

      // Queue derived từ Mistake Bank phải resolve sang canonical system ID của từ điển
      const queue = getPronunciationPracticeQueue(useAppStore.getState().mistakeBank, {
        vocabularyList: store.vocabularyList,
      });

      expect(queue.length).toBe(1);
      expect(queue[0].id).toBe(dictWord!.id); // Bắt buộc là vocab_... chuẩn
      expect(queue[0].word.toLowerCase()).toBe('meticulous');
      expect(queue[0].id).not.toBe('speaking_turn_0');
    });
  });

  describe('7. Queue Dedup, Immediate Disappearance on Resolution, & Reopening', () => {
    it('dedup từ sai nhiều lần, biến mất khỏi queue ngay khi resolve, và quay lại queue khi tái phát (reopen)', () => {
      const store = useAppStore.getState();
      const word = 'phenomenon';
      const canonical = resolveCanonicalVocab(word, store.vocabularyList);
      expect(canonical).toBeDefined();
      const wordId = canonical!.canonicalId;

      // 1. Sai lần 1 & lần 2
      store.recordMistake({ id: wordId, word: 'phenomenon' }, 'pronunciation', { type: 'pronunciation' });
      store.recordMistake({ id: wordId, word: 'phenomenon' }, 'pronunciation', { type: 'pronunciation' });

      let state = useAppStore.getState();
      let queue = getPronunciationPracticeQueue(state.mistakeBank, { vocabularyList: state.vocabularyList });

      // Chỉ xuất hiện 1 item trong queue, tổng mistakeCount = 2
      expect(queue.length).toBe(1);
      expect(queue[0].mistakeCount).toBe(2);

      // 2. Luyện đúng 2 lần liên tiếp -> Resolve
      store.recordMistakeCorrect(wordId, { type: 'pronunciation' });
      store.recordMistakeCorrect(wordId, { type: 'pronunciation' });

      state = useAppStore.getState();
      expect(state.mistakeBank[wordId.toLowerCase()].resolved).toBe(true);

      // BIẾN MẤT KHỎI QUEUE NGAY LẬP TỨC (0 items)
      queue = getPronunciationPracticeQueue(state.mistakeBank, { vocabularyList: state.vocabularyList });
      expect(queue.length).toBe(0);

      // 3. Về sau phát âm sai lại -> Reopen mistake
      store.recordMistake({ id: wordId, word: 'phenomenon' }, 'pronunciation', { type: 'pronunciation' });

      state = useAppStore.getState();
      const reopenedRecord = state.mistakeBank[wordId.toLowerCase()];
      expect(reopenedRecord.resolved).toBe(false);
      expect(reopenedRecord.reopenCount).toBe(1);
      expect(reopenedRecord.mistakeCount).toBe(3);

      // TỰ ĐỘNG XUẤT HIỆN LẠI TRONG QUEUE với trạng thái tái diễn
      queue = getPronunciationPracticeQueue(state.mistakeBank, { vocabularyList: state.vocabularyList });
      expect(queue.length).toBe(1);
      expect(queue[0].reopenCount).toBe(1);
      expect(queue[0].mistakeCount).toBe(3);
    });
  });

  describe('8. Listening Weakness Evidence & Diagnostic Insights', () => {
    it('sinh chẩn đoán LISTENING_COMPREHENSION_GAP khi lỗi nghe chiếm >= 30% và đủ cỡ mẫu >= 5', () => {
      const store = useAppStore.getState();

      // Tạo 3 lỗi listening và 2 lỗi pronunciation (tổng = 5 lỗi, listening = 60% >= 30%)
      for (let i = 1; i <= 3; i++) {
        store.recordMistake(
          { id: `listen_err_${i}`, word: `listening term ${i}` },
          'listening',
          { type: 'listening' }
        );
      }
      for (let i = 1; i <= 2; i++) {
        store.recordMistake(
          { id: `pron_err_${i}`, word: `pron term ${i}` },
          'pronunciation',
          { type: 'pronunciation' }
        );
      }

      const mistakes = useAppStore.getState().mistakeBank;
      const report = generateDetailedWeaknessReport(mistakes);

      expect(report.summary.totalMistakes).toBe(5);
      expect(report.dominantWeaknessType).toBe('listening');
      expect(report.dominantWeaknessPercentage).toBe(60);

      const listeningInsight = report.insights.find((ins) => ins.code === 'LISTENING_COMPREHENSION_GAP');
      expect(listeningInsight).toBeDefined();
      expect(listeningInsight?.level).toBe('warning');
      expect(listeningInsight?.title).toContain('nghe hiểu');
    });

    it('KHÔNG sinh LISTENING_COMPREHENSION_GAP khi lỗi nghe chiếm dưới 30%', () => {
      const store = useAppStore.getState();

      // Tạo 2 lỗi listening và 8 lỗi spelling (tổng = 10 lỗi, listening = 20% < 30%)
      for (let i = 1; i <= 2; i++) {
        store.recordMistake(
          { id: `listen_sub_${i}`, word: `listening term ${i}` },
          'listening',
          { type: 'listening' }
        );
      }
      for (let i = 1; i <= 8; i++) {
        store.recordMistake(
          { id: `spell_err_${i}`, word: `spelling term ${i}` },
          'word_scramble',
          { type: 'spelling' }
        );
      }

      const mistakes = useAppStore.getState().mistakeBank;
      const report = generateDetailedWeaknessReport(mistakes);

      expect(report.summary.totalMistakes).toBe(10);
      expect(report.dominantWeaknessType).toBe('spelling');
      const listeningInsight = report.insights.find((ins) => ins.code === 'LISTENING_COMPREHENSION_GAP');
      expect(listeningInsight).toBeUndefined();
    });
  });

  describe('9. FSRS Deep Zero-Mutation Invariant', () => {
    it('kiểm tra deep equality của srsProgressMap trước và sau khi gặp 1 listening, 1 speaking, và chuỗi 5 listening mistakes', () => {
      const store = useAppStore.getState();
      const canonicalId = 'vocab_serendipity';

      const initialFSRS: FSRSMemoryState = {
        stability: 14.5,
        difficulty: 4.2,
        reps: 5,
        lapses: 0,
        state: 2, // Review
        lastReview: '2026-10-01T10:00:00.000Z',
      };

      // Thiết lập card FSRS ổn định trong SRS Deck
      useAppStore.setState({
        srsProgressMap: {
          [canonicalId]: {
            interval: 14,
            easeFactor: 2.6,
            srsLevel: 4,
            nextReviewDate: '2026-10-15T10:00:00.000Z',
            fsrs: { ...initialFSRS },
            firstLearnedAt: '2026-09-15T10:00:00.000Z',
            lastReviewedDate: '2026-10-01T10:00:00.000Z',
            isFavorite: false,
          },
        },
      });

      // BẢN SAO SÂU (DEEP CLONE) TRƯỚC TẤT CẢ CÁC THAO TÁC FOUR SKILLS
      const beforeProgressMap = structuredClone(useAppStore.getState().srsProgressMap);

      // 1. Phát sinh 1 lỗi Listening
      store.recordMistake(
        { id: canonicalId, word: 'serendipity', meaning: 'sự may mắn tình cờ' },
        'listening',
        { type: 'listening', userAnswer: 'serendip', expectedAnswer: 'serendipity' }
      );

      // 2. Phát sinh 1 lỗi Speaking (< 60%)
      store.recordMistake(
        { id: canonicalId, word: 'serendipity', meaning: 'sự may mắn tình cờ' },
        'pronunciation',
        { type: 'pronunciation', userAnswer: 'seren-di-pee-tee', expectedAnswer: 'serendipity' }
      );

      // 3. Phát sinh chuỗi 5 lỗi Listening liên tiếp
      for (let i = 1; i <= 5; i++) {
        store.recordMistake(
          { id: canonicalId, word: 'serendipity', meaning: 'sự may mắn tình cờ' },
          'listening',
          { type: 'listening', userAnswer: `wrong attempt ${i}`, expectedAnswer: 'serendipity' }
        );
      }

      // Xác minh Mistake Bank đã cập nhật đủ
      const mistakeRecord = useAppStore.getState().mistakeBank[canonicalId];
      expect(mistakeRecord.mistakeCount).toBe(7);
      expect(mistakeRecord.typeCounts?.listening).toBe(6);
      expect(mistakeRecord.typeCounts?.pronunciation).toBe(1);

      // BẢO ĐẢM TUYỆT ĐỐI: srsProgressMap deep equality hoàn toàn giống hệt trước khi có lỗi!
      // stability, difficulty, interval, nextReviewDate, lapses, reps, srsLevel không thay đổi dù 1 bit!
      const afterProgressMap = useAppStore.getState().srsProgressMap;
      expect(afterProgressMap).toEqual(beforeProgressMap);
    });
  });
});
