// src/components/__tests__/toeicListeningPolicyAndResume.test.tsx
// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { ToeicAssessmentView } from '../ToeicAssessmentView';
import { ToeicListeningEngine } from '../../services/toeicListeningEngine';
import {
  DEFAULT_LISTENING_POLICIES,
  createListeningPlaybackPolicyFromExperience,
  NormalizedToeicListeningGroup,
} from '../../types/toeicListening';
import {
  createNewAttemptSnapshot,
  restoreSnapshotFromMeta,
  saveInProgressAttempt,
  getInProgressAttempt,
  clearInProgressAttempt,
} from '../../services/toeicAttemptManager';
import { getExperienceConfig } from '../../types';

vi.mock('../../utils/confettiPolicy', () => ({
  triggerCelebration: vi.fn(),
}));

// Mock Web Speech API & Audio
class MockAudioElement {
  src = '';
  currentTime = 0;
  duration = 30;
  playbackRate = 1.0;
  volume = 1.0;
  paused = true;
  ended = false;
  private listeners: Record<string, Function[]> = {};

  constructor(src = '') {
    this.src = src;
  }

  addEventListener(event: string, fn: Function) {
    if (!this.listeners[event]) this.listeners[event] = [];
    this.listeners[event].push(fn);
  }

  removeEventListener(event: string, fn: Function) {
    if (!this.listeners[event]) return;
    this.listeners[event] = this.listeners[event].filter((cb) => cb !== fn);
  }

  emit(event: string, data?: any) {
    const fns = [...(this.listeners[event] || [])];
    fns.forEach((fn) => fn(data || new Event(event)));
  }

  play = vi.fn().mockImplementation(() => {
    this.paused = false;
    this.emit('play');
    return Promise.resolve();
  });

  pause = vi.fn().mockImplementation(() => {
    this.paused = true;
    this.emit('pause');
  });

  load = vi.fn();
}

class MockSpeechSynthesisUtterance {
  text: string;
  lang = 'en-US';
  rate = 1.0;
  pitch = 1.0;
  volume = 1.0;
  onstart: ((ev: any) => void) | null = null;
  onend: ((ev: any) => void) | null = null;
  onerror: ((ev: any) => void) | null = null;

  constructor(text = '') {
    this.text = text;
  }
}

const mockSpeechSynthesis = {
  speaking: false,
  pending: false,
  paused: false,
  speak: vi.fn().mockImplementation((utterance: MockSpeechSynthesisUtterance) => {
    mockSpeechSynthesis.speaking = true;
    setTimeout(() => {
      if (utterance.onstart) utterance.onstart({} as any);
    }, 0);
  }),
  cancel: vi.fn().mockImplementation(() => {
    mockSpeechSynthesis.speaking = false;
  }),
  pause: vi.fn(),
  resume: vi.fn(),
  getVoices: vi.fn().mockReturnValue([
    { name: 'Google US English', lang: 'en-US', default: true },
    { name: 'Google UK English Female', lang: 'en-GB', default: false },
  ]),
};

const samplePracticeGroup: NormalizedToeicListeningGroup = {
  id: 'grp_p3_test',
  audioGroupId: 'audio_p3_test',
  part: 'part3_conv',
  audioSource: {
    sourceType: 'recorded',
    audioUrl: 'https://cdn.example.com/p3.mp3',
    accent: 'en-US',
    durationMs: 25000,
    isFallback: false,
  },
  transcript: {
    fullText: 'Man: Hello Lisa. Woman: Hi John, the invoice is ready.',
    hasTiming: true,
    segments: [
      { id: 's1', speaker: 'Man', text: 'Hello Lisa.', startMs: 0, endMs: 5000 },
      { id: 's2', speaker: 'Woman', text: 'Hi John, the invoice is ready.', startMs: 5500, endMs: 12000 },
    ],
  },
  questionIds: ['q1', 'q2'],
};

