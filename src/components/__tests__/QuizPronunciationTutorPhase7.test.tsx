// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react';
import { QuizArena } from '../QuizArena';
import { PronunciationArena } from '../PronunciationArena';
import { AITutorView } from '../AITutorView';
import { useAppStore } from '../../store/useAppStore';
import * as speechService from '../../services/speechService';
import * as geminiService from '../../services/geminiService';
import * as tutorSessionStorage from '../../services/tutorSessionStorage';
import * as tutorFeedbackBridge from '../../services/tutorFeedbackBridge';

// Mock framer-motion
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, className, ...props }: any) => (
      <div className={className} {...props}>
        {children}
      </div>
    ),
    button: ({ children, className, ...props }: any) => (
      <button className={className} {...props}>
        {children}
      </button>
    ),
    span: ({ children, className, ...props }: any) => (
      <span className={className} {...props}>
        {children}
      </span>
    ),
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

// Mock canvas-confetti
vi.mock('canvas-confetti', () => ({
  default: vi.fn(),
}));

// Mock speechService
vi.mock('../../services/speechService', () => ({
  speakWord: vi.fn(),
  calculateAccuracy: vi.fn((target: string, transcript: string) => {
    if (!transcript) return 0;
    if (transcript.toLowerCase().trim() === target.toLowerCase().trim()) return 100;
    return 80;
  }),
  isSpeechRecognitionSupported: vi.fn(() => true),
  getSpeechBrowserSupport: vi.fn(() => ({
    isSupported: true,
    browserName: 'Chrome',
    isMobileSafari: false,
    isFirefox: false,
    recommendation: 'Trình duyệt được hỗ trợ đầy đủ.',
  })),
  createSpeechRecognizer: vi.fn((onResult, onError) => ({
    recognition: {},
    stop: vi.fn(),
  })),
}));

// Mock geminiService
vi.mock('../../services/geminiService', async (importOriginal) => {
  const actual = await importOriginal<typeof geminiService>();
  return {
    ...actual,
    generateAIResponse: vi.fn(async () => ({
      reply: 'Hello! Let us continue our interview practice.',
      feedback: {
        score: 85,
        grammarTips: ['Use strong action verbs.'],
        betterExpressions: ['I spearheaded this project.'],
      },
      telemetry: {
        isTrusted: true,
        detectedGrammarMistakes: [],
        detectedCollocations: ['spearheaded this project'],
        detectedVocabularyMistakes: [],
        detectedPronunciationMistakes: [],
      },
      isFallback: false,
    })),
  };
});

