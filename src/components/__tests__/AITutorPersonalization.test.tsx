// @vitest-environment happy-dom
// src/components/__tests__/AITutorPersonalization.test.tsx
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import React from 'react';
import { AITutorView } from '../AITutorView';
import { useAppStore } from '../../store/useAppStore';
import * as geminiService from '../../services/geminiService';
import {
  deriveSessionFocusItems,
  formatHumanReadableTarget,
} from '../../services/tutorSessionManager';
import { deriveTutorLearningContext } from '../../services/tutorLearningContext';
import type { TutorLearningContext, TutorLearningContextSource } from '../../types';

import { clearAllTutorSessions } from '../../services/tutorSessionStorage';

// Mock framer-motion to avoid Happy-DOM animation cancellation warnings
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

// Mock speech service so audio/recognition don't throw in test environment
vi.mock('../../services/speechService', () => ({
  speakWord: vi.fn(),
  createSpeechRecognizer: vi.fn(() => ({
    start: vi.fn(),
    stop: vi.fn(),
    abort: vi.fn(),
  })),
}));

describe('PHASE 4: AI Tutor Personalization UI + Privacy + Resilience (Final Hardening)', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    clearAllTutorSessions();

    if (!window.HTMLElement.prototype.scrollIntoView) {
      window.HTMLElement.prototype.scrollIntoView = vi.fn();
    }

    useAppStore.setState({
      geminiApiKey: '',
      mistakeBank: {},
      userCollocations: [],
      userCustomWords: [],
      srsProgressMap: {},
      recentReviewEvents: [],
      fourSkillsScores: { listening: [], reading: [], speaking: [], writing: [] },
      profile: {
        name: 'Test Student',
        level: 1,
        xp: 100,
        streak: 3,
        lastActiveDate: '2026-10-04',
        lastStudyDate: '2026-10-04',
        hearts: 5,
        maxHearts: 5,
        avatarSeed: 'test',
        targetDailyWords: 20,
        targetDailyNewWords: 15,
        extraNewWordsBonus: 0,
        isOnboarded: true,
      },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // =========================================================================
  // 1. Personalized banner shown with valid history
  // =========================================================================
  it('1. renders personalized banner with "Cá nhân hóa cho bạn" when history exists', () => {
    useAppStore.setState({
      mistakeBank: {
        mb1: {
          id: 'mb1',
          word: 'although',
          source: 'ai_tutor',
          primaryType: 'grammar',
          meaning: 'mặc dù',
          lastContext: 'Grammar rule test',
          lastUserAnswer: 'despite he was tired',
          lastExpectedAnswer: 'although he was tired',
          mistakeCount: 4,
          consecutiveCorrect: 0,
          resolved: false,
          lastMistakeAt: new Date().toISOString(),
        },
      },
      fourSkillsScores: {
        listening: [65],
        reading: [70],
        speaking: [60],
        writing: [55],
      },
    });

    render(<AITutorView />);

    expect(screen.getByText('Cá nhân hóa cho bạn')).toBeDefined();
    expect(screen.getByText('Mục tiêu hôm nay:')).toBeDefined();
    expect(screen.getAllByText('although').length).toBeGreaterThanOrEqual(1);
  });

  // =========================================================================
  // 2. CEFR label correct
  // =========================================================================
  it('2. displays correct CEFR label calibrated from four skills scores (B2 for score 83)', () => {
    useAppStore.setState({
      mistakeBank: {
        mb1: {
          id: 'mb1',
          word: 'accommodate',
          source: 'flashcard',
          primaryType: 'spelling',
          meaning: 'chứa chấp',
          lastContext: 'Spelling error',
          lastUserAnswer: 'acommodate',
          lastExpectedAnswer: 'accommodate',
          mistakeCount: 3,
          consecutiveCorrect: 0,
          resolved: false,
          lastMistakeAt: new Date().toISOString(),
        },
      },
      fourSkillsScores: {
        listening: [85],
        reading: [85],
        speaking: [80],
        writing: [82],
      },
    });

    render(<AITutorView />);

    // Average is 83 -> CEFR B2
    expect(screen.getByText(/CEFR B2/i)).toBeDefined();
  });

  // =========================================================================
  // 3. Focus pills use clean display labels
  // =========================================================================
  it('3. focus pills use structured, clean human-readable display labels', () => {
    const context: TutorLearningContext = {
      overallCefr: 'B2',
      hasLearningHistory: true,
      competency: {
        overallScore: 75,
        overallCefr: 'B2',
        listening: { score: 75, level: 'B2', totalAttempts: 1 },
        reading: { score: 75, level: 'B2', totalAttempts: 1 },
        speaking: { score: 75, level: 'B2', totalAttempts: 1 },
        writing: { score: 75, level: 'B2', totalAttempts: 1 },
        accumulatedWords: 10,
      },
      weakCollocations: [
        {
          id: 'c1',
          phrase: 'conduct research',
          meaning: 'thực hiện nghiên cứu',
          mistakeCount: 2,
          isDue: true,
        },
      ],
      weakVocabulary: [
        {
          id: 'v1',
          word: 'bottleneck',
          meaning: 'điểm nghẽn',
          reason: 'từ vựng',
          lapseCount: 2,
          isLeech: false,
        },
      ],
      leechWords: [],
      unresolvedMistakes: [],
      grammarWeaknesses: [],
      recentWritingIssues: [],
      recentSpeakingIssues: [],
      learningPriorities: [],
      metadata: {
        generatedAt: Date.now(),
        totalUnresolvedMistakes: 0,
        totalDueCards: 1,
        totalLeechWords: 0,
      },
    };

    const focusItems = deriveSessionFocusItems(context, 3);
    expect(focusItems).toEqual(['conduct research', 'bottleneck']);
  });

  // =========================================================================
  // 4. Internal canonical ID never rendered
  // =========================================================================
  it('4. maps internal canonical IDs to clean learner-facing text and rejects technical numeric IDs', () => {
    expect(formatHumanReadableTarget('grammar_although_vs_despite')).toBe('although vs despite');
    expect(formatHumanReadableTarget('colloc_draw_conclusions')).toBe('draw conclusions');
    expect(formatHumanReadableTarget('pron_mischievous')).toBe('mischievous');
    expect(formatHumanReadableTarget('vocab_ubiquitous')).toBe('ubiquitous');
    expect(formatHumanReadableTarget('vocab_123')).toBe(''); // numeric opaque ID rejected
    expect(formatHumanReadableTarget('word_999')).toBe(''); // numeric opaque ID rejected

    useAppStore.setState({
      mistakeBank: {
        mb_grammar: {
          id: 'grammar_although_vs_despite',
          word: 'grammar_although_vs_despite',
          source: 'ai_tutor',
          primaryType: 'grammar',
          meaning: 'mệnh đề nhượng bộ',
          lastContext: 'test',
          lastUserAnswer: 'despite',
          lastExpectedAnswer: 'although',
          mistakeCount: 3,
          consecutiveCorrect: 0,
          resolved: false,
          lastMistakeAt: new Date().toISOString(),
        },
      },
      fourSkillsScores: { listening: [60], reading: [60], speaking: [60], writing: [60] },
    });

    const { container } = render(<AITutorView />);
    const domHtml = container.innerHTML;

    // Technical canonical key is cleaned up into human-readable text
    expect(domHtml).not.toContain('grammar_although_vs_despite');
    expect(screen.getAllByText('although vs despite').length).toBeGreaterThanOrEqual(1);
  });

  // =========================================================================
  // 5. New user has no banner, no undefined/null/NaN
  // =========================================================================
  it('5. new user without history renders clean UI with zero broken badges, no undefined/null/NaN', () => {
    useAppStore.setState({
      mistakeBank: {},
      userCollocations: [],
      userCustomWords: [],
      srsProgressMap: {},
      fourSkillsScores: { listening: [], reading: [], speaking: [], writing: [] },
    });

    const { container } = render(<AITutorView />);

    expect(screen.queryByText('Cá nhân hóa cho bạn')).toBeNull();
    expect(screen.queryByText('Mục tiêu hôm nay:')).toBeNull();
    expect(screen.queryByText(/Trọng tâm:/i)).toBeNull();

    expect(container.innerHTML).not.toContain('undefined');
    expect(container.innerHTML).not.toContain('NaN');
    expect(container.innerHTML).not.toContain('null');
  });

  // =========================================================================
  // 6. Sparse history does not fabricate targets
  // =========================================================================
  it('6. sparse history with only 1 actionable target yields exactly 1 pill without fabricating 3', () => {
    const context: TutorLearningContext = {
      overallCefr: 'B1',
      hasLearningHistory: true,
      competency: {
        overallScore: 60,
        overallCefr: 'B1',
        listening: { score: 60, level: 'B1', totalAttempts: 1 },
        reading: { score: 60, level: 'B1', totalAttempts: 1 },
        speaking: { score: 60, level: 'B1', totalAttempts: 1 },
        writing: { score: 60, level: 'B1', totalAttempts: 1 },
        accumulatedWords: 5,
      },
      weakVocabulary: [
        {
          id: 'v1',
          word: 'resilient',
          meaning: 'kiên cường',
          reason: 'từ vựng',
          lapseCount: 2,
          isLeech: false,
        },
      ],
      weakCollocations: [],
      leechWords: [],
      unresolvedMistakes: [],
      grammarWeaknesses: [],
      recentWritingIssues: [],
      recentSpeakingIssues: [],
      learningPriorities: [],
      metadata: {
        generatedAt: Date.now(),
        totalUnresolvedMistakes: 0,
        totalDueCards: 0,
        totalLeechWords: 0,
      },
    };

    const items = deriveSessionFocusItems(context, 3);
    expect(items).toHaveLength(1);
    expect(items).toEqual(['resilient']);
  });

  // =========================================================================
  // 7. Typing input does not alter personalization result/state
  // =========================================================================
  it('7. typing keystrokes in input field does not alter derived personalization items', () => {
    useAppStore.setState({
      mistakeBank: {
        mb1: {
          id: 'mb1',
          word: 'although',
          source: 'ai_tutor',
          primaryType: 'grammar',
          meaning: 'mặc dù',
          lastContext: 'test',
          lastUserAnswer: 'despite',
          lastExpectedAnswer: 'although',
          mistakeCount: 3,
          consecutiveCorrect: 0,
          resolved: false,
          lastMistakeAt: new Date().toISOString(),
        },
      },
      fourSkillsScores: { listening: [65], reading: [65], speaking: [65], writing: [65] },
    });

    render(<AITutorView />);

    expect(screen.getByText('Cá nhân hóa cho bạn')).toBeDefined();
    expect(screen.getAllByText('although').length).toBeGreaterThanOrEqual(1);

    const input = screen.getByPlaceholderText('Gõ câu trả lời tiếng Anh hoặc bấm Mic...');
    // Simulate user typing multiple keystrokes
    fireEvent.change(input, { target: { value: 'H' } });
    fireEvent.change(input, { target: { value: 'He' } });
    fireEvent.change(input, { target: { value: 'Hello' } });

    // Personalization banner and items remain exactly identical
    expect(screen.getByText('Cá nhân hóa cho bạn')).toBeDefined();
    expect(screen.getAllByText('although').length).toBeGreaterThanOrEqual(1);
  });

  // =========================================================================
  // 8. Learning-state change updates personalization
  // =========================================================================
  it('8. store learning-state changes dynamically update CEFR and focus items', () => {
    useAppStore.setState({
      mistakeBank: {
        mb1: {
          id: 'mb1',
          word: 'although',
          source: 'ai_tutor',
          primaryType: 'grammar',
          meaning: 'mặc dù',
          lastContext: 'test',
          lastUserAnswer: 'despite',
          lastExpectedAnswer: 'although',
          mistakeCount: 2,
          consecutiveCorrect: 0,
          resolved: false,
          lastMistakeAt: new Date().toISOString(),
        },
      },
      fourSkillsScores: { listening: [60], reading: [60], speaking: [60], writing: [60] },
    });

    const { rerender } = render(<AITutorView />);
    expect(screen.getByText(/CEFR B1/i)).toBeDefined();

    // Now learner improves scores to C1
    act(() => {
      useAppStore.setState({
        fourSkillsScores: { listening: [92], reading: [92], speaking: [90], writing: [90] },
      });
    });

    rerender(<AITutorView />);
    expect(screen.getByText(/CEFR C1/i)).toBeDefined();
  });

  // =========================================================================
  // 9. Reset Chat resets session but retains long-term personalization
  // =========================================================================
  it('9. Reset Chat resets transient session state but retains long-term learning history and banner', async () => {
    useAppStore.setState({
      mistakeBank: {
        mb1: {
          id: 'mb1',
          word: 'although',
          source: 'ai_tutor',
          primaryType: 'grammar',
          meaning: 'mặc dù',
          lastContext: 'test',
          lastUserAnswer: 'despite',
          lastExpectedAnswer: 'although',
          mistakeCount: 3,
          consecutiveCorrect: 0,
          resolved: false,
          lastMistakeAt: new Date().toISOString(),
        },
      },
      fourSkillsScores: { listening: [65], reading: [65], speaking: [65], writing: [65] },
    });

    const { container } = render(<AITutorView />);

    // Send a message
    const input = screen.getByPlaceholderText('Gõ câu trả lời tiếng Anh hoặc bấm Mic...');
    fireEvent.change(input, { target: { value: 'User test message' } });

    const submitBtn = container.querySelector('button[type="submit"]') as HTMLButtonElement;
    fireEvent.click(submitBtn);

    expect(screen.getByText('User test message')).toBeDefined();

    // Click Reset Chat
    const resetBtn = screen.getByTitle('Bắt đầu lại cuộc trò chuyện này');
    fireEvent.click(resetBtn);

    // Messages reset
    expect(screen.queryByText('User test message')).toBeNull();

    // Long-term store untouched
    expect(useAppStore.getState().mistakeBank.mb1).toBeDefined();

    // Personalization banner remains present
    expect(screen.getByText('Cá nhân hóa cho bạn')).toBeDefined();
  });

  // =========================================================================
  // 10. Scenario switch clears old session target but retains learning profile
  // =========================================================================
  it('10. scenario switch clears old session memory and sets fresh target while retaining learner profile', () => {
    useAppStore.setState({
      mistakeBank: {
        mb1: {
          id: 'mb1',
          word: 'although',
          source: 'ai_tutor',
          primaryType: 'grammar',
          meaning: 'mặc dù',
          lastContext: 'test',
          lastUserAnswer: 'despite',
          lastExpectedAnswer: 'although',
          mistakeCount: 3,
          consecutiveCorrect: 0,
          resolved: false,
          lastMistakeAt: new Date().toISOString(),
        },
      },
      fourSkillsScores: { listening: [65], reading: [65], speaking: [65], writing: [65] },
    });

    render(<AITutorView />);

    // Initially Tech Interview
    expect(screen.getByText('Senior Tech Lead / Interviewer')).toBeDefined();

    // Switch to Daily Standup
    const standupBtn = screen.getByText('Cuộc Họp Daily Standup & Báo Cáo Task');
    fireEvent.click(standupBtn);

    // Scenario updated
    expect(screen.getByText('Scrum Master / Agile Team Lead')).toBeDefined();

    // Personalization banner is still active
    expect(screen.getByText('Cá nhân hóa cho bạn')).toBeDefined();

    // Long-term learning profile in store untouched
    expect(useAppStore.getState().mistakeBank.mb1.word).toBe('although');
  });

  // =========================================================================
  // 11. Demo Mode does not persist Mistake Bank / SRS data
  // =========================================================================
  it('11. Demo Mode (missing API key) never persists feedback into Mistake Bank or SRS', async () => {
    useAppStore.setState({
      geminiApiKey: '',
      mistakeBank: {},
      userCollocations: [],
      srsProgressMap: {},
    });

    const { container } = render(<AITutorView />);

    const input = screen.getByPlaceholderText('Gõ câu trả lời tiếng Anh hoặc bấm Mic...');
    fireEvent.change(input, { target: { value: 'I have 3 years of experience in backend development.' } });

    const submitBtn = container.querySelector('button[type="submit"]') as HTMLButtonElement;
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.queryByText(/Đang phân tích phản hồi/i)).toBeNull();
    }, { timeout: 3000 });

    // Ensure Demo Mode did not modify store
    const state = useAppStore.getState();
    expect(Object.keys(state.mistakeBank)).toHaveLength(0);
    expect(state.userCollocations).toHaveLength(0);
    expect(Object.keys(state.srsProgressMap)).toHaveLength(0);
  });

  // =========================================================================
  // 12. Unexpected Gemini exception does not persist telemetry
  // =========================================================================
  it('12. unexpected Gemini exception caught by safe handler does not persist telemetry', async () => {
    useAppStore.setState({
      geminiApiKey: 'test-api-key-123456789',
      mistakeBank: {},
      userCollocations: [],
      srsProgressMap: {},
    });

    vi.spyOn(geminiService, 'generateAIResponse').mockRejectedValueOnce(
      new Error('Catastrophic socket abort')
    );

    const { container } = render(<AITutorView />);

    const input = screen.getByPlaceholderText('Gõ câu trả lời tiếng Anh hoặc bấm Mic...');
    fireEvent.change(input, { target: { value: 'Can you describe microservices?' } });

    const submitBtn = container.querySelector('button[type="submit"]') as HTMLButtonElement;
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText(/I'm having trouble connecting right now, but let's keep practicing!/i)).toBeDefined();
    });

    // Store remains pristine
    const state = useAppStore.getState();
    expect(Object.keys(state.mistakeBank)).toHaveLength(0);
    expect(state.userCollocations).toHaveLength(0);
  });

  // =========================================================================
  // 13. Service fallback does not trigger duplicate generic catch message
  // =========================================================================
  it('13. service fallback response renders cleanly without triggering duplicate catch fallback message', async () => {
    useAppStore.setState({ geminiApiKey: '' });

    const { container } = render(<AITutorView />);

    const input = screen.getByPlaceholderText('Gõ câu trả lời tiếng Anh hoặc bấm Mic...');
    fireEvent.change(input, { target: { value: 'I specialize in Node.js and Redis.' } });

    const submitBtn = container.querySelector('button[type="submit"]') as HTMLButtonElement;
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.queryByText(/Đang phân tích phản hồi/i)).toBeNull();
    }, { timeout: 3000 });

    // Catch message must NOT appear because normal service fallback was handled successfully
    expect(screen.queryByText(/I'm having trouble connecting right now/i)).toBeNull();
  });

  // =========================================================================
  // 14. API key absent from DOM
  // =========================================================================
  it('14. Gemini API key is never rendered in the DOM text or attributes', () => {
    const secretKey = 'AIzaSyD-CONFIDENTIAL-GEMINI-KEY-999';
    useAppStore.setState({
      geminiApiKey: secretKey,
      mistakeBank: {},
    });

    const { container } = render(<AITutorView />);
    expect(container.innerHTML).not.toContain(secretKey);
  });

  // =========================================================================
  // 15. Internal prompt directives absent from DOM
  // =========================================================================
  it('15. internal prompt directives and prompt templates are never exposed in DOM', () => {
    useAppStore.setState({
      mistakeBank: {
        mb1: {
          id: 'mb1',
          word: 'although',
          source: 'ai_tutor',
          primaryType: 'grammar',
          meaning: 'mặc dù',
          lastContext: 'test',
          lastUserAnswer: 'despite',
          lastExpectedAnswer: 'although',
          mistakeCount: 2,
          consecutiveCorrect: 0,
          resolved: false,
          lastMistakeAt: new Date().toISOString(),
        },
      },
      fourSkillsScores: { listening: [65], reading: [65], speaking: [65], writing: [65] },
    });

    const { container } = render(<AITutorView />);
    const domHtml = container.innerHTML;

    expect(domHtml).not.toContain('[ROLEPLAY SCENARIO]');
    expect(domHtml).not.toContain('[CEFR CALIBRATION]');
    expect(domHtml).not.toContain('[OUTPUT REQUIREMENT]');
    expect(domHtml).not.toContain('[ADAPTIVE PEDAGOGY DIRECTIVES]');
    expect(domHtml).not.toContain('<learner_data>');
    expect(domHtml).not.toContain('</learner_data>');
  });

  // =========================================================================
  // 16. Raw telemetry absent from DOM
  // =========================================================================
  it('16. raw telemetry JSON keys and internal scores are never exposed as learner-facing text', () => {
    useAppStore.setState({
      mistakeBank: {
        mb1: {
          id: 'mb1',
          word: 'although',
          source: 'ai_tutor',
          primaryType: 'grammar',
          meaning: 'mặc dù',
          lastContext: 'test',
          lastUserAnswer: 'despite',
          lastExpectedAnswer: 'although',
          mistakeCount: 2,
          consecutiveCorrect: 0,
          resolved: false,
          lastMistakeAt: new Date().toISOString(),
        },
      },
      fourSkillsScores: { listening: [65], reading: [65], speaking: [65], writing: [65] },
    });

    const { container } = render(<AITutorView />);
    const domHtml = container.innerHTML;

    expect(domHtml).not.toContain('"isTrusted":true');
    expect(domHtml).not.toContain('"targetPracticeCounts"');
    expect(domHtml).not.toContain('"severityScore"');
    expect(domHtml).not.toContain('rawScores');
  });

  // =========================================================================
  // 17. Focus derivation does not mutate context or source
  // =========================================================================
  it('17. deriveSessionFocusItems and deriveTutorLearningContext remain strictly pure without mutating inputs', () => {
    const context: TutorLearningContext = {
      overallCefr: 'B2',
      hasLearningHistory: true,
      competency: {
        overallScore: 70,
        overallCefr: 'B2',
        listening: { score: 70, level: 'B2', totalAttempts: 2 },
        reading: { score: 70, level: 'B2', totalAttempts: 2 },
        speaking: { score: 70, level: 'B2', totalAttempts: 2 },
        writing: { score: 70, level: 'B2', totalAttempts: 2 },
        accumulatedWords: 15,
      },
      weakCollocations: [
        { id: 'c1', phrase: 'conduct research', meaning: 'nghiên cứu', mistakeCount: 1, isDue: true },
        { id: 'c2', phrase: 'make a decision', meaning: 'quyết định', mistakeCount: 2, isDue: true },
      ],
      weakVocabulary: [
        { id: 'v1', word: 'resilient', meaning: 'kiên cường', reason: 'yếu', lapseCount: 3, isLeech: false },
      ],
      leechWords: [],
      unresolvedMistakes: [],
      grammarWeaknesses: [],
      recentWritingIssues: [],
      recentSpeakingIssues: [],
      learningPriorities: [],
      metadata: {
        generatedAt: 123456789,
        totalUnresolvedMistakes: 0,
        totalDueCards: 2,
        totalLeechWords: 0,
      },
    };

    const contextBefore = structuredClone(context);
    deriveSessionFocusItems(context, 3);
    expect(context).toEqual(contextBefore);

    const source: TutorLearningContextSource = {
      fourSkillsScores: { listening: [70], reading: [70], speaking: [70], writing: [70] },
      userCollocations: [{ id: 'c1', phrase: 'take into account', meaning: 'xét đến', exampleEn: '', exampleVi: '', createdAt: '' }],
      mistakeBank: {},
      userCustomWords: [],
      now: 100000,
    };

    const sourceBefore = structuredClone(source);
    deriveTutorLearningContext(source);
    expect(source).toEqual(sourceBefore);
  });

  // =========================================================================
  // 18. All five original scenarios still render and switch correctly
  // =========================================================================
  it('18. all five original scenarios render, switch correctly, and display their guided steps', () => {
    render(<AITutorView />);

    const scenarioTitles = [
      'Phỏng Vấn Lập Trình Viên (Tech Mock Interview)',
      'Cuộc Họp Daily Standup & Báo Cáo Task',
      'Tiếng Anh Du Lịch & Giao Tiếp Đời Sống',
      'Đàm Phán & Thuyết Trình Doanh Nghiệp',
      'Luyện Thi IELTS Speaking Master (Part 1-3)',
    ];

    for (const title of scenarioTitles) {
      const btn = screen.getByText(title);
      expect(btn).toBeDefined();
      fireEvent.click(btn);
      expect(screen.getByText(/Lộ trình hội thoại định hướng theo bước/i)).toBeDefined();
    }
  });
});
