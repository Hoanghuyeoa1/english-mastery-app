// @vitest-environment happy-dom
// src/components/fourSkills/__tests__/CEFRCheckpointSessionModal.test.tsx
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CEFRCheckpointSessionModal } from '../CEFRCheckpointSessionModal';
import { useAppStore } from '../../../store/useAppStore';
import { resetFinalizedAttempts } from '../../../services/checkpointSessionLifecycle';
import { resetListeningAssessments } from '../../../services/listeningCheckpointService';
import { resetReadingAssessments } from '../../../services/readingCheckpointService';
import { resetSpeakingAssessments } from '../../../services/speakingCheckpointService';
import { resetWritingAssessments } from '../../../services/writingCheckpointService';
import * as speechService from '../../../services/speechService';
import * as essayGradingService from '../../../services/essayGradingService';

vi.mock('canvas-confetti', () => ({
  default: vi.fn(),
}));

vi.mock('../../../services/speechService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../services/speechService')>();
  return {
    ...actual,
    isSpeechRecognitionSupported: vi.fn(() => true),
    startSpeechRecognition: vi.fn(),
  };
});

vi.mock('../../../services/essayGradingService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../services/essayGradingService')>();
  return {
    ...actual,
    gradeEssay: vi.fn(),
  };
});

describe('CEFRCheckpointSessionModal (Phases 4, 5, 6, 7 & 8)', () => {
  const defaultSpeakingTranscripts = [
    'Hello Sarah! Yes, this is room 204. My name is Minh, nice to meet you too.',
    'I live in Hanoi. I am a student, and I study computer science at university.',
    'In my free time, I like listening to music and playing badminton with my friends.',
  ];

  const sampleValidA1Essay =
    'My name is Nam. I live in Hanoi, Vietnam. I am twenty years old and I am a university student. In my free time, I love playing football and reading books. On weekends, I often visit my grandparents and cook dinner with my family. It is very fun.'; // 50 words >= 40 words

  beforeEach(() => {
    resetFinalizedAttempts();
    resetListeningAssessments();
    resetReadingAssessments();
    resetSpeakingAssessments();
    resetWritingAssessments();
    useAppStore.setState({
      resumeActivities: {},
      levelCertifications: {},
      geminiApiKey: 'test-valid-gemini-key',
    });

    let turnCounter = 0;
    vi.mocked(speechService.isSpeechRecognitionSupported).mockReturnValue(true);
    vi.mocked(speechService.startSpeechRecognition).mockImplementation((opts: any) => {
      const text = defaultSpeakingTranscripts[turnCounter % defaultSpeakingTranscripts.length];
      turnCounter++;
      opts.onResult?.(text, true);
      opts.onEnd?.();
      return {
        recognition: {},
        stop: vi.fn(),
      };
    });

    // Default mock for gradeEssay: 85% high score, genuine AI evaluation (!isFallback)
    vi.mocked(essayGradingService.gradeEssay).mockResolvedValue({
      overallScore: 85,
      overallCEFR: 'B2',
      wordCount: 50,
      criteria: {
        taskAchievement: { score: 85, cefrLevel: 'B2', feedback: 'Bố cục bài viết rõ ràng, đúng trọng tâm đề bài.' },
        coherenceCohesion: { score: 85, cefrLevel: 'B2', feedback: 'Luận điểm mạch lạc, liên kết tốt.' },
        lexicalResource: { score: 85, cefrLevel: 'B2', feedback: 'Từ vựng đa dạng, chính xác.' },
        grammaticalAccuracy: { score: 85, cefrLevel: 'B2', feedback: 'Kiểm soát tốt cấu trúc ngữ pháp.' },
      },
      strengths: ['Bố cục tốt'],
      improvements: ['Nâng cao từ vựng'],
      diffSegments: [
        { type: 'unchanged', originalText: 'My name is Nam. ' },
        {
          type: 'correction',
          originalText: 'I lives in Hanoi',
          revisedText: 'I live in Hanoi',
          explanation: 'Sửa lỗi chia động từ số ít với chủ ngữ I',
        },
      ],
      fullRevisedEssay: sampleValidA1Essay,
      isFallback: false,
    });

    // Mock Web Speech Synthesis for happy-dom
    const mockSpeak = vi.fn();
    const mockCancel = vi.fn();
    // @ts-ignore
    window.speechSynthesis = {
      speak: mockSpeak,
      cancel: mockCancel,
    };
    // @ts-ignore
    global.SpeechSynthesisUtterance = class {
      text: string;
      lang = '';
      rate = 1;
      onend?: () => void;
      onerror?: () => void;
      constructor(text: string) {
        this.text = text;
      }
    };
  });

  const completeListening100 = () => {
    const questionOptions = screen.getAllByRole('button').filter(
      (btn) => btn.className.includes('bg-slate-850')
    );
    fireEvent.click(questionOptions[0]);
    fireEvent.click(questionOptions[4]);
    fireEvent.click(questionOptions[8]);
    fireEvent.click(questionOptions[12]);
    fireEvent.click(screen.getByText('Hoàn thành Listening & Sang Reading'));
  };

  const completeReading100 = () => {
    const readingOptions = screen.getAllByRole('button').filter(
      (btn) => btn.className.includes('bg-slate-850')
    );
    fireEvent.click(readingOptions[0]);
    fireEvent.click(readingOptions[5]);
    fireEvent.click(readingOptions[9]);
    fireEvent.click(readingOptions[12]);
    fireEvent.click(readingOptions[17]);
    fireEvent.click(screen.getByText('Hoàn thành Reading & Sang Speaking'));
  };

  const recordAllSpeakingTurns = () => {
    fireEvent.click(screen.getByTestId('btn-record-speaking-turn-0'));
    fireEvent.click(screen.getByTestId('btn-record-speaking-turn-1'));
    fireEvent.click(screen.getByTestId('btn-record-speaking-turn-2'));
  };

  const enterWritingEssay = (text: string) => {
    const textarea = screen.getByPlaceholderText(/Viết bài văn của bạn tại đây/i);
    fireEvent.change(textarea, { target: { value: text } });
  };

  it('renders modal in intro stage with level badge and 4 skills overview', () => {
    render(
      <CEFRCheckpointSessionModal
        level="A2"
        isOpen={true}
        onClose={vi.fn()}
      />
    );

    expect(screen.getByText('Bài Thi Đánh Giá Chứng Chỉ CEFR A2')).toBeTruthy();
    expect(screen.getByText('1. Listening')).toBeTruthy();
    expect(screen.getByText('2. Reading')).toBeTruthy();
    expect(screen.getByText('3. Speaking')).toBeTruthy();
    expect(screen.getByText('4. Writing')).toBeTruthy();
    expect(screen.getByText('Bắt đầu bài thi')).toBeTruthy();
  });

  it('does not render when isOpen is false', () => {
    const { container } = render(
      <CEFRCheckpointSessionModal
        level="A2"
        isOpen={false}
        onClose={vi.fn()}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('runs an attempt through 4 section stages and shows result summary without losing state', async () => {
    const handleCertified = vi.fn();

    render(
      <CEFRCheckpointSessionModal
        level="A1"
        isOpen={true}
        onClose={vi.fn()}
        onCertified={handleCertified}
      />
    );

    // 1. Click start
    fireEvent.click(screen.getByText('Bắt đầu bài thi'));

    // Should now be at Listening section
    expect(screen.getByText(/Phần 1: Listening Comprehension/i)).toBeTruthy();
    expect(screen.getByText('Phần LISTENING')).toBeTruthy();

    // Check audio play count badge
    expect(screen.getByTestId('listening-plays-badge')).toBeTruthy();
    expect(screen.getByText(/Lượt nghe: 0\/2/i)).toBeTruthy();

    // Play audio
    const playBtn = screen.getByTestId('btn-play-listening-audio');
    fireEvent.click(playBtn);
    expect(screen.getByText(/Lượt nghe: 1\/2/i)).toBeTruthy();

    // Try completing Listening with 0 answers -> Insufficient evidence block!
    fireEvent.click(screen.getByText('Hoàn thành Listening & Sang Reading'));
    expect(screen.getByTestId('listening-validation-alert')).toBeTruthy();
    expect(screen.getByText(/Vui lòng chọn ít nhất một câu trả lời/i)).toBeTruthy();

    // Answer Listening 100% and advance to Reading
    completeListening100();

    expect(screen.getByText(/Phần 2: Reading Comprehension/i)).toBeTruthy();
    expect(screen.getByText('Phần READING')).toBeTruthy();
    expect(screen.getByTestId('reading-passage-assessment-mode')).toBeTruthy();

    // Try completing Reading with 0 answers -> Insufficient evidence block!
    fireEvent.click(screen.getByText('Hoàn thành Reading & Sang Speaking'));
    expect(screen.getByTestId('reading-validation-alert')).toBeTruthy();
    expect(screen.getByText(/Vui lòng chọn ít nhất một câu trả lời/i)).toBeTruthy();

    // Answer Reading 100% and advance to Speaking
    completeReading100();

    expect(screen.getByText(/Phần 3: Speaking Assessment/i)).toBeTruthy();
    expect(screen.getByText('Phần SPEAKING')).toBeTruthy();

    // Try completing Speaking with 0 speech recordings -> Insufficient evidence block!
    fireEvent.click(screen.getByText('Hoàn thành Speaking & Sang Writing'));
    expect(screen.getByTestId('speaking-validation-alert')).toBeTruthy();
    expect(screen.getByText(/Vui lòng hoàn thành phản xạ giọng nói cho tất cả các lượt đối thoại/i)).toBeTruthy();

    // Record speech for all 3 turns with trusted evidence
    recordAllSpeakingTurns();

    // Transcripts should now be rendered
    expect(screen.getByTestId('speaking-transcript-0')).toBeTruthy();
    expect(screen.getByTestId('speaking-transcript-1')).toBeTruthy();
    expect(screen.getByTestId('speaking-transcript-2')).toBeTruthy();

    // Complete Speaking -> Advances to Writing!
    fireEvent.click(screen.getByText('Hoàn thành Speaking & Sang Writing'));
    expect(screen.getByText(/Phần 4: Writing Assessment/i)).toBeTruthy();
    expect(screen.getByText('Phần WRITING')).toBeTruthy();

    // Writing section checks:
    expect(screen.getByTestId('writing-word-count-badge')).toBeTruthy();
    expect(screen.getByText(/0 từ \(còn thiếu 40 từ\)/i)).toBeTruthy();

    // Try submitting with 0 words -> validation alert block!
    fireEvent.click(screen.getByTestId('btn-complete-writing-section'));
    expect(screen.getByTestId('writing-validation-alert')).toBeTruthy();
    expect(screen.getByText(/Vui lòng nhập bài viết của bạn/i)).toBeTruthy();

    // Enter short text (< 40 words) -> word count alert block!
    enterWritingEssay('My name is Nam. I live in Hanoi.');
    fireEvent.click(screen.getByTestId('btn-complete-writing-section'));
    expect(screen.getByTestId('writing-validation-alert')).toBeTruthy();
    expect(screen.getByText(/Bài viết cần đạt tối thiểu 40 từ/i)).toBeTruthy();

    // Enter valid essay (>= 40 words)
    enterWritingEssay(sampleValidA1Essay);
    expect(screen.getByTestId('writing-word-count-badge')).toBeTruthy();
    expect(screen.getByText(/✓ Đủ từ/i)).toBeTruthy();

    // Complete Writing -> calls submitWritingSection and advances to evaluation & result!
    fireEvent.click(screen.getByTestId('btn-complete-writing-section'));

    await waitFor(() => {
      expect(screen.getByText('Chúc Mừng! Bạn Đã Đạt Chứng Chỉ CEFR A1!')).toBeTruthy();
    });

    expect(screen.getByText('Đóng và Trở Về')).toBeTruthy();
    expect(handleCertified).toHaveBeenCalledWith('A1');

    // Store should have recorded the completed certification
    const state = useAppStore.getState();
    expect(state.levelCertifications?.A1).toBeDefined();
    expect(state.levelCertifications?.A1?.level).toBe('A1');
  });

  it('shows failed summary when listening score does not meet the skill floor threshold', async () => {
    const handleCertified = vi.fn();

    render(
      <CEFRCheckpointSessionModal
        level="A1"
        isOpen={true}
        onClose={vi.fn()}
        onCertified={handleCertified}
      />
    );

    // Start exam
    fireEvent.click(screen.getByText('Bắt đầu bài thi'));

    // Only answer 1 question out of 4 (score: 25%, floor required: 55%)
    const questionOptions = screen.getAllByRole('button').filter(
      (btn) => btn.className.includes('bg-slate-850')
    );
    fireEvent.click(questionOptions[0]); // q1 correct (1/4 = 25%)

    // Advance to Reading
    fireEvent.click(screen.getByText('Hoàn thành Listening & Sang Reading'));

    // Complete Reading 100%
    completeReading100();

    // Complete Speaking 100%
    recordAllSpeakingTurns();
    fireEvent.click(screen.getByText('Hoàn thành Speaking & Sang Writing'));

    // Complete Writing 100%
    enterWritingEssay(sampleValidA1Essay);
    fireEvent.click(screen.getByTestId('btn-complete-writing-section'));

    await waitFor(() => {
      expect(screen.getByText('Kết Quả Bài Thi Checkpoint CEFR A1')).toBeTruthy();
    });

    // Should show failed evaluation summary
    expect(screen.getByText(/Rất tiếc bài thi chưa đạt tiêu chuẩn cấp chứng chỉ kỳ này/i)).toBeTruthy();
    expect(handleCertified).not.toHaveBeenCalled();

    // Store should NOT have saved the certification
    const state = useAppStore.getState();
    expect(state.levelCertifications?.A1).toBeUndefined();
  });

  it('shows failed summary when reading score does not meet the skill floor threshold', async () => {
    const handleCertified = vi.fn();

    render(
      <CEFRCheckpointSessionModal
        level="A1"
        isOpen={true}
        onClose={vi.fn()}
        onCertified={handleCertified}
      />
    );

    // Start exam
    fireEvent.click(screen.getByText('Bắt đầu bài thi'));

    // Listening: All 4 correct (100%)
    completeListening100();

    // Reading: Only 1 correct out of 5 (20%, below 55% floor threshold)
    const readingOptions = screen.getAllByRole('button').filter(
      (btn) => btn.className.includes('bg-slate-850')
    );
    fireEvent.click(readingOptions[0]); // rq_a1_1_1 correct (1/5 = 20%)
    fireEvent.click(readingOptions[4]); // rq_a1_1_2 wrong (option 0 chosen, correct is 1)
    fireEvent.click(readingOptions[8]); // rq_a1_1_3 wrong (option 0 chosen, correct is 1)
    fireEvent.click(readingOptions[13]); // rq_a1_1_4 wrong (option 1 chosen, correct is 0)
    fireEvent.click(readingOptions[16]); // rq_a1_1_5 wrong (option 0 chosen, correct is 1)

    fireEvent.click(screen.getByText('Hoàn thành Reading & Sang Speaking'));

    // Speaking: 100%
    recordAllSpeakingTurns();
    fireEvent.click(screen.getByText('Hoàn thành Speaking & Sang Writing'));

    // Writing: 100%
    enterWritingEssay(sampleValidA1Essay);
    fireEvent.click(screen.getByTestId('btn-complete-writing-section'));

    await waitFor(() => {
      expect(screen.getByText('Kết Quả Bài Thi Checkpoint CEFR A1')).toBeTruthy();
    });

    // Should show failed evaluation summary due to reading floor failure
    expect(screen.getByText(/Rất tiếc bài thi chưa đạt tiêu chuẩn cấp chứng chỉ kỳ này/i)).toBeTruthy();
    expect(handleCertified).not.toHaveBeenCalled();

    // Store should NOT have saved the certification
    const state = useAppStore.getState();
    expect(state.levelCertifications?.A1).toBeUndefined();
  });

  it('shows failed summary when speaking score does not meet the skill floor threshold', async () => {
    const handleCertified = vi.fn();

    // Mock speech recognition to return completely wrong words (below floor threshold)
    vi.mocked(speechService.startSpeechRecognition).mockImplementation((opts: any) => {
      opts.onResult?.('cat apple dog random noise', true);
      opts.onEnd?.();
      return {
        recognition: {},
        stop: vi.fn(),
      };
    });

    render(
      <CEFRCheckpointSessionModal
        level="A1"
        isOpen={true}
        onClose={vi.fn()}
        onCertified={handleCertified}
      />
    );

    // Start exam
    fireEvent.click(screen.getByText('Bắt đầu bài thi'));

    // Listening: 100%
    completeListening100();

    // Reading: 100%
    completeReading100();

    // Speaking: Low accuracy recordings
    recordAllSpeakingTurns();
    fireEvent.click(screen.getByText('Hoàn thành Speaking & Sang Writing'));

    // Writing: 100%
    enterWritingEssay(sampleValidA1Essay);
    fireEvent.click(screen.getByTestId('btn-complete-writing-section'));

    await waitFor(() => {
      expect(screen.getByText('Kết Quả Bài Thi Checkpoint CEFR A1')).toBeTruthy();
    });

    // Should show failed evaluation summary due to speaking floor failure
    expect(screen.getByText(/Rất tiếc bài thi chưa đạt tiêu chuẩn cấp chứng chỉ kỳ này/i)).toBeTruthy();
    expect(handleCertified).not.toHaveBeenCalled();

    // Store should NOT have saved the certification
    const state = useAppStore.getState();
    expect(state.levelCertifications?.A1).toBeUndefined();
  });

  it('shows failed summary when writing score does not meet the skill floor threshold', async () => {
    const handleCertified = vi.fn();

    // Mock gradeEssay to return low overall score (40% < 55% floor threshold)
    vi.mocked(essayGradingService.gradeEssay).mockResolvedValue({
      overallScore: 40,
      overallCEFR: 'A1',
      wordCount: 50,
      criteria: {
        taskAchievement: { score: 40, cefrLevel: 'A1', feedback: 'Chưa đạt' },
        coherenceCohesion: { score: 40, cefrLevel: 'A1', feedback: 'Chưa đạt' },
        lexicalResource: { score: 40, cefrLevel: 'A1', feedback: 'Chưa đạt' },
        grammaticalAccuracy: { score: 40, cefrLevel: 'A1', feedback: 'Chưa đạt' },
      },
      strengths: [],
      improvements: [],
      diffSegments: [{ type: 'unchanged', originalText: 'test' }],
      fullRevisedEssay: sampleValidA1Essay,
      isFallback: false,
    });

    render(
      <CEFRCheckpointSessionModal
        level="A1"
        isOpen={true}
        onClose={vi.fn()}
        onCertified={handleCertified}
      />
    );

    // Start exam -> Listening 100% -> Reading 100% -> Speaking 100%
    fireEvent.click(screen.getByText('Bắt đầu bài thi'));
    completeListening100();
    completeReading100();
    recordAllSpeakingTurns();
    fireEvent.click(screen.getByText('Hoàn thành Speaking & Sang Writing'));

    // Writing: 40% (floor failure)
    enterWritingEssay(sampleValidA1Essay);
    fireEvent.click(screen.getByTestId('btn-complete-writing-section'));

    await waitFor(() => {
      expect(screen.getByText('Kết Quả Bài Thi Checkpoint CEFR A1')).toBeTruthy();
    });

    expect(screen.getByText(/Rất tiếc bài thi chưa đạt tiêu chuẩn cấp chứng chỉ kỳ này/i)).toBeTruthy();
    expect(handleCertified).not.toHaveBeenCalled();

    const state = useAppStore.getState();
    expect(state.levelCertifications?.A1).toBeUndefined();
  });

  it('blocks advancing when writing AI returns mock fallback and allows retry', async () => {
    // Mock gradeEssay to return fallback data (isFallback: true)
    vi.mocked(essayGradingService.gradeEssay).mockResolvedValue({
      overallScore: 78,
      overallCEFR: 'B2',
      wordCount: 50,
      criteria: {
        taskAchievement: { score: 78, cefrLevel: 'B2', feedback: '' },
        coherenceCohesion: { score: 78, cefrLevel: 'B2', feedback: '' },
        lexicalResource: { score: 78, cefrLevel: 'B2', feedback: '' },
        grammaticalAccuracy: { score: 78, cefrLevel: 'B2', feedback: '' },
      },
      strengths: [],
      improvements: [],
      diffSegments: [],
      fullRevisedEssay: '',
      isFallback: true, // UNTRUSTED FALLBACK
    });

    render(
      <CEFRCheckpointSessionModal
        level="A1"
        isOpen={true}
        onClose={vi.fn()}
      />
    );

    // Start exam -> Listening 100% -> Reading 100% -> Speaking 100%
    fireEvent.click(screen.getByText('Bắt đầu bài thi'));
    completeListening100();
    completeReading100();
    recordAllSpeakingTurns();
    fireEvent.click(screen.getByText('Hoàn thành Speaking & Sang Writing'));

    // Enter essay and submit
    enterWritingEssay(sampleValidA1Essay);
    fireEvent.click(screen.getByTestId('btn-complete-writing-section'));

    await waitFor(() => {
      expect(screen.getByTestId('writing-grading-error-alert')).toBeTruthy();
    });

    // Alert must warn about fallback data
    expect(screen.getByText(/Không thể cấp chứng chỉ bằng dữ liệu chấm điểm giả lập/i)).toBeTruthy();

    // Retry button must be available
    expect(screen.getByTestId('btn-retry-writing-grading')).toBeTruthy();

    // Must still remain on writing stage (did NOT advance or fabricate certificate score)
    expect(screen.getByText('Phần WRITING')).toBeTruthy();
  });

  it('blocks advancing when microphone permission is denied and shows alert', () => {
    // Mock speech recognition to trigger permission-denied error
    vi.mocked(speechService.startSpeechRecognition).mockImplementation((opts: any) => {
      opts.onError?.('Microphone permission denied', { code: 'permission-denied' });
      return {
        recognition: {},
        stop: vi.fn(),
      };
    });

    render(
      <CEFRCheckpointSessionModal
        level="A1"
        isOpen={true}
        onClose={vi.fn()}
      />
    );

    // Start exam -> Listening 100% -> Reading 100% -> Speaking
    fireEvent.click(screen.getByText('Bắt đầu bài thi'));
    completeListening100();
    completeReading100();

    expect(screen.getByText(/Phần 3: Speaking Assessment/i)).toBeTruthy();

    // Click record on turn 0 -> triggers permission-denied error
    fireEvent.click(screen.getByTestId('btn-record-speaking-turn-0'));

    expect(screen.getByTestId('speaking-validation-alert')).toBeTruthy();
    expect(screen.getByText(/Quyền truy cập Microphone bị từ chối/i)).toBeTruthy();

    // Try completing section -> blocked!
    fireEvent.click(screen.getByText('Hoàn thành Speaking & Sang Writing'));
    expect(screen.getByText(/Quyền Microphone bị từ chối/i)).toBeTruthy();
    // Verify it stays on Speaking
    expect(screen.getByText('Phần SPEAKING')).toBeTruthy();
  });

  it('displays unsupported browser alert when Web Speech API is not available', () => {
    vi.mocked(speechService.isSpeechRecognitionSupported).mockReturnValue(false);

    render(
      <CEFRCheckpointSessionModal
        level="A1"
        isOpen={true}
        onClose={vi.fn()}
      />
    );

    // Start exam -> Listening 100% -> Reading 100% -> Speaking
    fireEvent.click(screen.getByText('Bắt đầu bài thi'));
    completeListening100();
    completeReading100();

    expect(screen.getByText(/Phần 3: Speaking Assessment/i)).toBeTruthy();

    // Unsupported alert banner must be visible in assessment mode
    expect(screen.getByTestId('speaking-unsupported-alert')).toBeTruthy();
    expect(screen.getByText(/Trình duyệt hiện tại chưa hỗ trợ nhận diện giọng nói/i)).toBeTruthy();

    // Completing section must be blocked
    fireEvent.click(screen.getByText('Hoàn thành Speaking & Sang Writing'));
    expect(screen.getByTestId('speaking-validation-alert')).toBeTruthy();
    expect(screen.getByText(/Trình duyệt hiện tại chưa hỗ trợ Web Speech API/i)).toBeTruthy();
    expect(screen.getByText('Phần SPEAKING')).toBeTruthy();
  });

  it('handles exit during active exam by preserving draft in store', () => {
    const handleClose = vi.fn();

    render(
      <CEFRCheckpointSessionModal
        level="B1"
        isOpen={true}
        onClose={handleClose}
      />
    );

    // Start exam
    fireEvent.click(screen.getByText('Bắt đầu bài thi'));
    expect(screen.getByText(/Phần 1: Listening Comprehension/i)).toBeTruthy();

    // Click Exit button in progress header
    const exitBtn = screen.getByTitle('Thoát phiên học');
    fireEvent.click(exitBtn);

    expect(handleClose).toHaveBeenCalledTimes(1);

    // Verify activity was saved in store
    const state = useAppStore.getState();
    const activities = Object.values(state.resumeActivities || {});
    expect(activities.length).toBeGreaterThan(0);
    const act = activities.find((a) => a.type === 'checkpoint' && a.checkpoint.level === 'B1');
    expect(act).toBeDefined();
    expect(act?.completed).toBe(false);
  });
});
