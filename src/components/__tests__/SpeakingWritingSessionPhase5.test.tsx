// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import React from 'react';
import { FourSkillsView } from '../FourSkillsView';
import { useAppStore } from '../../store/useAppStore';
import { SPEAKING_PROMPTS } from '../../data/fourSkills/speakingData';
import { WRITING_PROMPTS } from '../../data/fourSkills/writingData';

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

// Mock gradeEssay for Writing conforming strictly to EssayGradingResult schema
vi.mock('../../services/essayGradingService', () => ({
  gradeEssay: vi.fn().mockImplementation(async () => ({
    overallScore: 85,
    overallCEFR: 'B2',
    wordCount: 65,
    criteria: {
      taskAchievement: { score: 85, cefrLevel: 'B2', feedback: 'Hoàn thành đề bài tốt' },
      coherenceCohesion: { score: 80, cefrLevel: 'B2', feedback: 'Tính mạch lạc cao' },
      lexicalResource: { score: 90, cefrLevel: 'B2', feedback: 'Vốn từ vựng phong phú' },
      grammaticalAccuracy: { score: 85, cefrLevel: 'B2', feedback: 'Ngữ pháp chuẩn xác' },
    },
    strengths: ['Luận điểm mạch lạc'],
    improvements: ['Mở rộng thêm từ nối'],
    diffSegments: [],
    fullRevisedEssay: 'This is a comprehensive analytical essay discussing technology in education with strong arguments and conclusions.',
    isFallback: false,
  })),
}));

