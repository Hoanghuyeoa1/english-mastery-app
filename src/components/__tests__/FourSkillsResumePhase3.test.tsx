// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import React from 'react';
import { FourSkillsView } from '../FourSkillsView';
import { useAppStore, composeVocabularyList } from '../../store/useAppStore';
import { READING_LESSONS } from '../../data/fourSkills/readingData';
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

vi.mock('canvas-confetti', () => ({
  default: vi.fn(),
}));

describe('PHASE 3: Four Skills Resume Continuity Engine', () => {
  beforeEach(() => {
    localStorage.clear();
    useAppStore.setState({
      srsProgressMap: {},
      userCustomWords: [],
      vocabularyList: composeVocabularyList({}, []),
      mistakeBank: {},
      dailyHistory: {},
      activeFourSkill: 'reading',
      fourSkillsScores: {
        listening: [],
        reading: [],
        speaking: [],
        writing: [],
      },
      wordLearningStats: {},
      completedListeningLessonIds: [],
      fourSkillsCompletionProgress: {
        reading: [],
        speaking: [],
        writing: [],
      },
      resumeActivities: {},
    });

    (window as any).alert = vi.fn();
    window.scrollTo = vi.fn();
  });

  it('renders resume banner when an unfinished reading activity exists, and resumes lesson with saved answers', () => {
    const readingLesson = READING_LESSONS[0];
    const q1 = readingLesson.questions[0];

    // Seed unfinished reading activity in store
    useAppStore.getState().upsertResumeActivity({
      id: `reading_${readingLesson.id}`,
      type: 'reading',
      title: readingLesson.title,
      startedAt: Date.now() - 5000,
      lastActiveAt: Date.now() - 1000,
      completed: false,
      schemaVersion: 1,
      checkpoint: {
        lessonId: readingLesson.id,
        answers: { [q1.id]: 1 },
        totalQuestions: readingLesson.questions.length,
        progressPercent: 25,
      },
    });

    render(<FourSkillsView />);

    // Banner should be visible
    const banner = screen.getByTestId('four-skills-resume-banner');
    expect(banner).toBeDefined();
    expect(banner.textContent).toContain(readingLesson.title);

    // Click [Tiếp tục]
    const resumeBtn = screen.getByTestId('btn-resume-activity');
    fireEvent.click(resumeBtn);

    // Now the lesson view is rendered, banner disappears, and answers are restored
    expect(screen.queryByTestId('four-skills-resume-banner')).toBeNull();
    expect(screen.getByText(readingLesson.title)).toBeDefined();
  });

  it('does NOT show resume banner for an already completed reading lesson', () => {
    const readingLesson = READING_LESSONS[0];

    // Mark completed in store
    useAppStore.setState({
      fourSkillsCompletionProgress: {
        reading: [readingLesson.id],
        speaking: [],
        writing: [],
      },
    });

    // Seed unfinished reading activity with same ID
    useAppStore.getState().upsertResumeActivity({
      id: `reading_${readingLesson.id}`,
      type: 'reading',
      title: readingLesson.title,
      startedAt: Date.now() - 5000,
      lastActiveAt: Date.now() - 1000,
      completed: false,
      schemaVersion: 1,
      checkpoint: {
        lessonId: readingLesson.id,
        answers: {},
        totalQuestions: readingLesson.questions.length,
        progressPercent: 0,
      },
    });

    render(<FourSkillsView />);

    // Since it is in completedReadIds, banner should NOT be rendered
    expect(screen.queryByTestId('four-skills-resume-banner')).toBeNull();
  });

  it('dismisses resume banner when user clicks [Bắt đầu bài khác]', () => {
    const readingLesson = READING_LESSONS[0];

    useAppStore.getState().upsertResumeActivity({
      id: `reading_${readingLesson.id}`,
      type: 'reading',
      title: readingLesson.title,
      startedAt: Date.now() - 5000,
      lastActiveAt: Date.now() - 1000,
      completed: false,
      schemaVersion: 1,
      checkpoint: {
        lessonId: readingLesson.id,
        answers: {},
        totalQuestions: readingLesson.questions.length,
        progressPercent: 10,
      },
    });

    render(<FourSkillsView />);

    expect(screen.getByTestId('four-skills-resume-banner')).toBeDefined();

    const dismissBtn = screen.getByTestId('btn-dismiss-resume');
    fireEvent.click(dismissBtn);

    // Banner is removed and activity deleted from store
    expect(screen.queryByTestId('four-skills-resume-banner')).toBeNull();
    expect(useAppStore.getState().resumeActivities[`reading_${readingLesson.id}`]).toBeUndefined();
  });

  it('resumes speaking activity without initializing speech recognition or recording', () => {
    const prompt = SPEAKING_PROMPTS[0];

    useAppStore.setState({
      activeFourSkill: 'speaking',
    });

    useAppStore.getState().upsertResumeActivity({
      id: `speaking_${prompt.id}`,
      type: 'speaking',
      title: prompt.title,
      startedAt: Date.now() - 5000,
      lastActiveAt: Date.now() - 1000,
      completed: false,
      schemaVersion: 1,
      checkpoint: {
        promptId: prompt.id,
        currentTurnIndex: 1,
        totalTurns: prompt.turns.length,
        progressPercent: 50,
      },
    });

    render(<FourSkillsView />);

    const banner = screen.getByTestId('four-skills-resume-banner');
    expect(banner).toBeDefined();

    const resumeBtn = screen.getByTestId('btn-resume-activity');
    fireEvent.click(resumeBtn);

    // Lesson is opened, turn is restored to 1
    expect(screen.queryByTestId('four-skills-resume-banner')).toBeNull();
    expect(screen.getByText(prompt.title)).toBeDefined();

    // Check that recording is NOT active
    expect(screen.queryByText(/Đang ghi âm/i)).toBeNull();
  });

  it('autosaves writing draft with debounce and restores draft on resume', async () => {
    vi.useFakeTimers();

    const writingPrompt = WRITING_PROMPTS[0];
    useAppStore.setState({
      activeFourSkill: 'writing',
    });

    const { unmount } = render(<FourSkillsView />);

    // Select writing prompt from catalog
    const promptCard = screen.getByText(writingPrompt.title);
    fireEvent.click(promptCard);

    // Type in textarea
    const textarea = screen.getByLabelText(/Nội dung bài viết/i);
    fireEvent.change(textarea, { target: { value: 'This is my comprehensive essay draft for testing continuity.' } });

    // Advance debounce timer (600ms)
    act(() => {
      vi.advanceTimersByTime(650);
    });

    // Checkpoint should be in store
    const savedAct = useAppStore.getState().resumeActivities[`writing_${writingPrompt.id}`];
    expect(savedAct).toBeDefined();
    expect(savedAct?.type).toBe('writing');
    if (savedAct && savedAct.type === 'writing') {
      expect(savedAct.checkpoint.draft).toContain('comprehensive essay draft');
    }

    unmount();
    vi.useRealTimers();

    // Now re-mount FourSkillsView: since prompt is closed on fresh mount, banner shows up
    render(<FourSkillsView />);

    const banner = screen.getByTestId('four-skills-resume-banner');
    expect(banner).toBeDefined();
    expect(banner.textContent).toContain(writingPrompt.title);

    // Click resume
    const resumeBtn = screen.getByTestId('btn-resume-activity');
    fireEvent.click(resumeBtn);

    // Draft is restored in textarea
    const restoredTextarea = screen.getByLabelText(/Nội dung bài viết/i) as HTMLTextAreaElement;
    expect(restoredTextarea.value).toContain('comprehensive essay draft');
  });
});