describe('PHASE 6: Practice/Mock Policy Hardening + TOEIC Resume/Snapshot Safety', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.clearAllMocks();

    (window as any).Audio = MockAudioElement as any;
    Object.defineProperty(window, 'speechSynthesis', {
      value: mockSpeechSynthesis,
      writable: true,
      configurable: true,
    });
    (window as any).SpeechSynthesisUtterance = MockSpeechSynthesisUtterance;
  });

  afterEach(() => {
    cleanup();
    localStorage.clear();
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  // ===========================================================================
  // 1. CENTRAL POLICY ENFORCEMENT & HARDENING
  // ===========================================================================
  describe('1. Central Policy Derivation & Behavior Enforcement', () => {
    it('Chế độ Practice sinh policy mở: transcript, seek, speed, replay đều được cho phép', () => {
      const practiceConfig = getExperienceConfig('practice');
      const policy = createListeningPlaybackPolicyFromExperience(practiceConfig, 'practice');

      expect(policy.mode).toBe('practice');
      expect(policy.maxPlayCount).toBe(Infinity);
      expect(policy.allowReplay).toBe(true);
      expect(policy.allowSeek).toBe(true);
      expect(policy.allowSpeedControl).toBe(true);
      expect(policy.showTranscript).toBe(true);
      expect(policy.showHighlight).toBe(true);
    });

    it('Chế độ Mock sinh policy nghiêm ngặt chuẩn ETS: maxPlayCount=1, seek/speed/replay/transcript đều bị khóa', () => {
      const mockConfig = getExperienceConfig('mock');
      const policy = createListeningPlaybackPolicyFromExperience(mockConfig, 'mock');

      expect(policy.mode).toBe('mock');
      expect(policy.maxPlayCount).toBe(1);
      expect(policy.allowReplay).toBe(false);
      expect(policy.allowSeek).toBe(false);
      expect(policy.allowSpeedControl).toBe(false);
      expect(policy.showTranscript).toBe(false);
      expect(policy.showHighlight).toBe(false);
    });

    it('ToeicListeningEngine từ chối seek và thay đổi tốc độ ở behavior layer khi ở Mock mode', () => {
      const fakeAudio = new MockAudioElement();
      const engine = new ToeicListeningEngine({ audioFactory: () => fakeAudio as any });

      engine.loadGroup(samplePracticeGroup, DEFAULT_LISTENING_POLICIES.mock);
      fakeAudio.emit('canplay');

      // Thử seek trong Mock mode
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      engine.seek(5000);
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Seek rejected by Policy'));
      expect(fakeAudio.currentTime).toBe(0);

      // Thử đổi tốc độ trong Mock mode
      engine.setPlaybackRate(1.25);
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Speed change rejected by Policy'));
      expect(engine.getState().playbackRate).toBe(1.0);

      engine.dispose();
    });
  });

  // ===========================================================================
  // 2. DOM LEAKAGE & ACCESSIBILITY AUDIT IN MOCK MODE
  // ===========================================================================
  describe('2. Zero DOM Leakage & Accessibility Tree Protection in Mock Mode', () => {
    it('Mock Mode: Hoàn toàn không render thẻ transcript hay nút toggle kịch bản trong DOM', () => {
      render(<ToeicAssessmentView />);
      fireEvent.click(screen.getByText(/Mini-Test/i)); // Mini-Test mặc định ở Mock Mode

      // Không có bất kỳ nút Xem Script nào
      expect(screen.queryByTitle(/Xem kịch bản nghe audio/i)).toBeNull();
      expect(screen.queryByTitle(/Xem lời thoại kịch bản/i)).toBeNull();
      expect(screen.queryByText(/Kịch Bản Audio/i)).toBeNull();
      expect(screen.queryByTestId('group-transcript-container')).toBeNull();

      // Không có text transcript nào bị CSS ẩn hay lọt vào DOM
      expect(screen.queryByText(/Look at the picture/i)).toBeNull();
    });

    it('Mock Mode: Không render trước đáp án hay giải thích trước khi nộp bài', () => {
      render(<ToeicAssessmentView />);
      fireEvent.click(screen.getByText(/Mini-Test/i));

      // Không hiển thị giải thích
      expect(screen.queryByText(/💡 Giải Thích Chi Tiết/i)).toBeNull();
      expect(screen.queryByText(/Chính Xác!/i)).toBeNull();
      expect(screen.queryByText(/Chưa Chính Xác/i)).toBeNull();
    });
  });

  // ===========================================================================
  // 3. PRACTICE -> MOCK STATE LEAKAGE MITIGATION
  // ===========================================================================
  describe('3. Practice to Mock State Isolation', () => {
    it('Chuyển đổi runtime policy qua setPolicy xóa sạch active highlight và khóa seek', async () => {
      const fakeAudio = new MockAudioElement();
      const engine = new ToeicListeningEngine({ audioFactory: () => fakeAudio as any });

      // Nạp nhóm ở Practice Mode
      engine.loadGroup(samplePracticeGroup, DEFAULT_LISTENING_POLICIES.practice);
      fakeAudio.emit('canplay');
      await engine.play();

      // Giả lập thời gian chạy đến segment 1 (Woman)
      fakeAudio.currentTime = 6.0;
      fakeAudio.emit('timeupdate');

      expect(engine.getState().activeSegmentIndex).toBe(1);
      expect(engine.getState().activeSegment).not.toBeNull();

      // Chuyển policy sang Mock Mode
      engine.setPolicy(DEFAULT_LISTENING_POLICIES.mock);

      // Highlight bị xóa sạch lập tức, không để rò rỉ vào Mock!
      expect(engine.getState().activeSegmentIndex).toBe(-1);
      expect(engine.getState().activeSegment).toBeNull();
      expect(engine.getState().isEligibleToPlay).toBe(false); // đã play 1 lần, trong mock max=1 -> ineligible

      engine.dispose();
    });
  });

  // ===========================================================================
  // 4. RESUME MOCK ATTEMPT & F5 REPLAY EXPLOIT DEFENSE
  // ===========================================================================
  describe('4. Resume Mock Attempt & F5 Replay Exploit Defense', () => {
    it('Khôi phục cùng attempt: giữ nguyên questionIds, groupIds, audio identity', () => {
      const { snapshot, meta } = createNewAttemptSnapshot(
        {
          mode: '2skills_mini',
          experienceMode: 'mock',
          skillScope: '2-skills',
        },
        42
      );

      // Lưu checkpoint
      saveInProgressAttempt({
        stage: 'testing',
        attemptId: meta.attemptId,
        snapshotMeta: meta,
        examMode: '2skills_mini',
        experienceMode: 'mock',
        skillScope: '2-skills',
        currentQuestionIdx: 2,
        userAnswers: { [meta.questionIds[0]]: 'A' },
        firstAttemptAnswers: {},
        bookmarkedQuestions: {},
        retryCountMap: {},
        masteredRetryMap: {},
        speakingTranscript: '',
        writingInput: '',
        audioPlayedMap: { [meta.questionIds[0]]: true },
        timeLeft: 540,
        savedAt: Date.now(),
        isPaused: false,
      });

      // Tái nạp từ meta
      const restored = restoreSnapshotFromMeta(meta);

      expect(restored.isFullyRestored).toBe(true);
      expect(restored.snapshot.questions.map((q) => q.id)).toEqual(snapshot.questions.map((q) => q.id));
      expect(restored.snapshot.groups.map((g) => g.id)).toEqual(snapshot.groups.map((g) => g.id));
      expect(restored.snapshot.seed).toBe(snapshot.seed);
    });

    it('F5 Replay Exploit Defense: Nhóm audio đã phát trong Mock không thể nghe lại sau khi reload', async () => {
      const { meta } = createNewAttemptSnapshot(
        {
          mode: '2skills_mini',
          experienceMode: 'mock',
          skillScope: '2-skills',
        },
        99
      );

      const firstQId = meta.questionIds[0];
      const firstGId = meta.groupIds[0] || `grp_${firstQId}`;

      // Giả lập trạng thái trước khi F5: thí sinh đã nghe câu 1 trong Mock
      saveInProgressAttempt({
        stage: 'testing',
        attemptId: meta.attemptId,
        snapshotMeta: meta,
        examMode: '2skills_mini',
        experienceMode: 'mock',
        skillScope: '2-skills',
        currentQuestionIdx: 0,
        userAnswers: {},
        firstAttemptAnswers: {},
        bookmarkedQuestions: {},
        retryCountMap: {},
        masteredRetryMap: {},
        speakingTranscript: '',
        writingInput: '',
        audioPlayedMap: {
          [firstQId]: true,
          [firstGId]: true,
        },
        timeLeft: 500,
        savedAt: Date.now(),
        isPaused: false,
      });

      // Render ToeicAssessmentView (mô phỏng load sau F5)
      render(<ToeicAssessmentView />);

      // Thí sinh click nút "Tiếp Tục Làm Bài" trên resume banner
      const resumeBtn = screen.getByTestId('btn-resume-toeic');
      expect(resumeBtn).toBeTruthy();
      fireEvent.click(resumeBtn);

      // Nút phát audio của câu 1 phải lập tức bị vô hiệu hóa với nhãn "Đã phát (1 lần)"
      await waitFor(() => {
        const disabledPlayBtn = screen.getByRole('button', { name: /Đã phát \(1 lần\)/i });
        expect(disabledPlayBtn).toBeTruthy();
        expect(disabledPlayBtn.hasAttribute('disabled')).toBe(true);
      });
    });

    it('Giữ nguyên đáp án đã chọn và timer sau khi khôi phục bài thi', async () => {
      const { meta } = createNewAttemptSnapshot(
        {
          mode: '2skills_mini',
          experienceMode: 'mock',
          skillScope: '2-skills',
        },
        101
      );

      const firstQId = meta.questionIds[0];

      saveInProgressAttempt({
        stage: 'testing',
        attemptId: meta.attemptId,
        snapshotMeta: meta,
        examMode: '2skills_mini',
        experienceMode: 'mock',
        skillScope: '2-skills',
        currentQuestionIdx: 0,
        userAnswers: { [firstQId]: 'C' },
        firstAttemptAnswers: {},
        bookmarkedQuestions: {},
        retryCountMap: {},
        masteredRetryMap: {},
        speakingTranscript: '',
        writingInput: '',
        audioPlayedMap: {},
        timeLeft: 480, // 08:00
        savedAt: Date.now(),
        isPaused: true, // paused so elapsed time is not subtracted
      });

      render(<ToeicAssessmentView />);

      // Thí sinh click nút "Tiếp Tục Làm Bài"
      const resumeBtn = screen.getByTestId('btn-resume-toeic');
      expect(resumeBtn).toBeTruthy();
      fireEvent.click(resumeBtn);

      await waitFor(() => {
        // Timer được phục hồi về 08:00
        expect(screen.getByText('08:00')).toBeTruthy();
        // Đáp án 'C' đã được lưu
        const buttons = screen.getAllByRole('button');
        const choiceC = buttons.find((b) => b.textContent?.includes('(C)'));
        expect(choiceC?.textContent).toContain('Đã Chọn');
      });
    });
  });

  // ===========================================================================
  // 5. CONTINUITY CLEANUP & COMPLETION INTEGRITY
  // ===========================================================================
  describe('5. Continuity Lifecycle Cleanup', () => {
    it('Nộp bài thi dọn dẹp sạch sẽ checkpoint in-progress và đánh dấu completed', async () => {
      render(<ToeicAssessmentView />);
      fireEvent.click(screen.getByText(/Mini-Test/i));

      // Nộp bài
      const submitBtn = screen.getByRole('button', { name: /Nộp Bài/i });
      fireEvent.click(submitBtn);

      const confirmBtn = screen.getByRole('button', { name: /Xác Nhận Nộp Bài/i });
      fireEvent.click(confirmBtn);

      await waitFor(() => {
        expect(screen.getByText(/Kết Quả Khảo Sát Năng Lực TOEIC/i)).toBeTruthy();
      });

      // Checkpoint in-progress trong session đã được dọn sạch
      const inProgress = getInProgressAttempt();
      expect(inProgress).toBeNull();
    });

    it('Hủy bài thi (Discard) dọn sạch bộ nhớ tạm và không tạo bài nộp rác', () => {
      saveInProgressAttempt({
        stage: 'testing',
        attemptId: 'temp_to_discard',
        examMode: '2skills_mini',
        currentQuestionIdx: 0,
        userAnswers: {},
        firstAttemptAnswers: {},
        bookmarkedQuestions: {},
        retryCountMap: {},
        masteredRetryMap: {},
        speakingTranscript: '',
        writingInput: '',
        audioPlayedMap: {},
        timeLeft: 600,
        savedAt: Date.now(),
      });

      clearInProgressAttempt();
      expect(getInProgressAttempt()).toBeNull();
    });
  });
});
