import { describe, it, expect, beforeEach } from 'vitest';
import { useAppStore, composeVocabularyList } from '../../store/useAppStore';
import type { FSRSState } from '../../types';
import {
  stripEdgePunctuation,
  normalizeCollocationPhrase,
  normalizeCollocationKey,
  isCollocationCandidate,
  extractBoundedSentence,
  captureWritingCollocation,
  captureWritingMistake,
  captureReadingVocabulary,
  captureListeningMistake,
  captureSpeakingMistake,
} from '../fourSkillsLearningBridge';

describe('Phase 3: Writing -> Collocation/SRS + Unified Learning Bridge', () => {
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
        name: 'Test Learner',
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

  describe('1. Collocation Normalization & Invariant Rules', () => {
    it('chuẩn hóa phrase: loại bỏ khoảng trắng thừa ở đầu, cuối và giữa các từ', () => {
      expect(normalizeCollocationPhrase('   do   research   ')).toBe('do research');
      expect(normalizeCollocationPhrase('make   a   decision')).toBe('make a decision');
      expect(normalizeCollocationPhrase('  BITE   THE   BULLET  ')).toBe('BITE THE BULLET');
    });

    it('stripEdgePunctuation: loại bỏ dấu ngoặc, nháy đơn/kép, chấm phẩy ở rìa nhưng giữ nguyên dấu gạch nối và nháy đơn nội bộ', () => {
      expect(stripEdgePunctuation('"do research."')).toBe('do research');
      expect(stripEdgePunctuation("'do research'")).toBe('do research');
      expect(stripEdgePunctuation('“do research”')).toBe('do research');
      expect(stripEdgePunctuation('‘do research’')).toBe('do research');
      expect(stripEdgePunctuation('(do research);')).toBe('do research');
      expect(stripEdgePunctuation('[do research]!')).toBe('do research');

      // Giữ nguyên dấu gạch nối và nháy đơn nội bộ (compound words, contractions)
      expect(stripEdgePunctuation('state-of-the-art')).toBe('state-of-the-art');
      expect(stripEdgePunctuation("can't help doing something")).toBe("can't help doing something");
      expect(stripEdgePunctuation('"state-of-the-art."')).toBe('state-of-the-art');
    });

    it('chuẩn hóa key: lower-case, loại bỏ dấu bao quanh rìa và khoảng trắng để dedup chính xác', () => {
      expect(normalizeCollocationKey('do research')).toBe('do research');
      expect(normalizeCollocationKey('Do Research')).toBe('do research');
      expect(normalizeCollocationKey('  do   research  ')).toBe('do research');
      expect(normalizeCollocationKey('DO   RESEARCH')).toBe('do research');
      expect(normalizeCollocationKey('"do research."')).toBe('do research');
      expect(normalizeCollocationKey('“Do Research”')).toBe('do research');
      expect(normalizeCollocationKey("'do research'")).toBe('do research');
    });

    it('store.saveCollocationToSRS: chống duplicate cho "do research", "Do Research", "do  research", "“do research.”"', () => {
      const store = useAppStore.getState();
      const initialXP = store.profile?.xp || 0;

      // Lưu lần đầu
      const res1 = store.saveCollocationToSRS({
        phrase: 'do research',
        meaning: 'tiến hành nghiên cứu',
        usageContext: 'Academic Writing',
        exampleEn: 'Scientists do research on climate change.',
        exampleVi: 'Các nhà khoa học tiến hành nghiên cứu về biến đổi khí hậu.',
        tags: ['academic', 'collocation'],
      });

      expect(res1.success).toBe(true);
      expect(res1.id).toMatch(/^colloc_/);

      let state = useAppStore.getState();
      expect(state.userCollocations).toHaveLength(1);
      expect(state.userCollocations[0].phrase).toBe('do research');
      expect(state.srsProgressMap[res1.id]).toBeDefined();
      expect(state.profile.xp).toBe(initialXP + 15);

      // Thử lưu lần 2 với "Do Research" (viết hoa)
      const res2 = store.saveCollocationToSRS({
        phrase: 'Do Research',
        meaning: 'nghiên cứu',
        exampleEn: 'Scientists do research.',
        exampleVi: 'Các nhà khoa học nghiên cứu.',
      });
      expect(res2.success).toBe(false);

      // Thử lưu lần 3 với "do   research" (nhiều dấu cách)
      const res3 = store.saveCollocationToSRS({
        phrase: '   do   research   ',
        meaning: 'nghiên cứu khoa học',
        exampleEn: 'Scientists do research.',
        exampleVi: 'Các nhà khoa học nghiên cứu.',
      });
      expect(res3.success).toBe(false);

      // Thử lưu lần 4 với dấu ngoặc kép và dấu chấm rìa: "“do research.”"
      const res4 = store.saveCollocationToSRS({
        phrase: '“do research.”',
        meaning: 'nghiên cứu',
        exampleEn: 'Scientists do research.',
        exampleVi: 'Các nhà khoa học nghiên cứu.',
      });
      expect(res4.success).toBe(false);

      state = useAppStore.getState();
      // Không được duplicate, giữ nguyên 1 entry
      expect(state.userCollocations).toHaveLength(1);
      // XP không bị cộng dồn trái phép
      expect(state.profile.xp).toBe(initialXP + 15);
    });
  });

  describe('2. Collocation Candidate Filter (isCollocationCandidate)', () => {
    it('chấp nhận các cụm collocation / enhancement hợp lệ (2-8 từ, lexical enhancement)', () => {
      expect(
        isCollocationCandidate({
          originalText: 'make a research',
          revisedText: 'conduct research',
          type: 'correction',
          explanation: 'Dùng cụm collocation học thuật conduct research',
        })
      ).toBe(true);

      expect(
        isCollocationCandidate({
          originalText: 'good results',
          revisedText: 'promising outcomes',
          type: 'enhancement',
          explanation: 'Nâng cấp từ vựng C1',
        })
      ).toBe(true);

      expect(
        isCollocationCandidate({
          originalText: 'pay attention',
          revisedText: 'pay undivided attention to',
          type: 'enhancement',
        })
      ).toBe(true);
    });

    it('từ chối các sửa lỗi ngữ pháp thuần túy: he don\'t -> he doesn\'t, they was -> they were', () => {
      expect(
        isCollocationCandidate({
          originalText: "he don't",
          revisedText: "he doesn't",
          type: 'correction',
          explanation: 'Sửa lỗi chia động từ số ít thì hiện tại',
        })
      ).toBe(false);

      expect(
        isCollocationCandidate({
          originalText: 'they was',
          revisedText: 'they were',
          type: 'correction',
          explanation: 'Sửa lỗi chủ ngữ số nhiều đi với were',
        })
      ).toBe(false);
    });

    it('từ chối từ đơn lẻ (trừ khi có ghi chú idiom/collocation rõ ràng)', () => {
      expect(
        isCollocationCandidate({
          originalText: 'bad',
          revisedText: 'adverse',
          type: 'correction',
          explanation: 'Dùng từ thay thế',
        })
      ).toBe(false);

      // Nếu giải thích khẳng định đây là collocation/idiom thì chấp nhận
      expect(
        isCollocationCandidate({
          originalText: 'catch-22',
          revisedText: 'catch-22',
          type: 'enhancement',
          explanation: 'Thành ngữ / collocation đặc biệt',
        })
      ).toBe(true);
    });

    it('từ chối cả câu văn dài (> 8 từ hoặc > 60 ký tự)', () => {
      expect(
        isCollocationCandidate({
          originalText: 'It is a good thing to do for everybody involved in this project',
          revisedText: 'This initiative brings substantial advantages to all participating stakeholders across the region',
          type: 'enhancement',
        })
      ).toBe(false);
    });
  });

  describe('3. Writing Correction -> Collocation SRS via Learning Bridge', () => {
    it('tạo collocation entry mới trong userCollocations và srsProgressMap khi user click Add to SRS', () => {
      const store = useAppStore.getState();

      const result = captureWritingCollocation({
        phrase: 'conduct an investigation',
        meaning: 'tiến hành điều tra',
        usageContext: 'Writing Essay',
        exampleEn: 'The authorities need to conduct an investigation into the matter.',
        tags: ['writing', 'formal'],
        userCollocations: store.userCollocations,
        saveCollocationToSRS: store.saveCollocationToSRS,
      });

      expect(result.success).toBe(true);
      expect(result.isDuplicate).toBe(false);
      expect(result.normalizedPhrase).toBe('conduct an investigation');
      expect(result.id).toMatch(/^colloc_/);

      const state = useAppStore.getState();
      expect(state.userCollocations).toHaveLength(1);
      expect(state.userCollocations[0].id).toBe(result.id);
      expect(state.userCollocations[0].phrase).toBe('conduct an investigation');
      // Tiến trình SRS khởi tạo đúng mức 0
      expect(state.srsProgressMap[result.id]).toBeDefined();
      expect(state.srsProgressMap[result.id].srsLevel).toBe(0);
    });

    it('chống duplicate khi gọi bridge lần 2 với cụm từ cùng ngữ nghĩa nhưng khác hoa thường/khoảng trắng', () => {
      const store = useAppStore.getState();

      // Lưu lần 1
      const res1 = captureWritingCollocation({
        phrase: 'pay attention to',
        meaning: 'chú ý đến',
        usageContext: 'Writing Essay',
        userCollocations: store.userCollocations,
        saveCollocationToSRS: store.saveCollocationToSRS,
      });
      expect(res1.success).toBe(true);

      // Lưu lần 2 với chữ hoa và khoảng trắng thừa
      const res2 = captureWritingCollocation({
        phrase: '   Pay   Attention   To   ',
        meaning: 'tập trung vào',
        usageContext: 'Writing Essay',
        userCollocations: useAppStore.getState().userCollocations,
        saveCollocationToSRS: store.saveCollocationToSRS,
      });

      expect(res2.success).toBe(false);
      expect(res2.isDuplicate).toBe(true);
      expect(res2.id).toBe(res1.id);

      const state = useAppStore.getState();
      expect(state.userCollocations).toHaveLength(1);
    });

    it('thay thế cụm sửa vào câu gốc khi không có bản sửa hoàn thiện (context synthesis)', () => {
      const store = useAppStore.getState();
      const rawOriginalEssay = 'Students often make a research without planning.';

      const result = captureWritingCollocation({
        phrase: 'conduct research',
        originalText: 'make a research',
        usageContext: 'Writing Essay',
        exampleEn: rawOriginalEssay, // Chỉ có bài gốc chứa lỗi
        userCollocations: store.userCollocations,
        saveCollocationToSRS: store.saveCollocationToSRS,
      });

      expect(result.success).toBe(true);
      const state = useAppStore.getState();
      const item = state.userCollocations.find((c) => c.id === result.id);
      expect(item).toBeDefined();
      // Câu ví dụ trong SRS phải chứa cụm sửa đã được thay thế mượt mà
      expect(item?.exampleEn).toContain('conduct research');
    });
  });

  describe('4. Bounded Context vs Full Essay Protection', () => {
    it('extractBoundedSentence: chỉ trích xuất đúng câu chứa lỗi, không lưu toàn bộ essay', () => {
      const fullEssay = `In modern society, education plays an indispensable role in shaping human character. Many students make a research on various topics without proper methodology. Furthermore, technology provides endless possibilities for distant learners all around the globe.`;

      const targetError = 'make a research';
      const bounded = extractBoundedSentence(fullEssay, targetError);

      expect(bounded).toBe('Many students make a research on various topics without proper methodology.');
      expect(bounded).not.toContain('education plays an indispensable role');
      expect(bounded).not.toContain('technology provides endless possibilities');
      expect(bounded.length).toBeLessThan(100);
    });

    it('extractBoundedSentence: bảo toàn các từ viết tắt (e.g., i.e., Dr., etc.) không bị cắt nhầm câu', () => {
      const essayWithAbbr = 'According to Dr. Smith, e.g. in his recent paper, students make a research without guidance.';
      const bounded = extractBoundedSentence(essayWithAbbr, 'make a research');

      expect(bounded).toContain('Dr. Smith');
      expect(bounded).toContain('e.g.');
      expect(bounded).toContain('make a research');
    });

    it('extractBoundedSentence: cắt ngắn nếu câu quá dài (> 180 ký tự)', () => {
      const veryLongSentence = `It is widely believed that many young individuals who are currently attending prominent academic institutions often tend to make a research without having adequate preparation, which inevitably leads to catastrophic failure in their final dissertation defense.`;

      const bounded = extractBoundedSentence(veryLongSentence, 'make a research');
      expect(bounded.length).toBeLessThanOrEqual(180);
      expect(bounded).toContain('make a research');
      expect(bounded.startsWith('... ') || bounded.endsWith(' ...')).toBe(true);
    });

    it('captureWritingMistake: KHÔNG lưu cả bài essay vào Mistake Bank', () => {
      const store = useAppStore.getState();

      const fullEssay = `Paragraph 1: Introduction to artificial intelligence and its rapid development. Paragraph 2: However, many companies make a decision without analyzing the risks. Paragraph 3: In conclusion, careful planning is necessary for future innovations.`;

      const result = captureWritingMistake({
        originalText: 'make a decision',
        revisedText: 'reach a decision',
        explanation: 'Dùng reach a decision để tăng tính học thuật trong văn viết',
        fullEssay,
        type: 'collocation',
        recordMistake: store.recordMistake,
      });

      expect(result.recorded).toBe(true);
      expect(result.mistakeType).toBe('collocation');
      expect(result.boundedContext).toBe(
        'Paragraph 2: However, many companies make a decision without analyzing the risks.'
      );

      const state = useAppStore.getState();
      const mistakeEntry = state.mistakeBank[result.mistakeKey];
      expect(mistakeEntry).toBeDefined();
      expect(mistakeEntry.source).toBe('writing');
      expect(mistakeEntry.primaryType).toBe('collocation');
      expect(mistakeEntry.lastContext).toBe(
        'Paragraph 2: However, many companies make a decision without analyzing the risks.'
      );
      // Đảm bảo không chứa Paragraph 1 hay Paragraph 3
      expect(mistakeEntry.lastContext).not.toContain('Paragraph 1');
      expect(mistakeEntry.lastContext).not.toContain('Paragraph 3');
    });

    it('captureWritingMistake: phân loại mistakeType dựa trên type tường minh, segmentType hoặc từ khóa giải thích', () => {
      const store = useAppStore.getState();

      // 1. Ngữ pháp
      const resGrammar = captureWritingMistake({
        originalText: 'he go',
        revisedText: 'he goes',
        explanation: 'Sai ngữ pháp chia động từ thì hiện tại đơn với chủ ngữ ngôi thứ 3 số ít',
        fullEssay: 'Yesterday he said he go to the library.',
        recordMistake: store.recordMistake,
      });
      expect(resGrammar.mistakeType).toBe('grammar');

      // 2. Chính tả
      const resSpelling = captureWritingMistake({
        originalText: 'definately',
        revisedText: 'definitely',
        explanation: 'Sai chính tả (spelling mistake) của từ definitely',
        fullEssay: 'This is definately true.',
        recordMistake: store.recordMistake,
      });
      expect(resSpelling.mistakeType).toBe('spelling');

      // 3. Fallback khi không có giải thích -> mặc định collocation
      const resEmpty = captureWritingMistake({
        originalText: 'take effect',
        revisedText: 'come into effect',
        fullEssay: 'The rule will take effect next year.',
        recordMistake: store.recordMistake,
      });
      expect(resEmpty.mistakeType).toBe('collocation');
    });
  });

  describe('5. Idempotency & Re-render / Double-Click Guard', () => {
    it('chống duplicate recording khi user click 2 lần liên tiếp trong 60 giây cho cùng một context', () => {
      const store = useAppStore.getState();
      const fullEssay = 'Many scholars make a research without careful planning.';

      // Lần 1: Ghi nhận thành công
      const res1 = captureWritingMistake({
        originalText: 'make a research',
        revisedText: 'do research',
        explanation: 'Sai collocation',
        fullEssay,
        mistakeBank: store.mistakeBank,
        recordMistake: store.recordMistake,
      });
      expect(res1.recorded).toBe(true);

      const state1 = useAppStore.getState();
      const count1 = state1.mistakeBank[res1.mistakeKey]?.mistakeCount || 0;
      expect(count1).toBe(1);

      // Lần 2: Click lại ngay trong cùng session (cùng context)
      const res2 = captureWritingMistake({
        originalText: 'make a research',
        revisedText: 'do research',
        explanation: 'Sai collocation',
        fullEssay,
        mistakeBank: state1.mistakeBank,
        recordMistake: state1.recordMistake,
      });

      expect(res2.recorded).toBe(false);
      expect(res2.isDuplicateEvent).toBe(true);

      const state2 = useAppStore.getState();
      // Số lần sai vẫn giữ nguyên 1, không bị double-count
      expect(state2.mistakeBank[res1.mistakeKey]?.mistakeCount).toBe(1);
    });

    it('cho phép ghi nhận lỗi mới khi câu văn ngữ cảnh khác biệt (learning event mới)', () => {
      const store = useAppStore.getState();

      // Bài viết 1
      const res1 = captureWritingMistake({
        originalText: 'make a research',
        revisedText: 'conduct research',
        fullEssay: 'In medical science, doctors make a research diligently.',
        mistakeBank: store.mistakeBank,
        recordMistake: store.recordMistake,
      });
      expect(res1.recorded).toBe(true);

      // Bài viết 2 ở buổi học khác
      const res2 = captureWritingMistake({
        originalText: 'make a research',
        revisedText: 'carry out research',
        fullEssay: 'In economics, professors make a research every semester.',
        mistakeBank: useAppStore.getState().mistakeBank,
        recordMistake: useAppStore.getState().recordMistake,
      });
      expect(res2.recorded).toBe(true);

      const state = useAppStore.getState();
      expect(state.mistakeBank[res1.mistakeKey]?.mistakeCount).toBe(2);
    });
  });

  describe('6. FSRS Safety & Unified Learning Bridge Orchestration', () => {
    it('Writing mistake và Collocation SRS: KHÔNG làm biến đổi sai lệch FSRS memory state của từ vựng khác', () => {
      const store = useAppStore.getState();

      // Giả lập từ vựng đã có trong Unified SRS với FSRS memory state chuẩn
      const existingWordSRS = {
        srsLevel: 3,
        interval: 12,
        easeFactor: 2.6,
        nextReviewDate: '2026-10-20T10:00:00.000Z',
        firstLearnedAt: '2026-09-01T10:00:00.000Z',
        lastReviewedDate: '2026-10-08T10:00:00.000Z',
        fsrs: {
          stability: 14.5,
          difficulty: 4.2,
          state: 2 as FSRSState,
          reps: 4,
          lapses: 0,
          lastReview: '2026-10-08T10:00:00.000Z',
        },
      };

      useAppStore.setState({
        srsProgressMap: {
          vocab_existing_1: existingWordSRS,
        },
      });

      const cloneBefore = structuredClone(existingWordSRS);

      // Thực hiện ghi nhận Writing Collocation qua Bridge
      captureWritingCollocation({
        phrase: 'take into account',
        meaning: 'tính đến / xem xét',
        usageContext: 'Writing Task 2',
        exampleEn: 'Educators must take into account individual learning curves.',
        userCollocations: store.userCollocations,
        saveCollocationToSRS: store.saveCollocationToSRS,
      });

      // Thực hiện ghi nhận Writing Mistake qua Bridge
      captureWritingMistake({
        originalText: 'take in account',
        revisedText: 'take into account',
        explanation: 'Sai giới từ trong cụm collocation',
        fullEssay: 'Educators must take in account student needs.',
        recordMistake: store.recordMistake,
      });

      const stateAfter = useAppStore.getState();
      const untouchedSRS = stateAfter.srsProgressMap['vocab_existing_1'];

      // FSRS memory state của từ gốc phải giữ nguyên 100% so với snapshot ban đầu
      expect(untouchedSRS).toEqual(cloneBefore);
    });

    it('Bridge orchestration: captureReadingVocabulary, captureListeningMistake, captureSpeakingMistake hoạt động nhất quán', () => {
      const store = useAppStore.getState();

      // 1. Reading Vocabulary capture
      const readingRes = captureReadingVocabulary({
        rawWord: '  comprehensive  ',
        readingSentence: 'The report provides a comprehensive overview of the economy.',
        srsProgressMap: store.srsProgressMap,
        userCustomWords: store.userCustomWords,
        saveToSRS: store.saveToSRS,
      });

      expect(readingRes.saved).toBe(true);
      expect(readingRes.canonicalId).toBeDefined();

      // 2. Listening Mistake capture
      const listeningRes = captureListeningMistake({
        questionPrompt: 'What is the speaker discussing regarding "breakthrough" technology?',
        userAnswer: 'breakdown',
        expectedAnswer: 'breakthrough',
        context: 'Technology lecture segment 1',
        recordMistake: store.recordMistake,
      });

      expect(listeningRes.recorded).toBe(true);
      expect(listeningRes.isVocabTargeted).toBe(true);
      expect(listeningRes.targetWord.toLowerCase()).toBe('breakthrough');

      // 3. Speaking Mistake capture
      const speakingRes = captureSpeakingMistake({
        targetWord: 'entrepreneur',
        userPronunciationScore: 45, // < 60 -> fail
        sentence: 'He is a successful entrepreneur in technology.',
        recordMistake: store.recordMistake,
      });

      expect(speakingRes.recorded).toBe(true);
      expect(speakingRes.isFailure).toBe(true);
      expect(speakingRes.mistakeType).toBe('pronunciation');

      const state = useAppStore.getState();
      expect(state.mistakeBank[listeningRes.mistakeKey]).toBeDefined();
      expect(state.mistakeBank[listeningRes.mistakeKey].source).toBe('listening');
      expect(state.mistakeBank[speakingRes.mistakeKey]).toBeDefined();
      expect(state.mistakeBank[speakingRes.mistakeKey].source).toBe('pronunciation');
    });
  });
});