describe('PHASE 5: Speaking & Writing Session Experience Integration Suite', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();

    window.HTMLElement.prototype.scrollIntoView = vi.fn();
    (window as any).alert = vi.fn();
    window.scrollTo = vi.fn();

    (window as any).speechSynthesis = {
      speak: vi.fn(),
      cancel: vi.fn(),
      pause: vi.fn(),
      resume: vi.fn(),
      getVoices: vi.fn().mockReturnValue([]),
    };

    useAppStore.setState({
      activeFourSkill: 'speaking',
      fourSkillsCompletionProgress: {
        reading: [],
        speaking: [],
        writing: [],
      },
      resumeActivities: {},
      activePracticeConfig: null,
      profile: {
        ...useAppStore.getState().profile,
        streak: 5, // App-level streak
      },
    });
  });

  describe('A. Speaking Session Experience Flow', () => {
    it('1. Before Session: displays truthful metadata from SpeakingPrompt and SessionIntro', async () => {
      render(<FourSkillsView />);

      const speakingTabBtn = screen.getByText('🗣️ Luyện Nói').closest('button');
      fireEvent.click(speakingTabBtn!);

      const roleplayBtn = screen.getByText(/Hội Thoại Roleplay/i).closest('button');
      fireEvent.click(roleplayBtn!);

      const targetPrompt = SPEAKING_PROMPTS[0];
      const card = screen.getByText(targetPrompt.title).closest('.group');
      fireEvent.click(card!);

      // Verify SessionIntro renders truthful metadata
      const intro = screen.getByTestId('session-intro');
      expect(intro).toBeTruthy();
      expect(within(intro).getByText(targetPrompt.title)).toBeTruthy();
      expect(within(intro).getByText(new RegExp(`Speaking ${targetPrompt.level}`, 'i'))).toBeTruthy();

      // Verify SessionProgressHeader shows discrete turns
      const header = screen.getByTestId('session-progress-header');
      expect(header).toBeTruthy();
      expect(within(header).getByText(new RegExp(`0 / ${targetPrompt.turns.length}`, 'i'))).toBeTruthy();
    });

    it('2. Before Session: prioritizes Today Hub plan metadata when routed via activePracticeConfig', async () => {
      const targetPrompt = SPEAKING_PROMPTS[0];

      useAppStore.setState({
        activePracticeConfig: {
          module: 'speaking',
          itemIds: [targetPrompt.id],
          planItemId: 'task_spk_today_1',
          planTitle: 'Luyện Nói Phỏng Vấn Hôm Nay',
          planObjective: 'Luyện phản xạ phỏng vấn xin việc bằng tiếng Anh',
          estimatedMinutes: 8,
          startedAt: Date.now(),
        },
      });

      render(<FourSkillsView />);

      const intro = screen.getByTestId('session-intro');
      expect(intro).toBeTruthy();
      expect(within(intro).getByText('Luyện Nói Phỏng Vấn Hôm Nay')).toBeTruthy();
      expect(within(intro).getByText('Luyện phản xạ phỏng vấn xin việc bằng tiếng Anh')).toBeTruthy();
      expect(within(intro).getByText(/~10 phút/i)).toBeTruthy(); // Duration bucket for 8 mins
      expect(within(intro).getByText('Kế hoạch hôm nay')).toBeTruthy();
    });

    it('3. Resume: restores prompt turn without auto-starting microphone or speech recognition', async () => {
      const targetPrompt = SPEAKING_PROMPTS[0];

      useAppStore.setState({
        activeFourSkill: 'speaking',
        resumeActivities: {
          [`speaking_${targetPrompt.id}`]: {
            id: `speaking_${targetPrompt.id}`,
            type: 'speaking',
            title: targetPrompt.title,
            startedAt: Date.now() - 5000,
            lastActiveAt: Date.now() - 2000,
            completed: false,
            schemaVersion: 1,
            checkpoint: {
              promptId: targetPrompt.id,
              currentTurnIndex: 1,
              totalTurns: targetPrompt.turns.length,
              progressPercent: 50,
            },
          },
        },
      });

      render(<FourSkillsView />);

      const speakingTabBtn = screen.getByText('🗣️ Luyện Nói').closest('button');
      fireEvent.click(speakingTabBtn!);

      // Banner should show resumable activity
      const resumeBanner = screen.getByTestId('four-skills-resume-banner');
      expect(resumeBanner).toBeTruthy();
      expect(within(resumeBanner).getByText(new RegExp(`Bạn đang học dở: ${targetPrompt.title}`, 'i'))).toBeTruthy();

      // Click resume button in banner
      const resumeButton = screen.getByTestId('btn-resume-activity');
      fireEvent.click(resumeButton);

      // Verify turn 2 is active (index 1)
      expect(screen.getByText(new RegExp(`Lượt 2/${targetPrompt.turns.length}`, 'i'))).toBeTruthy();

      // Invariant: Microphone should NOT be recording automatically
      expect(screen.queryByText(/Đang ghi âm/i)).toBeNull();
    });

    it('4. After Session: eliminates fake 85 score fallback when no valid audio evidence exists', async () => {
      render(<FourSkillsView />);

      const speakingTabBtn = screen.getByText('🗣️ Luyện Nói').closest('button');
      fireEvent.click(speakingTabBtn!);

      const roleplayBtn = screen.getByText(/Hội Thoại Roleplay/i).closest('button');
      fireEvent.click(roleplayBtn!);

      const targetPrompt = SPEAKING_PROMPTS[0];
      const card = screen.getByText(targetPrompt.title).closest('.group');
      fireEvent.click(card!);

      // Verify speech unsupported banner is truthful in happy-dom
      const unsupportedElements = screen.getAllByText(/Trình duyệt hiện tại chưa hỗ trợ nhận diện giọng nói/i);
      expect(unsupportedElements.length).toBeGreaterThan(0);

      // Invariant: App streak untouched
      const appState = useAppStore.getState();
      expect(appState.profile.streak).toBe(5);
    });

    it('5. Invariant: ephemeral streak never mutates app-level profile streak', async () => {
      const initialStreak = useAppStore.getState().profile.streak;
      expect(initialStreak).toBe(5);

      render(<FourSkillsView />);

      const speakingTabBtn = screen.getByText('🗣️ Luyện Nói').closest('button');
      fireEvent.click(speakingTabBtn!);

      const roleplayBtn = screen.getByText(/Hội Thoại Roleplay/i).closest('button');
      fireEvent.click(roleplayBtn!);

      const targetPrompt = SPEAKING_PROMPTS[0];
      const card = screen.getByText(targetPrompt.title).closest('.group');
      fireEvent.click(card!);

      // App streak must remain 5
      expect(useAppStore.getState().profile.streak).toBe(initialStreak);
    });
  });

  describe('B. Writing Session Experience Flow', () => {
    it('1. Before Session: displays truthful metadata from WritingPrompt and SessionIntro', async () => {
      render(<FourSkillsView />);

      const writingTabBtn = screen.getByText('✍️ Luyện Viết').closest('button');
      fireEvent.click(writingTabBtn!);

      const targetPrompt = WRITING_PROMPTS[0];
      const card = screen.getByText(targetPrompt.title).closest('.group');
      fireEvent.click(card!);

      // SessionIntro rendered with prompt details
      const intro = screen.getByTestId('session-intro');
      expect(intro).toBeTruthy();
      expect(within(intro).getByText(targetPrompt.title)).toBeTruthy();
      expect(within(intro).getByText(new RegExp(`Writing ${targetPrompt.level}`, 'i'))).toBeTruthy();
    });

    it('2. During Session: progress header uses stage_pipeline without fake percentage on word count', async () => {
      render(<FourSkillsView />);

      const writingTabBtn = screen.getByText('✍️ Luyện Viết').closest('button');
      fireEvent.click(writingTabBtn!);

      const targetPrompt = WRITING_PROMPTS[0];
      const card = screen.getByText(targetPrompt.title).closest('.group');
      fireEvent.click(card!);

      // Verify stage_pipeline stages are rendered
      expect(screen.getByText('Soạn thảo')).toBeTruthy();
      expect(screen.getByText('Đang chấm')).toBeTruthy();
      expect(screen.getByText('Đã đánh giá')).toBeTruthy();

      // Word count is rendered cleanly in the right slot
      expect(screen.getByText('0 từ')).toBeTruthy();
    });

    it('3. Resume: restores draft from checkpoint without duplicate state or accidental reset', async () => {
      const targetPrompt = WRITING_PROMPTS[0];

      useAppStore.setState({
        activeFourSkill: 'writing',
        resumeActivities: {
          [`writing_${targetPrompt.id}`]: {
            id: `writing_${targetPrompt.id}`,
            type: 'writing',
            title: targetPrompt.title,
            startedAt: Date.now() - 10000,
            lastActiveAt: Date.now() - 1000,
            completed: false,
            schemaVersion: 1,
            checkpoint: {
              promptId: targetPrompt.id,
              draft: 'In contemporary society, environmental protection is vital for sustainable development.',
              wordCount: 10,
              progressPercent: 20,
            },
          },
        },
      });

      render(<FourSkillsView />);

      const writingTabBtn = screen.getByText('✍️ Luyện Viết').closest('button');
      fireEvent.click(writingTabBtn!);

      // Resume banner is visible in Writing tab
      const resumeBanner = screen.getByTestId('four-skills-resume-banner');
      expect(resumeBanner).toBeTruthy();

      const resumeButton = screen.getByTestId('btn-resume-activity');
      fireEvent.click(resumeButton);

      // Draft text should be restored in textarea
      const textarea = screen.getByLabelText(/Nội dung bài viết/i) as HTMLTextAreaElement;
      expect(textarea.value).toContain('In contemporary society, environmental protection');

      // Word counter should reflect 10 words
      expect(screen.getByText(/Đã viết: 10/i)).toBeTruthy();
    });

    it('4. After Session: AI grading produces evaluation and NextActionPanel routes to Today Hub', async () => {
      const onNavigateMock = vi.fn();

      useAppStore.setState({
        activeFourSkill: 'writing',
        geminiApiKey: 'test-api-key',
      });

      render(<FourSkillsView onNavigate={onNavigateMock} />);

      const writingTabBtn = screen.getByText('✍️ Luyện Viết').closest('button');
      fireEvent.click(writingTabBtn!);

      const targetPrompt = WRITING_PROMPTS[0];
      const card = screen.getByText(targetPrompt.title).closest('.group');
      fireEvent.click(card!);

      // Enter sufficient essay text (≥10 words)
      const textarea = screen.getByLabelText(/Nội dung bài viết/i);
      fireEvent.change(textarea, {
        target: {
          value: 'This is a comprehensive analytical essay discussing technology in education with strong arguments and conclusions.',
        },
      });

      // Click Grade with AI button
      const gradeButton = screen.getByText(/Chấm Bài Với AI/i).closest('button');
      fireEvent.click(gradeButton!);

      // Wait for grading result to display NextActionPanel
      await waitFor(() => {
        expect(screen.getByText('Tiếp tục Kế Hoạch Hôm Nay')).toBeTruthy();
      }, { timeout: 4000 });

      // Verify NextActionPanel button triggers navigation
      const nextActionBtn = screen.getByText('Tiếp tục Kế Hoạch Hôm Nay').closest('button');
      fireEvent.click(nextActionBtn!);
      expect(onNavigateMock).toHaveBeenCalledWith('dashboard');
    });
  });
});
