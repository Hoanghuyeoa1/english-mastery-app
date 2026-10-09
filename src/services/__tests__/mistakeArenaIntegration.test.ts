import { describe, it, expect, beforeEach } from 'vitest';
import { useAppStore } from '../../store/useAppStore';

describe('Mistake Arena & Resolution Workflow Integration Tests', () => {
  beforeEach(() => {
    // Reset Zustand store state before each test
    useAppStore.setState({
      profile: {
        name: 'Test Learner',
        level: 1,
        xp: 100,
        streak: 3,
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
      },
      mistakeBank: {},
      dailyHistory: {},
    });
  });

  describe('1. getUnresolvedMistakeWords', () => {
    it('chỉ trả về các từ chưa được giải quyết (resolved === false)', () => {
      // Ghi nhận 3 từ vào mistakeBank: 2 từ unresolved, 1 từ đã resolved
      useAppStore.setState({
        mistakeBank: {
          abandon: {
            id: 'v3k_0001',
            word: 'abandon',
            meaning: 'từ bỏ, ruồng bỏ',
            mistakeCount: 3,
            consecutiveCorrect: 0,
            resolved: false,
            lastMistakeAt: new Date().toISOString(),
            source: 'quiz',
          },
          abundant: {
            id: 'v3k_0002',
            word: 'abundant',
            meaning: 'dồi dào, phong phú',
            mistakeCount: 1,
            consecutiveCorrect: 2,
            resolved: true,
            resolvedDate: new Date().toISOString(),
            lastMistakeAt: new Date().toISOString(),
            source: 'srs_again',
          },
          accommodate: {
            id: 'v3k_0003',
            word: 'accommodate',
            meaning: 'cung cấp chỗ ở, thích ứng',
            mistakeCount: 2,
            consecutiveCorrect: 1,
            resolved: false,
            lastMistakeAt: new Date().toISOString(),
            source: 'dictation',
          },
        },
      });

      const unresolved = useAppStore.getState().getUnresolvedMistakeWords();

      // Phải có đúng 2 từ
      expect(unresolved.length).toBe(2);

      const words = unresolved.map((w) => w.word.toLowerCase());
      expect(words).toContain('abandon');
      expect(words).toContain('accommodate');
      expect(words).not.toContain('abundant');

      // Mỗi từ phải có đầy đủ thuộc tính của VocabWord
      for (const w of unresolved) {
        expect(w.id).toBeDefined();
        expect(w.word).toBeDefined();
        expect(w.meaning).toBeDefined();
      }
    });

    it('trả về mảng rỗng nếu không có bẫy lỗi hoặc tất cả đã resolved', () => {
      useAppStore.setState({
        mistakeBank: {
          test: {
            id: 'test_1',
            word: 'test',
            meaning: 'bài thi',
            mistakeCount: 1,
            consecutiveCorrect: 2,
            resolved: true,
            lastMistakeAt: new Date().toISOString(),
          },
        },
      });

      const unresolved = useAppStore.getState().getUnresolvedMistakeWords();
      expect(unresolved).toEqual([]);
    });
  });

  describe('2. recordQuizMistakeResult - Cơ chế Phục thù & Thưởng điểm XP', () => {
    beforeEach(() => {
      useAppStore.setState({
        mistakeBank: {
          ubiquitous: {
            id: 'w_custom_01',
            word: 'ubiquitous',
            meaning: 'phổ biến, có mặt ở khắp nơi',
            mistakeCount: 2,
            consecutiveCorrect: 0,
            resolved: false,
            lastMistakeAt: new Date().toISOString(),
            source: 'quiz',
          },
        },
      });
    });

    it('test trả lời đúng lần 1: consecutiveCorrect = 1, resolved = false', () => {
      const res = useAppStore.getState().recordQuizMistakeResult('ubiquitous', true);

      expect(res.newlyResolved).toBe(false);

      const record = useAppStore.getState().mistakeBank['ubiquitous'];
      expect(record.consecutiveCorrect).toBe(1);
      expect(record.resolved).toBe(false);
      expect(record.resolvedDate).toBeUndefined();

      // Chưa cộng thưởng phục thù
      expect(useAppStore.getState().profile.xp).toBe(100);
    });

    it('test trả lời đúng lần 2 liên tiếp: consecutiveCorrect = 2, resolved = true, XP tăng 25 điểm', () => {
      // Lần 1: Đúng
      useAppStore.getState().recordQuizMistakeResult('ubiquitous', true);
      expect(useAppStore.getState().profile.xp).toBe(100);

      // Lần 2: Đúng tiếp -> Phục thù thành công
      const res = useAppStore.getState().recordQuizMistakeResult('ubiquitous', true);

      expect(res.newlyResolved).toBe(true);

      const record = useAppStore.getState().mistakeBank['ubiquitous'];
      expect(record.consecutiveCorrect).toBe(2);
      expect(record.resolved).toBe(true);
      expect(record.resolvedDate).toBeDefined();

      // XP phải tăng thêm 25 điểm thưởng (100 -> 125)
      expect(useAppStore.getState().profile.xp).toBe(125);
    });

    it('test trả lời sai khi đang có consecutiveCorrect = 1: reset về 0, resolved = false, wrongCount tăng', () => {
      // Thiết lập bẫy lỗi đang có chuỗi đúng = 1
      useAppStore.setState((s) => ({
        mistakeBank: {
          ubiquitous: {
            ...s.mistakeBank['ubiquitous'],
            consecutiveCorrect: 1,
            mistakeCount: 2,
            wrongCount: 2,
            resolved: false,
          },
        },
      }));

      // Trả lời sai
      const res = useAppStore.getState().recordQuizMistakeResult('ubiquitous', false);

      expect(res.newlyResolved).toBe(false);

      const record = useAppStore.getState().mistakeBank['ubiquitous'];
      expect(record.consecutiveCorrect).toBe(0);
      expect(record.resolved).toBe(false);
      expect(record.mistakeCount).toBe(3);
      expect(record.wrongCount).toBe(3);

      // XP không đổi
      expect(useAppStore.getState().profile.xp).toBe(100);
    });

    it('test tự động thêm bẫy lỗi mới khi trả lời sai từ chưa có trong mistakeBank', () => {
      const res = useAppStore.getState().recordQuizMistakeResult('benevolent', false);

      expect(res.newlyResolved).toBe(false);

      const record = useAppStore.getState().mistakeBank['benevolent'];
      expect(record).toBeDefined();
      expect(record.word).toBe('benevolent');
      expect(record.mistakeCount).toBe(1);
      expect(record.consecutiveCorrect).toBe(0);
      expect(record.resolved).toBe(false);
    });
  });

  describe('3. Persistence Guarantee trong localStorage', () => {
    it('bảo toàn dữ liệu mistakeBank trong localStorage.persist', () => {
      // Ghi nhận bẫy lỗi
      useAppStore.getState().recordMistake(
        { id: 'w_persist_01', word: 'resilient', meaning: 'kiên cường, bền bỉ' },
        'quiz'
      );

      const state = useAppStore.getState();
      const record = state.mistakeBank['w_persist_01'] || state.mistakeBank['resilient'];
      expect(record).toBeDefined();
      expect(record.word).toBe('resilient');
      expect(record.resolved).toBe(false);

      // Cập nhật kết quả đúng 2 lần
      useAppStore.getState().recordQuizMistakeResult('resilient', true);
      useAppStore.getState().recordQuizMistakeResult('resilient', true);

      const updatedRecord = useAppStore.getState().mistakeBank['w_persist_01'] || useAppStore.getState().mistakeBank['resilient'];
      expect(updatedRecord.resolved).toBe(true);
      expect(updatedRecord.consecutiveCorrect).toBe(2);
      expect(updatedRecord.resolvedDate).toBeDefined();
    });
  });

  describe('4. Phase 3: Minigame Revenge Workflow & Instant Reactive Reduction', () => {
    it('số lượng từ trong Mistake Bank giảm đi tức thì khi gỡ lỗi thành công (2 lần liên tiếp đúng)', () => {
      const now = new Date().toISOString();
      // Chuẩn bị 4 từ bẫy lỗi
      useAppStore.setState({
        mistakeBank: {
          word1: { id: 'm1', word: 'word1', meaning: 'nghĩa 1', mistakeCount: 1, consecutiveCorrect: 0, resolved: false, lastMistakeAt: now },
          word2: { id: 'm2', word: 'word2', meaning: 'nghĩa 2', mistakeCount: 1, consecutiveCorrect: 0, resolved: false, lastMistakeAt: now },
          word3: { id: 'm3', word: 'word3', meaning: 'nghĩa 3', mistakeCount: 1, consecutiveCorrect: 0, resolved: false, lastMistakeAt: now },
          word4: { id: 'm4', word: 'word4', meaning: 'nghĩa 4', mistakeCount: 1, consecutiveCorrect: 1, resolved: false, lastMistakeAt: now }, // đã có 1 lần đúng
        },
      });

      // Ban đầu có 4 từ bẫy lỗi chưa giải quyết
      expect(useAppStore.getState().getUnresolvedMistakeWords()).toHaveLength(4);

      // Mô phỏng người chơi trả lời đúng word4 trong minigame (lần 2 liên tiếp)
      const event = useAppStore.getState().recordQuizMistakeResult('word4', true);
      expect(event.resolved).toBe(true);
      expect(event.newlyResolved).toBe(true);
      expect(event.consecutiveCorrect).toBe(2);

      // NGAY LẬP TỨC: số từ bẫy lỗi giảm từ 4 xuống 3 mà không cần reload trang
      const unresolvedAfter = useAppStore.getState().getUnresolvedMistakeWords();
      expect(unresolvedAfter).toHaveLength(3);
      expect(unresolvedAfter.map((w) => w.word)).not.toContain('word4');
    });

    it('phân loại đúng 3 trạng thái cho Victory Modal: Resolved (🟢), Progressing (🟡), Failed (🔴)', () => {
      const now = new Date().toISOString();
      useAppStore.setState({
        mistakeBank: {
          resolved_word: { id: 'r1', word: 'resolved_word', meaning: 'nghĩa đã giải quyết', mistakeCount: 1, consecutiveCorrect: 1, resolved: false, lastMistakeAt: now },
          progressing_word: { id: 'p1', word: 'progressing_word', meaning: 'nghĩa đang tiến bộ', mistakeCount: 1, consecutiveCorrect: 0, resolved: false, lastMistakeAt: now },
          failed_word: { id: 'f1', word: 'failed_word', meaning: 'nghĩa thất bại', mistakeCount: 1, consecutiveCorrect: 1, resolved: false, lastMistakeAt: now },
        },
      });

      // 1. Trả lời đúng từ resolved_word (lần 2 -> resolved)
      const ev1 = useAppStore.getState().recordQuizMistakeResult('resolved_word', true);
      expect(ev1.resolved).toBe(true);

      // 2. Trả lời đúng từ progressing_word (lần 1 -> tiến bộ)
      const ev2 = useAppStore.getState().recordQuizMistakeResult('progressing_word', true);
      expect(ev2.resolved).toBe(false);
      expect(ev2.consecutiveCorrect).toBe(1);

      // 3. Trả lời sai từ failed_word (reset -> 0)
      const ev3 = useAppStore.getState().recordQuizMistakeResult('failed_word', false);
      expect(ev3.resolved).toBe(false);
      expect(ev3.consecutiveCorrect).toBe(0);

      // Xác minh trạng thái trong store
      const bank = useAppStore.getState().mistakeBank;
      expect(bank['resolved_word'].resolved).toBe(true);
      expect(bank['progressing_word'].consecutiveCorrect).toBe(1);
      expect(bank['failed_word'].consecutiveCorrect).toBe(0);
    });
  });
});