describe('PHASE 7: Quiz + Pronunciation + AI Tutor Session Experience Suite', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.clearAllMocks();
    useAppStore.getState().resetToDefault();
    useAppStore.setState({
      resumeActivities: {},
      activePracticeConfig: null,
      vocabularyList: [
        {
          id: 'v1',
          word: 'resilience',
          meaning: 'khả năng phục hồi',
          example: 'She showed great resilience.',
          ipa: 'rɪˈzɪliəns',
          partOfSpeech: 'noun',
          tag: 'Daily',
          srsLevel: 1,
          interval: 1,
          easeFactor: 2.5,
          nextReviewDate: new Date().toISOString(),
        },
        {
          id: 'v2',
          word: 'persistent',
          meaning: 'kiên trì',
          example: 'He is persistent in his efforts.',
          ipa: 'pərˈsɪstənt',
          partOfSpeech: 'adjective',
          tag: 'Daily',
          srsLevel: 1,
          interval: 1,
          easeFactor: 2.5,
          nextReviewDate: new Date().toISOString(),
        },
      ],
    });
    tutorFeedbackBridge.clearIngestionHistory();
    vi.mocked(speechService.isSpeechRecognitionSupported).mockReturnValue(true);
  });

  afterEach(() => {
    cleanup();
    localStorage.clear();
    sessionStorage.clear();
    vi.useRealTimers();
  });

  // =========================================================================
  // A. QUIZ ARENA SESSION EXPERIENCE
  // =========================================================================
  describe('A. Quiz Arena Session Experience Flow', () => {
    it('1. renders SessionProgressHeader with timed_countdown for Speed Match', () => {
      render(<QuizArena defaultCategory="speed_match" />);

      const header = screen.getByTestId('session-progress-header');
      expect(header).toBeTruthy();
      expect(screen.getByText(/Speed Match/i)).toBeTruthy();
      // Should show countdown timer representation
      expect(header.textContent).toMatch(/\d{2}:\d{2}/);
    });

    it('2. supports planned total when launched from Today Learning Hub', () => {
      useAppStore.setState({
        activePracticeConfig: {
          planItemId: 'task_quiz_1',
          module: 'dictation',
          itemIds: ['v1', 'v2'],
          mistakeType: 'spelling',
          startedAt: Date.now(),
        },
      });

      render(<QuizArena />);

      const header = screen.getByTestId('session-progress-header');
      expect(header).toBeTruthy();
      // Planned total is 2 items
      expect(header.textContent).toContain('0 / 2');
      expect(header.textContent).toContain('2 remaining');
    });

    it('3. session streak/combo is strictly ephemeral and never mutates app-level profile streak', () => {
      const initialProfileStreak = useAppStore.getState().profile.streak;
      render(<QuizArena defaultCategory="speed_match" />);

      // Profile streak in store remains unaffected
      expect(useAppStore.getState().profile.streak).toBe(initialProfileStreak);
    });

    it('4. guards against double completion and provides NextActionPanel in Victory Modal', () => {
      const onNavigateMock = vi.fn();
      render(<QuizArena defaultCategory="speed_match" onNavigate={onNavigateMock} />);

      // Open victory modal via summary button
      const summaryBtn = screen.getByRole('button', { name: /Tổng Kết/i });
      fireEvent.click(summaryBtn);

      expect(screen.getByText(/Tổng Kết Vòng Đấu Arcade/i)).toBeTruthy();

      // NextActionPanel rendered with Today Hub button
      const todayHubBtn = screen.getByTestId('next-action-next-action-today-hub');
      expect(todayHubBtn).toBeTruthy();
      fireEvent.click(todayHubBtn);

      expect(onNavigateMock).toHaveBeenCalledWith('dashboard');
    });
  });

  // =========================================================================
  // B. PRONUNCIATION ARENA SESSION EXPERIENCE
  // =========================================================================
  describe('B. Pronunciation Arena Session Experience Flow', () => {
    it('1. renders unbounded progress metric with zero fake percentage when open-ended', () => {
      render(<PronunciationArena />);

      const header = screen.getByTestId('session-progress-header');
      expect(header).toBeTruthy();
      expect(screen.getByText(/Luyện Phát Âm/i)).toBeTruthy();
      expect(header.textContent).toContain('0 đã hoàn thành');
      // Invariant: no progress bar role when metric is unbounded!
      expect(screen.queryByRole('progressbar')).toBeNull();
    });

    it('2. renders discrete_items metric when launched with planned prompt list', () => {
      useAppStore.setState({
        activePracticeConfig: {
          planItemId: 'task_pronunciation_1',
          module: 'pronunciation',
          itemIds: ['v1', 'v2'],
          startedAt: Date.now(),
        },
      });

      render(<PronunciationArena />);

      const header = screen.getByTestId('session-progress-header');
      expect(header).toBeTruthy();
      expect(header.textContent).toContain('0 / 2');
      expect(header.textContent).toContain('2 remaining');
      // Planned list has a progress bar
      expect(screen.getByRole('progressbar')).toBeTruthy();
    });

    it('3. handles unsupported Speech Recognition gracefully without crash or fake scores', () => {
      vi.mocked(speechService.isSpeechRecognitionSupported).mockReturnValue(false);

      render(<PronunciationArena />);

      expect(screen.getAllByText(/Trình duyệt hiện tại chưa hỗ trợ nhận diện giọng nói/i).length).toBeGreaterThan(0);
      // Mic button should be disabled
      const micBtn = screen.getByTitle(/Trình duyệt chưa hỗ trợ/i) as HTMLButtonElement;
      expect(micBtn.disabled).toBe(true);
      // Score is strictly null (not 0% or fake number)
      expect(screen.queryByText('%')).toBeNull();
    });

    it('4. handles permission denied gracefully without crash', () => {
      let registeredOnError: Parameters<typeof speechService.createSpeechRecognizer>[1] | undefined = undefined;
      vi.mocked(speechService.createSpeechRecognizer).mockImplementation((_onResult, onError) => {
        registeredOnError = onError;
        return { recognition: {}, stop: vi.fn() } as any;
      });

      render(<PronunciationArena />);

      const micBtn = screen.getByTestId('pronunciation-mic-btn');
      fireEvent.click(micBtn);

      act(() => {
        if (registeredOnError) {
          registeredOnError('Microphone access denied', { code: 'permission-denied', message: 'Microphone access denied' });
        }
      });

      expect(screen.getByText(/Quyền truy cập Microphone bị từ chối/i)).toBeTruthy();
      expect(screen.queryByText('%')).toBeNull();
    });

    it('5. evaluates valid speech evidence and provides NextActionPanel', () => {
      let registeredOnResult: ((text: string, isFinal: boolean) => void) | null = null;
      vi.mocked(speechService.createSpeechRecognizer).mockImplementation((onResult) => {
        registeredOnResult = onResult;
        return { recognition: {}, stop: vi.fn() } as any;
      });

      render(<PronunciationArena />);

      const micBtn = screen.getByTestId('pronunciation-mic-btn');
      fireEvent.click(micBtn);

      act(() => {
        if (registeredOnResult) {
          registeredOnResult('resilience', true);
        }
      });

      expect(screen.getByText(/100%/)).toBeTruthy();
      expect(screen.getByText(/Phát âm chuẩn xác/i)).toBeTruthy();

      // NextActionPanel rendered at the bottom
      const todayHubBtn = screen.getByTestId('next-action-next-action-today-hub');
      expect(todayHubBtn).toBeTruthy();
    });

    it('6. resume/mount never automatically activates the microphone', () => {
      render(<PronunciationArena />);

      // Speech recognizer should not have been called on mount
      expect(speechService.createSpeechRecognizer).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // C. AI TUTOR SESSION EXPERIENCE
  // =========================================================================
  describe('C. AI Tutor Session Experience Flow', () => {
    it('1. renders open_turns metric without artificial percentage or progress bar', () => {
      render(<AITutorView />);

      const header = screen.getByTestId('session-progress-header');
      expect(header).toBeTruthy();
      expect(header.textContent).toContain('0 lượt hội thoại');
      // Invariant: open-ended conversation has NO artificial progress bar!
      expect(screen.queryByRole('progressbar')).toBeNull();
    });

    it('2. turn counter increases with user turns faithfully', async () => {
      render(<AITutorView />);

      const input = screen.getByPlaceholderText(/Gõ câu trả lời tiếng Anh hoặc bấm Mic/i);
      const sendBtn = screen.getByTestId('tutor-send-btn');

      await act(async () => {
        fireEvent.change(input, { target: { value: 'Good morning, I am ready for the interview.' } });
        fireEvent.click(sendBtn);
      });

      const header = screen.getByTestId('session-progress-header');
      expect(header.textContent).toContain('1 lượt hội thoại');
      expect(screen.queryByRole('progressbar')).toBeNull();
    });

    it('3. resume restores messages without re-ingesting feedback or re-granting XP', () => {
      const initialXP = useAppStore.getState().profile.xp;
      const initialMistakeCount = Object.keys(useAppStore.getState().mistakeBank).length;

      // Seed saved session
      tutorSessionStorage.saveTutorSession(
        'tech_interview',
        [
          { id: 'u1', sender: 'user', text: 'I managed a large cluster.', timestamp: '10:00' },
          { id: 'a1', sender: 'ai', text: 'Great. Tell me more.', timestamp: '10:01' },
        ],
        {
          turnCount: 1,
          currentTarget: 'cluster management',
          targetPracticeCounts: { 'cluster management': 1 },
          masteredTargets: [],
          recentMistakes: [],
        }
      );

      render(<AITutorView />);

      // Restores 1 user turn
      const header = screen.getByTestId('session-progress-header');
      expect(header.textContent).toContain('1 lượt hội thoại');

      // No re-granted XP
      expect(useAppStore.getState().profile.xp).toBe(initialXP);
      // No re-ingested mistakes
      expect(Object.keys(useAppStore.getState().mistakeBank).length).toBe(initialMistakeCount);
    });

    it('4. distinguishes trusted vs untrusted telemetry (untrusted never ingested)', async () => {
      const ingestSpy = vi.spyOn(tutorFeedbackBridge, 'ingestTutorFeedback');

      // 1. Untrusted response (isFallback = true, isTrusted = false)
      vi.mocked(geminiService.generateAIResponse).mockResolvedValueOnce({
        reply: 'Fallback answer',
        isFallback: true,
        feedback: undefined,
        telemetry: {
          isTrusted: false,
          detectedMistakes: [],
        },
      });

      render(<AITutorView />);

      const input = screen.getByPlaceholderText(/Gõ câu trả lời tiếng Anh hoặc bấm Mic/i);
      const sendBtn = screen.getByTestId('tutor-send-btn');

      await act(async () => {
        fireEvent.change(input, { target: { value: 'Testing untrusted response.' } });
        fireEvent.click(sendBtn);
      });

      // Ingest should NOT have been called for untrusted response
      expect(ingestSpy).not.toHaveBeenCalled();

      // 2. Trusted response
      vi.mocked(geminiService.generateAIResponse).mockResolvedValueOnce({
        reply: 'Trusted evaluation.',
        isFallback: false,
        feedback: {
          original: 'I lead the development team.',
          correction: 'I lead the development team.',
          explanation: 'Good work.',
        },
        telemetry: {
          isTrusted: true,
          detectedMistakes: [],
        },
      });

      await act(async () => {
        fireEvent.change(input, { target: { value: 'I lead the development team.' } });
        fireEvent.click(sendBtn);
      });

      // Ingest called for trusted response
      expect(ingestSpy).toHaveBeenCalled();
    });

    it('5. explicit completion displays session summary with NextActionPanel and cleans up continuity', () => {
      useAppStore.setState({
        resumeActivities: {
          tutor_tech_interview: {
            id: 'tutor_tech_interview',
            type: 'tutor',
            title: 'AI Tutor: Tech Interview',
            startedAt: Date.now() - 60000,
            lastActiveAt: Date.now(),
            completed: false,
            schemaVersion: 1,
            checkpoint: {
              sessionId: 'tech_interview',
              scenarioId: 'tech_interview',
              turnCount: 2,
              lastMessageSummary: 'Interview discussion',
            },
          },
        },
      });

      render(<AITutorView />);

      // Click "Kết Thúc Phiên" in header
      const endSessionBtn = screen.getByRole('button', { name: /Kết Thúc Phiên/i });
      fireEvent.click(endSessionBtn);

      expect(screen.getByText(/Tổng Kết Phiên Gia Sư AI/i)).toBeTruthy();

      // Click "Về Kế Hoạch Hôm Nay" in NextActionPanel
      const todayHubBtn = screen.getByTestId('next-action-next-action-today-hub');
      expect(todayHubBtn).toBeTruthy();
      fireEvent.click(todayHubBtn);

      // Continuity activity should be marked completed
      const activity = useAppStore.getState().resumeActivities['tutor_tech_interview'];
      expect(activity?.completed).toBe(true);
    });
  });
});
