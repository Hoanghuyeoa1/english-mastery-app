// @vitest-environment happy-dom
// src/components/__tests__/ListeningLabPhase2Regression.test.tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import React from 'react';
import { FourSkillsView } from '../FourSkillsView';
import { useAppStore, composeVocabularyList } from '../../store/useAppStore';
import { LISTENING_LESSONS } from '../../data/fourSkills/listeningData';
import { getFourSkillsCompetency } from '../../services/skillsCompetencyService';

// Mock canvas-confetti to prevent happy-dom canvas clearRect errors
vi.mock('canvas-confetti', () => ({
  default: vi.fn(),
}));

class MockSpeechSynthesisUtterance {
  text: string;
  lang = 'en-US';
  rate = 1.0;
  volume = 1.0;
  pitch = 1.0;
  voice = null;
  onstart: (() => void) | null = null;
  onend: (() => void) | null = null;
  onerror: ((err: any) => void) | null = null;
  onboundary: ((evt: any) => void) | null = null;
  constructor(text: string) {
    this.text = text;
  }
}

describe('PHASE 2: Listening Lab Core Engine, Audio & Scoring Regression Suite', () => {
  let mockSpeak: any;
  let mockCancel: any;

  beforeEach(() => {
    // Reset Zustand store state before each test
    useAppStore.setState({
      srsProgressMap: {},
      userCustomWords: [],
      vocabularyList: composeVocabularyList({}, []),
      mistakeBank: {},
      dailyHistory: {},
      activeFourSkill: 'listening',
      fourSkillsScores: {
        listening: [],
        reading: [],
        speaking: [],
        writing: [],
      },
      fourSkillsEvidence: {
        listening: [],
        reading: [],
        speaking: [],
        writing: [],
      },
      activePracticeConfig: null,
      pendingNavigationTab: null,
    });

    localStorage.clear();

    // Mock Web Speech API on window and globalThis
    mockSpeak = vi.fn();
    mockCancel = vi.fn();
    (window as any).alert = vi.fn();

    const mockSynth = {
      speak: mockSpeak,
      cancel: mockCancel,
      getVoices: vi.fn(() => []),
      pause: vi.fn(),
      resume: vi.fn(),
    };

    Object.defineProperty(window, 'speechSynthesis', {
      value: mockSynth,
      writable: true,
      configurable: true,
    });

    (window as any).SpeechSynthesisUtterance = MockSpeechSynthesisUtterance;
    (globalThis as any).SpeechSynthesisUtterance = MockSpeechSynthesisUtterance;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // =========================================================================
  // 1. LISTENING SUBMIT INTEGRITY & EMPTY SUBMISSION GUARDS
  // =========================================================================
  describe('1. Listening Submit Integrity & Unanswered Guard', () => {
    it('0 câu trả lời: bấm Submit không record score, không tạo mistake, giữ nguyên trạng thái và hiện cảnh báo', () => {
      render(<FourSkillsView />);

      // Chọn bài nghe đầu tiên (7 câu hỏi)
      const lessonCard = screen.getByText('The Rise of Distributed Microservices Architecture');
      fireEvent.click(lessonCard);

      // Bấm nút Nộp bài ngay khi chưa chọn đáp án nào
      const submitBtn = screen.getByText('Nộp Bài Kiểm Tra (+30 XP)');
      fireEvent.click(submitBtn);

      // Verify: Cảnh báo xuất hiện với đúng số câu chưa chọn
      const alertBox = screen.getByRole('alert');
      expect(alertBox).toBeTruthy();
      expect(alertBox.textContent).toContain('còn 7 câu chưa chọn');

      // Verify Store: Không ghi score vào fourSkillsScores
      const state = useAppStore.getState();
      expect(state.fourSkillsScores.listening).toEqual([]);

      // Verify Store: Không tạo mistake record nào trong mistakeBank
      expect(Object.keys(state.mistakeBank).length).toBe(0);

      // Verify LocalStorage: Không lưu vào completed_listening_lessons
      expect(localStorage.getItem('completed_listening_lessons')).toBeNull();
    });

    it('thiếu một phần câu hỏi: không submit, hiện chính xác số câu còn thiếu', () => {
      render(<FourSkillsView />);

      const lessonCard = screen.getByText('The Rise of Distributed Microservices Architecture');
      fireEvent.click(lessonCard);

      // Chọn đáp án cho câu 1 và câu 2
      const firstQuestionOpt = screen.getByText(/The historical evolution, architectural benefits/i);
      fireEvent.click(firstQuestionOpt);

      const secondQuestionOpt = screen.getByText(/Foremost and superior/i);
      fireEvent.click(secondQuestionOpt);

      // Bấm submit khi mới làm 2/7 câu (còn 5 câu)
      const submitBtn = screen.getByText('Nộp Bài Kiểm Tra (+30 XP)');
      fireEvent.click(submitBtn);

      // Verify: Cảnh báo còn 5 câu chưa chọn
      const alertBox = screen.getByRole('alert');
      expect(alertBox).toBeTruthy();
      expect(alertBox.textContent).toContain('còn 5 câu chưa chọn');

      // Verify: Vẫn chưa submit, điểm và mistake chưa được ghi
      const state = useAppStore.getState();
      expect(state.fourSkillsScores.listening).toEqual([]);
      expect(Object.keys(state.mistakeBank).length).toBe(0);
    });

    it('chọn thêm đáp án sẽ tự động xóa cảnh báo submit chưa hoàn thành', () => {
      render(<FourSkillsView />);

      const lessonCard = screen.getByText('The Rise of Distributed Microservices Architecture');
      fireEvent.click(lessonCard);

      // Submit khi chưa chọn -> hiện cảnh báo
      const submitBtn = screen.getByText('Nộp Bài Kiểm Tra (+30 XP)');
      fireEvent.click(submitBtn);
      expect(screen.getByRole('alert')).toBeTruthy();

      // Chọn 1 đáp án -> cảnh báo phải biến mất
      const opt = screen.getByText(/Foremost and superior/i);
      fireEvent.click(opt);
      expect(screen.queryByRole('alert')).toBeNull();
    });

    it('đủ câu trả lời: ghi score, ghi mistake đúng/sai chính xác, và double click không duplicate score', () => {
      render(<FourSkillsView />);

      // Chọn bài 2 (Sprint Planning - 6 câu hỏi)
      const lessonCard = screen.getByText('Sprint Planning & Scope Negotiation in Agile Teams');
      fireEvent.click(lessonCard);

      // Trả lời đủ 6 câu:
      // Câu 1 (correctIndex = 1): chọn đúng (index 1)
      fireEvent.click(screen.getByText(/Product proposed three major payment features/i));
      // Câu 2 (correctIndex = 1): chọn đúng (index 1)
      fireEvent.click(screen.getByText(/The database connection pool reached nearly 80% utilization/i));
      // Câu 3 (correctIndex = 3): chọn đúng (index 3)
      fireEvent.click(screen.getByText(/Biometric eye-retina scanning payments/i));
      // Câu 4 (vocab_context, correctIndex = 1): chọn sai (chọn index 0) -> tạo mistake từ vựng
      fireEvent.click(screen.getByText(/Expanding the project to hire more personnel/i));
      // Câu 5 (correctIndex = 0): chọn đúng (index 0)
      fireEvent.click(screen.getByText(/It is a mandatory financial security standard/i));
      // Câu 6 (correctIndex = 1): chọn đúng (index 1)
      fireEvent.click(screen.getByText(/Standard credit card transactions, webhook idempotency/i));

      // Bấm submit
      const submitBtn = screen.getByText('Nộp Bài Kiểm Tra (+30 XP)');
      fireEvent.click(submitBtn);

      // Verify: Không có cảnh báo
      expect(screen.queryByRole('alert')).toBeNull();

      // Đúng 5/6 câu = 83%
      const state = useAppStore.getState();
      expect(state.fourSkillsScores.listening).toEqual([83]);

      // Câu 4 sai (vocab_context "scoping down") -> phải được ghi nhận vào mistakeBank
      const mistakes = Object.values(state.mistakeBank);
      expect(mistakes.length).toBe(1);
      expect(mistakes[0].source).toBe('listening');
      expect(mistakes[0].primaryType).toBe('listening');
      expect(mistakes[0].word.toLowerCase()).toContain('scoping down');

      // Verify: Nút submit biến mất, hiện box đã hoàn thành
      expect(screen.getByText('Đã hoàn thành kiểm tra độ hiểu bài!')).toBeTruthy();

      // Double submit protection: Nút submit không còn để click lại
      expect(screen.queryByText('Nộp Bài Kiểm Tra (+30 XP)')).toBeNull();
      expect(state.fourSkillsScores.listening.length).toBe(1);
    });
  });

  // =========================================================================
  // 2. AUDIO LIFECYCLE & SPEED SYNCHRONIZATION
  // =========================================================================
  describe('2. Audio Lifecycle & Speed Synchronization', () => {
    it('bấm Play liên tục không tạo nhiều speak requests cạnh tranh (guard race condition)', () => {
      // Don't auto-trigger onstart yet to simulate clicks occurring during initialization
      mockSpeak = vi.fn();
      (window as any).speechSynthesis.speak = mockSpeak;

      render(<FourSkillsView />);

      const lessonCard = screen.getByText('The Rise of Distributed Microservices Architecture');
      fireEvent.click(lessonCard);

      const playBtn = screen.getByText('Nghe Bài Đọc');

      // Click Play lần 1
      fireEvent.click(playBtn);
      expect(mockSpeak).toHaveBeenCalledTimes(1);

      // Spam click Play liên tiếp 3 lần trước khi onstart kích hoạt
      fireEvent.click(playBtn);
      fireEvent.click(playBtn);
      fireEvent.click(playBtn);

      // Verify: mockSpeak vẫn CHỈ được gọi đúng 1 lần (guard synchronous chặn spam)
      expect(mockSpeak).toHaveBeenCalledTimes(1);
    });

    it('speed controls bị vô hiệu hóa khi audio đang chạy hoặc đang bắt đầu', () => {
      mockSpeak = vi.fn((utt: MockSpeechSynthesisUtterance) => {
        utt.onstart?.();
      });
      (window as any).speechSynthesis.speak = mockSpeak;

      render(<FourSkillsView />);

      const lessonCard = screen.getByText('The Rise of Distributed Microservices Architecture');
      fireEvent.click(lessonCard);

      const speedBtn125 = screen.getByText('1.25x') as HTMLButtonElement;
      expect(speedBtn125.disabled).toBe(false);

      // Bấm Play -> onstart fires -> isPlayingAudio = true
      const playBtn = screen.getByText('Nghe Bài Đọc');
      fireEvent.click(playBtn);

      // Khi audio đang playing -> tất cả nút speed phải disabled
      const btn075 = screen.getByText('0.75x') as HTMLButtonElement;
      const btn100 = screen.getByText('1x') as HTMLButtonElement;
      const btn125Active = screen.getByText('1.25x') as HTMLButtonElement;
      expect(btn075.disabled).toBe(true);
      expect(btn100.disabled).toBe(true);
      expect(btn125Active.disabled).toBe(true);

      // Dừng audio
      const stopBtn = screen.getByText('Dừng Nghe');
      fireEvent.click(stopBtn);

      // Sau khi dừng -> speed buttons được kích hoạt lại
      expect((screen.getByText('1.25x') as HTMLButtonElement).disabled).toBe(false);
    });

    it('chuyển tab hoặc thoát khỏi bài nghe sẽ cleanup dập tắt audio', () => {
      mockSpeak = vi.fn((utt: MockSpeechSynthesisUtterance) => {
        utt.onstart?.();
      });
      (window as any).speechSynthesis.speak = mockSpeak;

      const { unmount } = render(<FourSkillsView />);

      const lessonCard = screen.getByText('The Rise of Distributed Microservices Architecture');
      fireEvent.click(lessonCard);

      const playBtn = screen.getByText('Nghe Bài Đọc');
      fireEvent.click(playBtn);

      // Click nút quay lại danh sách bài
      const backBtn = screen.getByText(/Quay lại danh sách bài nghe/i);
      fireEvent.click(backBtn);
      expect(mockCancel).toHaveBeenCalled();

      // Unmount component
      unmount();
      expect(mockCancel).toHaveBeenCalled();
    });

    it('start -> highlight sentence 0 ngay lập tức, chuyển onboundary sentence 0 -> 1 -> 2 và dập tắt khi kết thúc', () => {
      let activeUtterance: MockSpeechSynthesisUtterance | null = null;
      mockSpeak = vi.fn((utt: MockSpeechSynthesisUtterance) => {
        activeUtterance = utt;
        utt.onstart?.();
      });
      (window as any).speechSynthesis.speak = mockSpeak;

      const { container } = render(<FourSkillsView />);

      const lessonCard = screen.getByText('The Rise of Distributed Microservices Architecture');
      fireEvent.click(lessonCard);

      const playBtn = screen.getByText('Nghe Bài Đọc');
      fireEvent.click(playBtn);

      expect(activeUtterance).not.toBeNull();

      // Active sentence in paragraph mode has class "ring-1 ring-cyan-400/50"
      const sent0 = container.querySelector('[data-sentence-index="0"]');
      const sent1 = container.querySelector('[data-sentence-index="1"]');
      const sent2 = container.querySelector('[data-sentence-index="2"]');

      expect(sent0).not.toBeNull();
      expect(sent1).not.toBeNull();
      expect(sent2).not.toBeNull();

      expect(sent0?.className).toContain('ring-cyan-400/50');
      expect(sent1?.className).not.toContain('ring-cyan-400/50');

      // Trigger boundary into sentence 1
      const sent1CharIndex = activeUtterance!.text.indexOf('Over the past decade');
      expect(sent1CharIndex).toBeGreaterThan(0);

      act(() => {
        activeUtterance!.onboundary?.({ charIndex: sent1CharIndex, name: 'word' });
      });

      // Sentence 0 must lose active highlight, sentence 1 must gain it
      expect(sent0?.className).not.toContain('ring-cyan-400/50');
      expect(sent1?.className).toContain('ring-cyan-400/50');

      // Trigger boundary into sentence 2
      const sent2CharIndex = activeUtterance!.text.indexOf('In a standard monolith');
      expect(sent2CharIndex).toBeGreaterThan(0);

      act(() => {
        activeUtterance!.onboundary?.({ charIndex: sent2CharIndex, name: 'word' });
      });

      // Sentence 1 must lose active highlight, sentence 2 must gain it
      expect(sent1?.className).not.toContain('ring-cyan-400/50');
      expect(sent2?.className).toContain('ring-cyan-400/50');

      // Audio kết thúc
      act(() => {
        activeUtterance!.onend?.();
      });

      // Highlight phải được clear hoàn toàn
      expect(sent2?.className).not.toContain('ring-cyan-400/50');
    });

    it('dừng bài nghe hoặc thoát bài: clear highlight triệt để không bị stale sentence 0', () => {
      let activeUtterance: MockSpeechSynthesisUtterance | null = null;
      mockSpeak = vi.fn((utt: MockSpeechSynthesisUtterance) => {
        activeUtterance = utt;
        utt.onstart?.();
      });
      (window as any).speechSynthesis.speak = mockSpeak;

      const { container } = render(<FourSkillsView />);

      const lessonCard = screen.getByText('The Rise of Distributed Microservices Architecture');
      fireEvent.click(lessonCard);

      const playBtn = screen.getByText('Nghe Bài Đọc');
      fireEvent.click(playBtn);

      const sent0 = container.querySelector('[data-sentence-index="0"]');
      expect(sent0?.className).toContain('ring-cyan-400/50');

      // Bấm Dừng Nghe
      const stopBtn = screen.getByText('Dừng Nghe');
      fireEvent.click(stopBtn);

      // Highlight bị dập tắt lập tức, không còn stale sentence 0
      expect(sent0?.className).not.toContain('ring-cyan-400/50');
    });

    it('restart/replay: highlight quay trở về sentence 0 chính xác', () => {
      let activeUtterance: MockSpeechSynthesisUtterance | null = null;
      mockSpeak = vi.fn((utt: MockSpeechSynthesisUtterance) => {
        activeUtterance = utt;
        utt.onstart?.();
      });
      (window as any).speechSynthesis.speak = mockSpeak;

      const { container } = render(<FourSkillsView />);

      const lessonCard = screen.getByText('The Rise of Distributed Microservices Architecture');
      fireEvent.click(lessonCard);

      // Lần 1: Play và chuyển sang câu 1
      fireEvent.click(screen.getByText('Nghe Bài Đọc'));
      const sent1CharIndex = activeUtterance!.text.indexOf('Over the past decade');
      act(() => {
        activeUtterance!.onboundary?.({ charIndex: sent1CharIndex, name: 'word' });
      });

      const sent0 = container.querySelector('[data-sentence-index="0"]');
      const sent1 = container.querySelector('[data-sentence-index="1"]');
      expect(sent1?.className).toContain('ring-cyan-400/50');

      // Stop
      fireEvent.click(screen.getByText('Dừng Nghe'));
      expect(sent1?.className).not.toContain('ring-cyan-400/50');

      // Lần 2: Replay lại -> phải quay về sentence 0
      fireEvent.click(screen.getByText('Nghe Bài Đọc'));
      expect(sent0?.className).toContain('ring-cyan-400/50');
      expect(sent1?.className).not.toContain('ring-cyan-400/50');
    });
  });

  // =========================================================================
  // 3. 0% COMPETENCY DISPLAY INTEGRITY
  // =========================================================================
  describe('3. Competency 0% Display Integrity', () => {
    it('học viên làm bài đạt 0% vẫn được tính là đã có dữ liệu học tập (totalAttempts > 0)', () => {
      // Giả lập user đã có 1 lần làm bài đạt 0%
      useAppStore.setState({
        fourSkillsScores: {
          listening: [0],
          reading: [],
          speaking: [],
          writing: [],
        },
      });

      const competency = getFourSkillsCompetency();
      expect(competency.listening.score).toBe(0);
      expect(competency.listening.totalAttempts).toBe(1);
      expect(competency.listening.level).toBe('A1');

      render(<FourSkillsView />);

      // Verify: Header tab pill hiển thị Band A1 (0%) thay vì chuỗi mặc định không có dữ liệu
      const bandPattern = new RegExp(`Band A1 \\(0%\\) • ${LISTENING_LESSONS.length} bài`, 'i');
      expect(screen.getByText(bandPattern)).toBeTruthy();
      expect(screen.queryByText(`Listening Lab (${LISTENING_LESSONS.length} bài)`)).toBeNull();
    });

    it('người dùng chưa từng làm bài nào (totalAttempts = 0) hiển thị nhãn mặc định', () => {
      useAppStore.setState({
        fourSkillsScores: {
          listening: [],
          reading: [],
          speaking: [],
          writing: [],
        },
        fourSkillsEvidence: {
          listening: [],
          reading: [],
          speaking: [],
          writing: [],
        },
      });

      render(<FourSkillsView />);
      expect(screen.getByText(`Listening Lab (${LISTENING_LESSONS.length} bài)`)).toBeTruthy();
    });
  });

  // =========================================================================
  // 4. DATASET AUDIO TEXT & SENTENCES FIDELITY VALIDATION
  // =========================================================================
  describe('4. Dataset AudioText & Sentences Fidelity Validation', () => {
    it('Bài 1: sentences phải chứa đầy đủ các thuật ngữ kỹ thuật trong audioText', () => {
      const lesson1 = LISTENING_LESSONS.find((l) => l.id === 'listen_1')!;
      expect(lesson1).toBeDefined();

      const combinedSentences = lesson1.sentences.map((s) => s.en).join(' ');
      expect(combinedSentences).toContain('Apache Kafka and RabbitMQ');
      expect(combinedSentences).toContain('centralized logging aggregators');
    });

    it('Bài 3: sentences phải chứa đầy đủ câu về load balancing và circuit breaker đã bổ sung', () => {
      const lesson3 = LISTENING_LESSONS.find((l) => l.id === 'listen_3')!;
      expect(lesson3).toBeDefined();

      const combinedSentences = lesson3.sentences.map((s) => s.en).join(' ');
      expect(combinedSentences).toContain('load balancing algorithms, database replication lag mitigation, and circuit breaker patterns');
    });

    it('Bài 4: audioText không được chứa ký tự backticks markdown', () => {
      const lesson4 = LISTENING_LESSONS.find((l) => l.id === 'listen_4')!;
      expect(lesson4).toBeDefined();
      expect(lesson4.audioText).not.toContain('`');
    });

    it('Toàn bộ 4 bài nghe phải có đúng 4 options và correctIndex hợp lệ (0..3)', () => {
      for (const lesson of LISTENING_LESSONS) {
        for (const q of lesson.questions) {
          expect(q.options.length).toBe(4);
          expect(q.correctIndex).toBeGreaterThanOrEqual(0);
          expect(q.correctIndex).toBeLessThan(4);
          expect(q.explanation.trim().length).toBeGreaterThan(0);
        }
      }
    });
  });

  // =========================================================================
  // 5. WORD HIGHLIGHT, MODE SWITCHING & SRS CLICK-TO-TRANSLATE (PHASE 2)
  // =========================================================================
  describe('5. Word Highlight, Mode Switching & SRS Click-to-Translate Invariants (Phase 2)', () => {
    it('Mode Switcher UI: Chuyển đổi giữa Sentence và Word mode', () => {
      render(<FourSkillsView />);

      // Chọn bài nghe 1
      const lessonCard = screen.getByText('The Rise of Distributed Microservices Architecture');
      fireEvent.click(lessonCard);

      const sentenceBtn = screen.getByText('Câu (Sentence)');
      const wordBtn = screen.getByText('Từng từ (Word)');

      expect(sentenceBtn).toBeTruthy();
      expect(wordBtn).toBeTruthy();

      // Mặc định là sentence mode
      expect(sentenceBtn.className).toContain('text-cyan-300');

      // Chuyển sang word mode
      fireEvent.click(wordBtn);
      expect(wordBtn.className).toContain('text-amber-300');
    });

    it('Word Highlight khi phát audio: onboundary kích hoạt đúng token từ và bỏ highlight từ trước đó', () => {
      render(<FourSkillsView />);

      const lessonCard = screen.getByText('The Rise of Distributed Microservices Architecture');
      fireEvent.click(lessonCard);

      // Chuyển sang Word mode
      const wordBtn = screen.getByText('Từng từ (Word)');
      fireEvent.click(wordBtn);

      // Bấm Play
      const playBtn = screen.getByText('Nghe Bài Đọc');
      fireEvent.click(playBtn);

      const activeUtterance = (window as any).speechSynthesis.speak.mock.calls[0][0];

      // Kích hoạt onstart
      act(() => {
        activeUtterance.onstart?.();
      });

      // Từ đầu tiên của câu 0 ("Modern")
      const word0 = document.querySelector('[data-sentence-index="0"] [data-word-index="0"]');
      expect(word0).toBeTruthy();
      expect(word0?.classList.contains('bg-amber-400')).toBe(true);

      // onboundary tiến tới từ thứ hai ("software")
      act(() => {
        activeUtterance.onboundary?.({
          name: 'word',
          charIndex: 7, // offset của "software"
        });
      });

      const word1 = document.querySelector('[data-sentence-index="0"] [data-word-index="1"]');
      expect(word1).toBeTruthy();
      expect(word1?.classList.contains('bg-amber-400')).toBe(true);
      // Từ đầu tiên phải mất highlight
      expect(word0?.classList.contains('bg-amber-400')).toBe(false);

      // onboundary tiến tới từ thứ ba ("engineering")
      act(() => {
        activeUtterance.onboundary?.({
          name: 'word',
          charIndex: 16,
        });
      });

      const word2 = document.querySelector('[data-sentence-index="0"] [data-word-index="2"]');
      expect(word2).toBeTruthy();
      expect(word2?.classList.contains('bg-amber-400')).toBe(true);
      expect(word1?.classList.contains('bg-amber-400')).toBe(false);
    });

    it('Runtime Switching giữa Sentence và Word mode không restart audio hoặc gọi speak lại', () => {
      render(<FourSkillsView />);

      const lessonCard = screen.getByText('The Rise of Distributed Microservices Architecture');
      fireEvent.click(lessonCard);

      // Bắt đầu ở sentence mode
      const playBtn = screen.getByText('Nghe Bài Đọc');
      fireEvent.click(playBtn);

      expect((window as any).speechSynthesis.speak).toHaveBeenCalledTimes(1);

      const activeUtterance = (window as any).speechSynthesis.speak.mock.calls[0][0];
      act(() => {
        activeUtterance.onstart?.();
      });

      // Câu 0 đang active ở sentence mode (không có bg-amber-400)
      const sentence0 = document.querySelector('[data-sentence-index="0"]');
      expect(sentence0?.classList.contains('bg-cyan-500/25')).toBe(true);
      expect(document.querySelector('.bg-amber-400')).toBeNull();

      // Đổi sang Word mode giữa lúc đang phát
      const wordBtn = screen.getByText('Từng từ (Word)');
      fireEvent.click(wordBtn);

      // Không được gọi speak hay cancel lại
      expect((window as any).speechSynthesis.speak).toHaveBeenCalledTimes(1);

      // Word highlight lập tức active
      expect(document.querySelector('.bg-amber-400')).not.toBeNull();

      // Đổi lại sang Sentence mode
      const sentenceBtn = screen.getByText('Câu (Sentence)');
      fireEvent.click(sentenceBtn);

      // Vẫn không restart audio
      expect((window as any).speechSynthesis.speak).toHaveBeenCalledTimes(1);
      // Word highlight bị xóa, sentence highlight vẫn còn
      expect(document.querySelector('.bg-amber-400')).toBeNull();
      expect(document.querySelector('[data-sentence-index="0"]')).not.toBeNull();
    });

    it('Click vào từ trong transcript kích hoạt Dictionary lookup modal', () => {
      render(<FourSkillsView />);

      const lessonCard = screen.getByText('The Rise of Distributed Microservices Architecture');
      fireEvent.click(lessonCard);

      // Click vào từ "Modern" trong transcript
      const word0 = document.querySelector('[data-sentence-index="0"] [data-word-index="0"]');
      expect(word0).toBeTruthy();

      fireEvent.click(word0!);

      // Modal tra từ vựng xuất hiện
      expect(screen.getByText(/Thêm Vào Flashcard SRS/i)).toBeTruthy();
      expect(screen.getAllByText(/modern/i).length).toBeGreaterThan(0);
    });

    it('Dialogue Layout (Từng câu thoại) hỗ trợ đầy đủ tokenization và word highlight', () => {
      render(<FourSkillsView />);

      const lessonCard = screen.getByText('The Rise of Distributed Microservices Architecture');
      fireEvent.click(lessonCard);

      // Chuyển sang Dialogue mode (Từng câu thoại)
      const dialogueBtn = screen.getByText('💬 Từng câu thoại');
      fireEvent.click(dialogueBtn);

      // Chuyển sang Word highlight mode
      const wordBtn = screen.getByText('Từng từ (Word)');
      fireEvent.click(wordBtn);

      // Bấm Play
      const playBtn = screen.getByText('Nghe Bài Đọc');
      fireEvent.click(playBtn);

      const activeUtterance = (window as any).speechSynthesis.speak.mock.calls[0][0];
      act(() => {
        activeUtterance.onstart?.();
      });

      // Word 0 của sentence 0 trong dialogue view phải có highlight
      const dialogueWord0 = document.querySelector('[data-sentence-index="0"] [data-word-index="0"]');
      expect(dialogueWord0).toBeTruthy();
      expect(dialogueWord0?.classList.contains('bg-amber-400')).toBe(true);
    });
  });

  // =========================================================================
  // 6. PHASE 3: UI ACCESSIBILITY, AUTO-SCROLL & HIGHLIGHT INTERACTION
  // =========================================================================
  describe('6. Phase 3: UI Accessibility, Auto-scroll & Highlight Interaction', () => {
    it('Highlight Selector có aria-pressed, role=group và accessibility chuẩn', () => {
      render(<FourSkillsView />);

      const lessonCard = screen.getByText('The Rise of Distributed Microservices Architecture');
      fireEvent.click(lessonCard);

      const group = screen.getByRole('group', { name: /Chế độ tô sáng khi nghe/i });
      expect(group).toBeTruthy();

      const sentenceBtn = screen.getByRole('button', { name: /Câu \(Sentence\)/i });
      const wordBtn = screen.getByRole('button', { name: /Từng từ \(Word\)/i });

      expect(sentenceBtn.getAttribute('aria-pressed')).toBe('true');
      expect(wordBtn.getAttribute('aria-pressed')).toBe('false');

      fireEvent.click(wordBtn);
      expect(sentenceBtn.getAttribute('aria-pressed')).toBe('false');
      expect(wordBtn.getAttribute('aria-pressed')).toBe('true');
    });

    it('Tương tác trực tiếp trên từ đang highlight: Click từ đang active vẫn mở modal và thêm được vào Flashcard SRS', () => {
      render(<FourSkillsView />);

      const lessonCard = screen.getByText('The Rise of Distributed Microservices Architecture');
      fireEvent.click(lessonCard);

      // Chuyển sang Word mode và Play
      const wordBtn = screen.getByText('Từng từ (Word)');
      fireEvent.click(wordBtn);

      const playBtn = screen.getByText('Nghe Bài Đọc');
      fireEvent.click(playBtn);

      const activeUtterance = (window as any).speechSynthesis.speak.mock.calls[0][0];
      act(() => {
        activeUtterance.onstart?.();
      });

      // Từ "Modern" (word 0) đang active có highlight bg-amber-400
      const activeWordEl = document.querySelector('[data-sentence-index="0"] [data-word-index="0"]');
      expect(activeWordEl?.classList.contains('bg-amber-400')).toBe(true);

      // Click trực tiếp vào từ đang highlight
      fireEvent.click(activeWordEl!);

      // Modal tra từ mở thành công
      const addToSrsBtn = screen.getByText(/Thêm Vào Flashcard SRS/i);
      expect(addToSrsBtn).toBeTruthy();

      // Bấm thêm vào SRS
      fireEvent.click(addToSrsBtn);

      // Verify: Từ được lưu vào SRS store và hiển thị thông báo thành công
      expect(screen.getByText(/Đã Thêm Vào SRS!/i)).toBeTruthy();
      const state = useAppStore.getState();
      expect(Object.keys(state.srsProgressMap).length).toBeGreaterThan(0);
      expect(state.vocabularyList.some((v) => v.word.toLowerCase() === 'modern')).toBe(true);
    });

    it('Auto-scroll gọi scrollIntoView với block: nearest khi playback chuyển câu', () => {
      const mockScrollIntoView = vi.fn();
      Element.prototype.scrollIntoView = mockScrollIntoView;

      render(<FourSkillsView />);

      const lessonCard = screen.getByText('The Rise of Distributed Microservices Architecture');
      fireEvent.click(lessonCard);

      const playBtn = screen.getByText('Nghe Bài Đọc');
      fireEvent.click(playBtn);

      const activeUtterance = (window as any).speechSynthesis.speak.mock.calls[0][0];
      act(() => {
        activeUtterance.onstart?.();
      });

      // Khi bắt đầu câu 0: scrollIntoView được gọi để đảm bảo câu 0 visible
      expect(mockScrollIntoView).toHaveBeenCalledWith(
        expect.objectContaining({ block: 'nearest', behavior: 'smooth' })
      );

      mockScrollIntoView.mockClear();

      // Chuyển sang câu 1
      act(() => {
        activeUtterance.onboundary?.({
          name: 'sentence',
          charIndex: 250, // offset của câu tiếp theo
        });
      });

      // scrollIntoView được gọi cho câu 1 với block: nearest
      expect(mockScrollIntoView).toHaveBeenCalledWith(
        expect.objectContaining({ block: 'nearest', behavior: 'smooth' })
      );
    });
  });
});
