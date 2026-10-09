import { describe, it, expect, beforeEach } from 'vitest';
import { useAppStore } from '../../store/useAppStore';

describe('Collocation SRS Store & Unified Review', () => {
  beforeEach(() => {
    // Reset Zustand store state trước mỗi bài test
    useAppStore.setState({
      userCollocations: [],
      srsProgressMap: {},
      profile: {
        name: 'Learner',
        level: 1,
        xp: 100,
        streak: 1,
        lastActiveDate: new Date().toISOString().split('T')[0],
        lastStudyDate: new Date().toISOString().split('T')[0],
        hearts: 5,
        maxHearts: 5,
        avatarSeed: 'Learner',
        targetDailyWords: 20,
        targetDailyNewWords: 15,
        extraNewWordsBonus: 0,
        isOnboarded: true,
      },
      vocabularyList: [],
      userCustomWords: [],
      mistakeBank: {},
      dailyHistory: {},
    });
  });

  describe('saveCollocationToSRS', () => {
    it('khởi tạo: lưu đúng dữ liệu, gán ID format chuẩn và khởi tạo bản ghi SM-2 kèm +15 XP', () => {
      const store = useAppStore.getState();
      const initialXP = store.profile?.xp || 0;

      const newColloc = {
        phrase: 'take into account',
        meaning: 'cân nhắc, xem xét',
        usageContext: 'Formal writing / Discussion',
        exampleEn: 'We must take into account all factors.',
        exampleVi: 'Chúng ta phải xem xét mọi yếu tố.',
        tags: ['academic', 'collocation'],
      };

      const result = store.saveCollocationToSRS(newColloc);

      expect(result.success).toBe(true);
      expect(result.id).toMatch(/^colloc_\d+$/);

      const state = useAppStore.getState();
      
      // 1. Kiểm tra lưu vào userCollocations
      expect(state.userCollocations).toHaveLength(1);
      const saved = state.userCollocations[0];
      expect(saved.id).toBe(result.id);
      expect(saved.phrase).toBe('take into account');
      expect(saved.meaning).toBe('cân nhắc, xem xét');
      expect(saved.createdAt).toBeDefined();

      // 2. Kiểm tra bản ghi SM-2 khởi tạo
      const srsRecord = state.srsProgressMap[result.id];
      expect(srsRecord).toBeDefined();
      expect(srsRecord.srsLevel).toBe(0);
      expect(srsRecord.interval).toBe(1);
      expect(srsRecord.easeFactor).toBe(2.5);
      expect(typeof srsRecord.nextReviewDate).toBe('string');

      // 3. Kiểm tra cộng 15 XP
      expect(state.profile.xp).toBe(initialXP + 15);
    });

    it('chống trùng lặp: không lưu 2 cụm từ trùng nhau dù viết hoa/thường hoặc khoảng trắng', () => {
      const store = useAppStore.getState();
      const initialXP = store.profile?.xp || 0;

      const res1 = store.saveCollocationToSRS({
        phrase: 'bite the bullet',
        meaning: 'cắn răng chịu đựng',
        exampleEn: 'I decided to bite the bullet.',
        exampleVi: 'Tôi quyết định cắn răng chịu đựng.',
      });
      expect(res1.success).toBe(true);

      // Thử lưu trùng lặp với in hoa và khoảng trắng thừa
      const res2 = store.saveCollocationToSRS({
        phrase: '  BITE THE BULLET   ',
        meaning: 'ý nghĩa khác',
        exampleEn: 'other example',
        exampleVi: 'ví dụ khác',
      });

      expect(res2.success).toBe(false);
      expect(res2.id).toBe(res1.id);
      expect(res2.isDuplicate).toBe(true);

      const state = useAppStore.getState();
      expect(state.userCollocations).toHaveLength(1);
      // XP không được cộng thêm lần 2
      expect(state.profile.xp).toBe(initialXP + 15);
    });

    it('Canonical Collocation Resolution: save "do research" -> ID A, save "Do research." -> duplicate resolves to canonical ID A -> exactly 1 collocation & 1 SRS progress', () => {
      const store = useAppStore.getState();

      const resA = store.saveCollocationToSRS({
        phrase: 'do research',
        meaning: 'làm nghiên cứu',
        exampleEn: 'Scientists do research to discover truths.',
        exampleVi: 'Các nhà khoa học làm nghiên cứu để khám phá sự thật.',
        sources: ['dictionary'],
      });

      expect(resA.success).toBe(true);
      expect(resA.id).toBeTruthy();
      const canonicalIdA = resA.id;

      // Save variant with capitalization and trailing period
      const resB = store.saveCollocationToSRS({
        phrase: 'Do research.',
        meaning: 'tiến hành nghiên cứu',
        exampleEn: 'We must do research carefully.',
        exampleVi: 'Chúng ta phải nghiên cứu cẩn thận.',
        sources: ['writing'],
      });

      expect(resB.success).toBe(false);
      expect(resB.isDuplicate).toBe(true);
      expect(resB.id).toBe(canonicalIdA);

      const state = useAppStore.getState();
      // Exactly 1 collocation in userCollocations
      expect(state.userCollocations).toHaveLength(1);
      expect(state.userCollocations[0].id).toBe(canonicalIdA);

      // Sources merged safely: dictionary + writing
      expect(state.userCollocations[0].sources).toContain('dictionary');
      expect(state.userCollocations[0].sources).toContain('writing');

      // Exactly 1 SRS progress
      const srsEntries = Object.keys(state.srsProgressMap).filter((k) => k === canonicalIdA);
      expect(srsEntries).toHaveLength(1);
    });
  });

  describe('deleteCollocation', () => {
    it('xóa: dọn sạch hoàn toàn cả trong userCollocations và srsProgressMap', () => {
      const store = useAppStore.getState();

      const item1 = store.saveCollocationToSRS({
        phrase: 'keep in mind',
        meaning: 'ghi nhớ',
        exampleEn: 'Keep in mind that rules apply.',
        exampleVi: 'Hãy nhớ rằng luật vẫn áp dụng.',
      });

      const item2 = store.saveCollocationToSRS({
        phrase: 'make a decision',
        meaning: 'đưa ra quyết định',
        exampleEn: 'Make a decision now.',
        exampleVi: 'Hãy đưa ra quyết định ngay.',
      });

      let state = useAppStore.getState();
      expect(state.userCollocations).toHaveLength(2);
      expect(state.srsProgressMap[item1.id]).toBeDefined();
      expect(state.srsProgressMap[item2.id]).toBeDefined();

      // Tiến hành xóa item1
      store.deleteCollocation(item1.id);

      state = useAppStore.getState();
      // Kiểm tra userCollocations
      expect(state.userCollocations).toHaveLength(1);
      expect(state.userCollocations.find((c) => c.id === item1.id)).toBeUndefined();
      expect(state.userCollocations.find((c) => c.id === item2.id)).toBeDefined();

      // Kiểm tra srsProgressMap
      expect(state.srsProgressMap[item1.id]).toBeUndefined();
      expect(state.srsProgressMap[item2.id]).toBeDefined();
    });
  });

  describe('getUnifiedSRSCards', () => {
    it('gộp chính xác số lượng từ đơn (single_word) và cụm từ (collocation)', () => {
      const store = useAppStore.getState();

      // Seed 2 từ đơn
      useAppStore.setState({
        vocabularyList: [
          {
            id: 'vocab_1',
            word: 'ubiquitous',
            ipa: '/juːˈbɪk.wə.təs/',
            partOfSpeech: 'adjective',
            meaning: 'phổ biến khắp nơi',
            example: 'Smartphones are ubiquitous.',
            exampleEn: 'Smartphones are ubiquitous.',
            exampleVi: 'Điện thoại thông minh có ở khắp nơi.',
            topic: 'Advanced',
            tag: 'Academic',
            srsLevel: 2,
            nextReviewDate: '2026-10-10T00:00:00.000Z',
            interval: 4,
            easeFactor: 2.5,
          },
          {
            id: 'vocab_2',
            word: 'meticulous',
            ipa: '/məˈtɪk.jə.ləs/',
            partOfSpeech: 'adjective',
            meaning: 'tỉ mỉ',
            example: 'She is meticulous.',
            exampleEn: 'She is meticulous.',
            exampleVi: 'Cô ấy rất tỉ mỉ.',
            topic: 'Personality',
            tag: 'Daily',
            srsLevel: 0,
            nextReviewDate: new Date().toISOString(),
            interval: 0,
            easeFactor: 2.5,
          },
        ],
        srsProgressMap: {
          vocab_1: {
            srsLevel: 2,
            interval: 4,
            easeFactor: 2.5,
            nextReviewDate: '2026-10-10T00:00:00.000Z',
          },
        },
      });

      // Thêm 2 cụm từ
      store.saveCollocationToSRS({
        phrase: 'call it a day',
        meaning: 'kết thúc ngày làm việc',
        exampleEn: "Let's call it a day.",
        exampleVi: 'Hôm nay dừng ở đây thôi.',
        usageContext: 'Workplace',
      });

      store.saveCollocationToSRS({
        phrase: 'hit the nail on the head',
        meaning: 'nói trúng phóc',
        exampleEn: 'You hit the nail on the head.',
        exampleVi: 'Bạn nói trúng phóc rồi.',
        usageContext: 'Conversation',
      });

      const unifiedCards = store.getUnifiedSRSCards();

      // 2 từ đơn + 2 cụm từ = 4 thẻ
      expect(unifiedCards).toHaveLength(4);

      // Thẻ từ đơn
      const vocabCard = unifiedCards.find((c) => c.id === 'vocab_1');
      expect(vocabCard).toBeDefined();
      expect(vocabCard?.type).toBe('single_word');
      expect(vocabCard?.primaryText).toBe('ubiquitous');
      expect(vocabCard?.srsLevel).toBe(2);

      // Thẻ cụm từ
      const collocCard = unifiedCards.find((c) => c.primaryText === 'call it a day');
      expect(collocCard).toBeDefined();
      expect(collocCard?.type).toBe('collocation');
      expect(collocCard?.meaning).toBe('kết thúc ngày làm việc');
      expect(collocCard?.contextTag).toBe('Workplace');
      expect(collocCard?.srsLevel).toBe(0);
    });
  });
});
