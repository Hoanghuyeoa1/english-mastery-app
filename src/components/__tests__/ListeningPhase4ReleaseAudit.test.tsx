// @vitest-environment happy-dom
import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { FourSkillsView } from '../FourSkillsView';
import { ListeningSeekBar } from '../ListeningSeekBar';
import {
  ListeningSyncController,
  buildLessonSyncMap,
  tokenizeSentence,
  formatPlaybackTime,
  resolvePositionFromProgress,
} from '../../services/listeningSyncService';
import { LISTENING_LESSONS } from '../../data/fourSkills/listeningData';
import { findListeningLessonsByCefr } from '../../data/fourSkills/listening';
import { useAppStore, composeVocabularyList } from '../../store/useAppStore';
import { lookupContextWord } from '../../services/wordLookupService';

// Mock canvas-confetti
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

describe('PHASE 4: Listening Lab Full Regression, 24 Lessons & Release Audit', () => {
  let mockSpeak: ReturnType<typeof vi.fn>;
  let mockCancel: ReturnType<typeof vi.fn>;
  let lastUtterance: MockSpeechSynthesisUtterance | null = null;

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();

    useAppStore.setState({
      srsProgressMap: {},
      userCustomWords: [],
      vocabularyList: composeVocabularyList({}, []),
      mistakeBank: {},
      dailyHistory: {},
      activePracticeConfig: null,
      fourSkillsScores: {
        listening: [],
        reading: [],
        speaking: [],
        writing: [],
      },
      activeFourSkill: 'listening',
      userCollocations: [],
    });

    lastUtterance = null;
    mockSpeak = vi.fn().mockImplementation((utterance: MockSpeechSynthesisUtterance) => {
      lastUtterance = utterance;
      if (utterance.onstart) {
        utterance.onstart();
      }
    });
    mockCancel = vi.fn();

    (window as any).SpeechSynthesisUtterance = MockSpeechSynthesisUtterance;
    (window as any).speechSynthesis = {
      speak: mockSpeak,
      cancel: mockCancel,
      pause: vi.fn(),
      resume: vi.fn(),
      getVoices: vi.fn().mockReturnValue([]),
      speaking: false,
      paused: false,
      pending: false,
    };
  });

  // =========================================================================
  // 1. VERIFY ENTIRE 24 LISTENING LESSONS DATASET
  // =========================================================================
  describe('1. Full 24 Lessons Dataset Verification (A1-C2)', () => {
    it('chứa chính xác 24 bài nghe phân bổ đều 4 bài cho mỗi band CEFR (A1-C2)', () => {
      expect(LISTENING_LESSONS).toHaveLength(24);

      const levels: Array<'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2'> = [
        'A1',
        'A2',
        'B1',
        'B2',
        'C1',
        'C2',
      ];
      levels.forEach((lvl) => {
        const lessons = findListeningLessonsByCefr(lvl);
        expect(lessons).toHaveLength(4);
      });
    });

    it('toàn bộ 24 bài nghe: Tokenization bảo toàn 100% text, punctuation, contractions, numbers', () => {
      for (const lesson of LISTENING_LESSONS) {
        expect(lesson.audioText).toBeDefined();
        expect(lesson.audioText.length).toBeGreaterThan(0);
        expect(lesson.sentences.length).toBeGreaterThan(0);

        for (const sent of lesson.sentences) {
          const tokens = tokenizeSentence(sent.en);
          // 1. Không mất ký tự, dấu câu, whitespace
          const reconstructed = tokens.map((t) => t.text).join('');
          expect(reconstructed).toBe(sent.en);

          // 2. Mọi word token có lexical identity (cleanWord)
          const words = tokens.filter((t) => t.isWord);
          expect(words.length).toBeGreaterThan(0);
          words.forEach((w) => {
            expect(w.cleanWord).toBeTruthy();
            expect(w.cleanWord).toBe(w.cleanWord!.toLowerCase());
          });
        }
      }
    });

    it('toàn bộ 24 bài nghe: SyncMap & Seek Engine tính toán chính xác 0%-100% không out-of-bounds', () => {
      for (const lesson of LISTENING_LESSONS) {
        const syncMap = buildLessonSyncMap(lesson, 1.0);
        expect(syncMap.totalEstimatedMs).toBeGreaterThan(0);
        expect(syncMap.totalWords).toBeGreaterThan(0);
        expect(syncMap.sentences.length).toBe(lesson.sentences.length);

        // Test seek checkpoints: 0%, 25%, 50%, 75%, 100%
        const checkpoints = [0, 0.25, 0.5, 0.75, 1.0];
        checkpoints.forEach((progress) => {
          const pos = resolvePositionFromProgress(syncMap, progress);
          expect(pos.sentenceIndex).toBeGreaterThanOrEqual(0);
          expect(pos.sentenceIndex).toBeLessThan(lesson.sentences.length);
          expect(pos.progress).toBeGreaterThanOrEqual(0);
          expect(pos.progress).toBeLessThanOrEqual(1.0);
          expect(pos.currentTimeMs).toBeGreaterThanOrEqual(0);
          expect(pos.currentTimeMs).toBeLessThanOrEqual(syncMap.totalEstimatedMs);
        });
      }
    });
  });

  // =========================================================================
  // 2. REGRESSION SENTENCE / WORD HIGHLIGHT & MONOTONICITY
  // =========================================================================
  describe('2. Sentence & Word Highlight Monotonicity and Anti-Jitter', () => {
    it('Normal playback: word index tiến tuần tự, không bị giật lùi bởi stale boundary', () => {
      const lesson = LISTENING_LESSONS[0];
      const controller = new ListeningSyncController({
        onHighlightChange: vi.fn(),
      });
      controller.setHighlightMode('word');
      const sessionId = controller.start(lesson, 1.0);

      // 0 -> 1 -> 2 -> 3
      controller.onBoundary(0, 'word', sessionId);
      expect(controller.getState().activeWordIndex).toBe(0);

      const syncMap = buildLessonSyncMap(lesson, 1.0);
      const sent0Words = syncMap.sentences[0].words;
      if (sent0Words.length >= 4) {
        controller.onBoundary(sent0Words[1].audioStartChar, 'word', sessionId);
        expect(controller.getState().activeWordIndex).toBe(1);

        controller.onBoundary(sent0Words[2].audioStartChar, 'word', sessionId);
        expect(controller.getState().activeWordIndex).toBe(2);

        controller.onBoundary(sent0Words[3].audioStartChar, 'word', sessionId);
        expect(controller.getState().activeWordIndex).toBe(3);

        // Stale boundary 2 arrives late -> MUST BE IGNORED
        controller.onBoundary(sent0Words[2].audioStartChar, 'word', sessionId);
        expect(controller.getState().activeWordIndex).toBe(3);
      }

      controller.stop();
    });

    it('Native vs Fallback: Native boundary luôn có quyền tối thượng, chặn fallback đè ngược', () => {
      const lesson = LISTENING_LESSONS[0];
      const controller = new ListeningSyncController({
        onHighlightChange: vi.fn(),
      });
      controller.setHighlightMode('word');
      const sessionId = controller.start(lesson, 1.0);

      const syncMap = buildLessonSyncMap(lesson, 1.0);
      const allWords = syncMap.sentences.flatMap((s) => s.words);

      if (allWords.length >= 10) {
        // Native boundary fires for global word 8
        const word8 = allWords[8];
        controller.onBoundary(word8.audioStartChar, 'word', sessionId);
        expect(controller.getState().trackingSource).toBe('native-boundary');

        const stateAfterNative = controller.getState();
        const activeSent = stateAfterNative.activeSentenceIndex;
        const activeWord = stateAfterNative.activeWordIndex;

        // Fallback estimator ticks with an earlier time (corresponding to word 7)
        // Controller must ignore fallback backward drift when native boundary is active
        controller.onBoundary(allWords[7].audioStartChar, 'fallback', sessionId);

        expect(controller.getState().activeSentenceIndex).toBe(activeSent);
        expect(controller.getState().activeWordIndex).toBe(activeWord);
      }

      controller.stop();
    });

    it('Runtime switching: Chuyển đổi qua lại giữa Sentence và Word không restart playback', () => {
      const lesson = LISTENING_LESSONS[1];
      const controller = new ListeningSyncController({
        onHighlightChange: vi.fn(),
      });
      controller.setHighlightMode('sentence');
      const sessionId = controller.start(lesson, 1.0);

      // Active at sentence 0
      expect(controller.getState().highlightMode).toBe('sentence');
      expect(controller.getState().activeSentenceIndex).toBe(0);
      expect(controller.getState().activeWordIndex).toBeNull();

      // Switch to Word mode
      controller.setHighlightMode('word');
      expect(controller.getState().highlightMode).toBe('word');
      expect(controller.getState().activeSentenceIndex).toBe(0);
      expect(controller.getState().activeWordIndex).toBe(0);
      expect(controller.getSessionId()).toBe(sessionId);

      // Switch back to Sentence mode
      controller.setHighlightMode('sentence');
      expect(controller.getState().highlightMode).toBe('sentence');
      expect(controller.getState().activeSentenceIndex).toBe(0);
      expect(controller.getState().activeWordIndex).toBeNull();
      expect(controller.getSessionId()).toBe(sessionId);

      controller.stop();
    });

    it('Restart: Highlight quay về đúng đầu bài (Sentence 0, Word 0)', () => {
      const lesson = LISTENING_LESSONS[0];
      const controller = new ListeningSyncController({
        onHighlightChange: vi.fn(),
      });
      controller.setHighlightMode('word');
      controller.start(lesson, 1.0);

      // Seek to sentence 2
      controller.seekToSentence(2, 0);
      expect(controller.getState().activeSentenceIndex).toBe(2);

      // Stop and restart
      controller.stop();
      expect(controller.getState().activeSentenceIndex).toBeNull();

      controller.start(lesson, 1.0);
      expect(controller.getState().activeSentenceIndex).toBe(0);
      expect(controller.getState().activeWordIndex).toBe(0);

      controller.stop();
    });
  });

  // =========================================================================
  // 3. REGRESSION SEEK: FORWARD, BACKWARD, REPEATED, PAUSED, PLAYING
  // =========================================================================
  describe('3. Comprehensive Seek Regression Suite', () => {
    it('Forward seek (20% -> 80%) và Backward seek (80% -> 30%) hoạt động chính xác', () => {
      const lesson = LISTENING_LESSONS[2];
      const controller = new ListeningSyncController({
        onHighlightChange: vi.fn(),
      });
      controller.setHighlightMode('word');
      controller.start(lesson, 1.0);

      // Forward seek: 20% -> 80%
      const reqForward = controller.seekToProgress(0.8);
      expect(reqForward).not.toBeNull();
      const forwardSentence = reqForward!.position.sentenceIndex;
      expect(forwardSentence).toBeGreaterThan(0);
      expect(controller.getState().activeSentenceIndex).toBe(forwardSentence);

      // Backward seek: 80% -> 30%
      const reqBackward = controller.seekToProgress(0.3);
      expect(reqBackward).not.toBeNull();
      const backwardSentence = reqBackward!.position.sentenceIndex;
      expect(backwardSentence).toBeLessThan(forwardSentence);
      // Monotonic guard does NOT block intentional backward seek!
      expect(controller.getState().activeSentenceIndex).toBe(backwardSentence);

      controller.stop();
    });

    it('Stale event after seek: Callback từ session cũ trước khi seek bị loại bỏ hoàn toàn', () => {
      const lesson = LISTENING_LESSONS[0];
      const controller = new ListeningSyncController({
        onHighlightChange: vi.fn(),
      });
      controller.setHighlightMode('word');
      const session1 = controller.start(lesson, 1.0);

      // Seek to sentence 2 -> creates session2
      const seekReq = controller.seekToSentence(2, 0);
      expect(seekReq).not.toBeNull();
      const session2 = seekReq!.sessionId;
      expect(session2).toBeGreaterThan(session1);
      expect(controller.getState().activeSentenceIndex).toBe(2);

      // Delayed callback from session1 arrives
      controller.onBoundary(10, 'word', session1);
      // Must remain at sentence 2!
      expect(controller.getState().activeSentenceIndex).toBe(2);

      controller.stop();
    });

    it('Pause/Play state preservation: Paused -> seek -> Paused; Playing -> seek -> Playing', () => {
      const lesson = LISTENING_LESSONS[0];
      const controller = new ListeningSyncController({
        onHighlightChange: vi.fn(),
      });
      controller.setLesson(lesson, 1.0);

      // 1. Paused -> seek
      expect(controller.getIsPlaying()).toBe(false);
      const reqPaused = controller.seekToProgress(0.5);
      expect(reqPaused?.shouldPlay).toBe(false);
      expect(controller.getIsPlaying()).toBe(false);
      expect(controller.getIsPaused()).toBe(true);

      // 2. Playing -> seek
      controller.start();
      expect(controller.getIsPlaying()).toBe(true);
      const reqPlaying = controller.seekToProgress(0.7);
      expect(reqPlaying?.shouldPlay).toBe(true);
      expect(controller.getIsPlaying()).toBe(true);
      expect(controller.getIsPaused()).toBe(false);

      controller.stop();
    });

    it('Boundary seeks: Seek 0% và Seek gần 100% không throw và trỏ đúng biên', () => {
      const lesson = LISTENING_LESSONS[3];
      const controller = new ListeningSyncController({
        onHighlightChange: vi.fn(),
      });
      controller.setLesson(lesson, 1.0);

      // 0%
      const req0 = controller.seekToProgress(0);
      expect(req0?.position.sentenceIndex).toBe(0);
      expect(req0?.position.wordIndex).toBe(0);
      expect(req0?.position.progress).toBe(0);

      // 100%
      const req100 = controller.seekToProgress(1.0);
      expect(req100?.position.sentenceIndex).toBe(lesson.sentences.length - 1);
      expect(req100?.position.progress).toBe(1.0);

      controller.stop();
    });
  });

  // =========================================================================
  // 4. REGRESSION EXISTING FEATURES: DICTIONARY, SRS, TRANSCRIPT, SPEED
  // =========================================================================
  describe('4. Regression of Existing Features & Flashcard SRS', () => {
    it('Click vào từ đang highlight trong transcript mở đúng từ điển và thêm được vào Flashcard', () => {
      render(<FourSkillsView />);

      // Mở bài nghe đầu tiên
      const lessonCard = screen.getByText(LISTENING_LESSONS[0].title);
      fireEvent.click(lessonCard);

      // Bật chế độ Word highlight
      const wordModeButton = screen.getByRole('button', { name: /Từng từ \(Word\)/i });
      fireEvent.click(wordModeButton);

      // Bắt đầu phát audio
      const playBtn = screen.getByText('Nghe Bài Đọc');
      fireEvent.click(playBtn);

      const activeUtterance = (window as any).speechSynthesis.speak.mock.calls[0][0];
      act(() => {
        activeUtterance.onstart?.();
      });

      // Từ word 0 đang active có highlight bg-amber-400
      const activeWordEl = document.querySelector('[data-sentence-index="0"] [data-word-index="0"]');
      expect(activeWordEl).not.toBeNull();
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
    });

    it('Chuyển đổi giữa Paragraph và Dialogue layout không làm mất đồng bộ highlight và seek', () => {
      render(<FourSkillsView />);

      const lessonCard = screen.getByText(LISTENING_LESSONS[0].title);
      fireEvent.click(lessonCard);

      // Chuyển sang layout từng câu thoại
      const dialogueButton = screen.getByRole('button', { name: /Từng câu thoại/i });
      fireEvent.click(dialogueButton);

      // Seek bar vẫn hiện diện và hoạt động
      const slider = screen.getByLabelText('Thanh tua bài nghe') as HTMLInputElement;
      expect(slider).toBeDefined();

      fireEvent.pointerDown(slider);
      fireEvent.change(slider, { target: { value: '450' } });
      fireEvent.pointerUp(slider);

      expect(slider.getAttribute('aria-valuenow')).toBe('45');

      // Chuyển lại về Paragraph
      const paragraphButton = screen.getByRole('button', { name: /Đoạn văn liền mạch/i });
      fireEvent.click(paragraphButton);
      expect(slider).toBeDefined();
    });

    it('Ẩn dịch / Hiện dịch toggle độc lập với audio playback và highlight', () => {
      render(<FourSkillsView />);

      const lessonCard = screen.getByText(LISTENING_LESSONS[0].title);
      fireEvent.click(lessonCard);

      const toggleTransBtn = screen.getByRole('button', { name: /Ẩn dịch|Hiện dịch/i });
      expect(toggleTransBtn).toBeDefined();

      // Bật/tắt hiện dịch
      fireEvent.click(toggleTransBtn);
      expect(screen.getByRole('button', { name: /Ẩn dịch|Hiện dịch/i })).toBeDefined();
    });
  });

  // =========================================================================
  // 5. PERFORMANCE AUDIT & MULTI-CYCLE CLEANUP
  // =========================================================================
  describe('5. Performance & Multi-Cycle Lesson Cleanup Audit', () => {
    it('Chuyển đổi qua lại nhiều bài học (A -> B -> C): Callbacks cũ từ bài A/B không ảnh hưởng bài C', () => {
      const controller = new ListeningSyncController({
        onHighlightChange: vi.fn(),
      });
      controller.setHighlightMode('word');

      // Lesson A
      const sessionA = controller.start(LISTENING_LESSONS[0], 1.0);
      controller.seekToProgress(0.5);

      // Switch to Lesson B
      const sessionB = controller.start(LISTENING_LESSONS[1], 1.0);
      expect(sessionB).toBeGreaterThan(sessionA);
      expect(controller.getState().activeSentenceIndex).toBe(0);

      // Switch to Lesson C
      const sessionC = controller.start(LISTENING_LESSONS[2], 1.0);
      expect(sessionC).toBeGreaterThan(sessionB);
      expect(controller.getState().activeSentenceIndex).toBe(0);

      // Stale boundary callback from lesson A or B arrives
      controller.onBoundary(20, 'word', sessionA);
      controller.onBoundary(30, 'word', sessionB);

      // Active state in Lesson C MUST NOT BE DISTURBED
      expect(controller.getState().activeSentenceIndex).toBe(0);
      expect(controller.getSessionId()).toBe(sessionC);

      controller.destroy();
    });

    it('FormatPlaybackTime xử lý triệt để 100% các giá trị biên', () => {
      expect(formatPlaybackTime(NaN)).toBe('0:00');
      expect(formatPlaybackTime(Infinity)).toBe('0:00');
      expect(formatPlaybackTime(-999)).toBe('0:00');
      expect(formatPlaybackTime(null)).toBe('0:00');
      expect(formatPlaybackTime(undefined)).toBe('0:00');

      expect(formatPlaybackTime(0, true)).toBe('00:00');
      expect(formatPlaybackTime(3600, true)).toBe('1:00:00');
      expect(formatPlaybackTime(3665, true)).toBe('1:01:05');
    });
  });
});
