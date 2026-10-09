// src/components/__tests__/toeicListeningPart3And4.test.tsx
// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { ToeicListeningGroupView } from '../toeic/ToeicListeningGroupView';
import { ToeicListeningBar } from '../toeic/ToeicListeningBar';
import {
  ToeicListeningEngineState,
  DEFAULT_LISTENING_POLICIES,
  NormalizedToeicListeningGroup,
  Part3ListeningGroup,
  Part4ListeningGroup,
} from '../../types/toeicListening';
import { ToeicQuestion } from '../../types/toeic';
import { ToeicListeningEngine } from '../../services/toeicListeningEngine';
import { resolveNormalizedListeningGroup } from '../../services/toeicListeningNormalizer';

// Mock audio element
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

const mockP3Questions: ToeicQuestion[] = [
  {
    id: 'p3_q1',
    part: 'part3_conv',
    skill: 'listening',
    groupId: 'p3_g1',
    audioGroupId: 'audio_p3_g1',
    questionText: 'Where does the conversation most likely take place?',
    options: [
      'A. At a hotel reception',
      'B. In a car dealership',
      'C. At a medical clinic',
      'D. In an airport terminal',
    ],
    correctAnswer: 'A',
    explanation: 'The woman mentions checking into her reserved room.',
    vietnameseTranslation: 'Cuộc trò chuyện diễn ra ở đâu?',
  },
  {
    id: 'p3_q2',
    part: 'part3_conv',
    skill: 'listening',
    groupId: 'p3_g1',
    audioGroupId: 'audio_p3_g1',
    questionText: 'What problem does the woman mention?',
    options: [
      'A. Her flight was canceled',
      'B. Her room key is not working',
      'C. Her luggage was misplaced',
      'D. The reservation date is incorrect',
    ],
    correctAnswer: 'B',
    explanation: 'The woman states the keycard fails to unlock room 402.',
    vietnameseTranslation: 'Người phụ nữ gặp vấn đề gì?',
  },
  {
    id: 'p3_q3',
    part: 'part3_conv',
    skill: 'listening',
    groupId: 'p3_g1',
    audioGroupId: 'audio_p3_g1',
    questionText: 'What will the man do next?',
    options: [
      'A. Contact the manager',
      'B. Issue a replacement card',
      'C. Refund the deposit',
      'D. Upgrade the suite',
    ],
    correctAnswer: 'B',
    explanation: 'The man offers to reprogram a new keycard immediately.',
    vietnameseTranslation: 'Người đàn ông sẽ làm gì tiếp theo?',
  },
];

const mockP3Group: Part3ListeningGroup = {
  id: 'p3_g1',
  audioGroupId: 'audio_p3_g1',
  part: 'part3_conv',
  title: 'Khách sạn & Dịch vụ tiếp tân',
  topic: 'Hospitality',
  difficulty: 'medium',
  audioSource: {
    sourceType: 'recorded',
    audioUrl: 'https://cdn.example.com/p3_g1.mp3',
    accent: 'en-US',
    durationMs: 35000,
    isFallback: false,
  },
  transcript: {
    fullText:
      'Man: Welcome back to the Grand Hotel. How may I help you today? Woman: Hello, I just tried to access room 402, but the keycard does not seem to unlock the door. Man: I apologize for the inconvenience. Let me reprogram a new keycard for you right away.',
    hasTiming: true,
    segments: [
      {
        id: 'p3_seg_1',
        speaker: 'Man',
        text: 'Welcome back to the Grand Hotel. How may I help you today?',
        startMs: 0,
        endMs: 6000,
      },
      {
        id: 'p3_seg_2',
        speaker: 'Woman',
        text: 'Hello, I just tried to access room 402, but the keycard does not seem to unlock the door.',
        startMs: 6500,
        endMs: 16000,
      },
      {
        id: 'p3_seg_3',
        speaker: 'Man',
        text: 'I apologize for the inconvenience. Let me reprogram a new keycard for you right away.',
        startMs: 16500,
        endMs: 24000,
      },
    ],
  },
  questionIds: ['p3_q1', 'p3_q2', 'p3_q3'],
};

const mockP4Group: Part4ListeningGroup = {
  id: 'p4_g1',
  audioGroupId: 'audio_p4_g1',
  part: 'part4_talks',
  title: 'Thông báo nội bộ công ty',
  topic: 'Corporate Announcement',
  difficulty: 'hard',
  imageUrl: 'https://images.example.com/p4_chart.png',
  audioSource: {
    sourceType: 'recorded',
    audioUrl: 'https://cdn.example.com/p4_g1.mp3',
    accent: 'en-GB',
    durationMs: 40000,
    isFallback: false,
  },
  transcript: {
    fullText:
      'Narrator: Attention all staff members. The third quarter financial report indicates a 15% increase in overseas shipments.',
    hasTiming: false,
    segments: [
      {
        id: 'p4_seg_1',
        speaker: 'Narrator',
        text: 'Attention all staff members. The third quarter financial report indicates a 15% increase in overseas shipments.',
        startMs: 0,
        endMs: 10000,
      },
    ],
  },
  questionIds: ['p4_q1', 'p4_q2', 'p4_q3'],
};

const baseEngineState: ToeicListeningEngineState = {
  status: 'ready',
  currentGroupId: 'p3_g1',
  currentAudioGroupId: 'audio_p3_g1',
  sourceType: 'recorded',
  audioUrl: 'https://cdn.example.com/p3_g1.mp3',
  currentTimeMs: 0,
  durationMs: 35000,
  playbackRate: 1.0,
  volume: 1.0,
  isMuted: false,
  hasPlayed: false,
  playCount: 0,
  activeSegmentIndex: -1,
  activeSegment: null,
  isEligibleToPlay: true,
};

describe('PHASE 5: TOEIC Part 3/4 Group-Based Audio Integration Suite', () => {
  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  // ===========================================================================
  // 1. DATA MODEL & INVARIANTS: 1 GROUP -> 1 AUDIO IDENTITY -> MULTIPLE QUESTIONS
  // ===========================================================================
  describe('1. Group Model & Audio Identity Invariants', () => {
    it('Tất cả câu hỏi trong cùng một nhóm Part 3 chia sẻ chung 1 groupId và 1 audioGroupId duy nhất', () => {
      const q1 = mockP3Questions[0];
      const q2 = mockP3Questions[1];
      const q3 = mockP3Questions[2];

      // Đảm bảo cùng groupId
      expect(q1.groupId).toBe('p3_g1');
      expect(q2.groupId).toBe('p3_g1');
      expect(q3.groupId).toBe('p3_g1');

      // Đảm bảo cùng audioGroupId
      expect(q1.audioGroupId).toBe('audio_p3_g1');
      expect(q2.audioGroupId).toBe('audio_p3_g1');
      expect(q3.audioGroupId).toBe('audio_p3_g1');

      // Nhóm chuẩn hóa chứa đủ 3 câu hỏi
      expect(mockP3Group.questionIds).toEqual(['p3_q1', 'p3_q2', 'p3_q3']);
      expect(mockP3Group.audioSource.audioUrl).toBe('https://cdn.example.com/p3_g1.mp3');
    });

    it('resolveNormalizedListeningGroup giải quyết cùng một nhóm cho mọi câu con', () => {
      const resolved1 = resolveNormalizedListeningGroup(mockP3Questions[0]);
      const resolved2 = resolveNormalizedListeningGroup(mockP3Questions[1]);

      expect(resolved1.id).toBe(resolved2.id);
      expect(resolved1.audioGroupId).toBe(resolved2.audioGroupId);
      expect(resolved1.audioSource.audioUrl).toBe(resolved2.audioSource.audioUrl);
    });
  });

  // ===========================================================================
  // 2. UI GROUP PRESENTATION & NAVIGATION
  // ===========================================================================
  describe('2. UI Group Context, Badges & Navigation Tabs', () => {
    it('Hiển thị huy hiệu Part 3, chủ đề, tiến độ nhóm (Câu 1/3) và toàn bài', () => {
      render(
        <ToeicListeningGroupView
          group={mockP3Group}
          currentQuestion={mockP3Questions[0]}
          childQuestions={mockP3Questions}
          questionIndexWithinGroup={0}
          globalQuestionNumber={41}
          totalExamQuestions={200}
          userAnswers={{}}
          onSelectAnswer={vi.fn()}
          onNavigateToChildQuestion={vi.fn()}
          policy={DEFAULT_LISTENING_POLICIES.practice}
          engineState={baseEngineState}
          onPlay={vi.fn()}
          onPause={vi.fn()}
          revealedTranscript={false}
          onToggleTranscript={vi.fn()}
        />
      );

      // Part badge & Topic
      expect(screen.getByText(/Part 3: Conversations/i)).toBeTruthy();
      expect(screen.getByText('Hospitality')).toBeTruthy();
      expect(screen.getByText('Khách sạn & Dịch vụ tiếp tân')).toBeTruthy();

      // Position indicators
      expect(screen.getByText(/Câu hỏi nhóm:/i)).toBeTruthy();
      expect(screen.getByText(/Toàn bài:/i)).toBeTruthy();
      expect(screen.getByText('41')).toBeTruthy();
      expect(screen.getByText(/200/)).toBeTruthy();
    });

    it('Hiển thị đầy đủ các Tab câu hỏi con và gọi callback khi chuyển câu', () => {
      const onNavigate = vi.fn();
      render(
        <ToeicListeningGroupView
          group={mockP3Group}
          currentQuestion={mockP3Questions[0]}
          childQuestions={mockP3Questions}
          questionIndexWithinGroup={0}
          globalQuestionNumber={41}
          totalExamQuestions={200}
          userAnswers={{ p3_q1: 'A' }}
          onSelectAnswer={vi.fn()}
          onNavigateToChildQuestion={onNavigate}
          policy={DEFAULT_LISTENING_POLICIES.practice}
          engineState={baseEngineState}
          onPlay={vi.fn()}
          onPause={vi.fn()}
          revealedTranscript={false}
          onToggleTranscript={vi.fn()}
        />
      );

      // Hiển thị tab Câu 1, Câu 2, Câu 3
      expect(screen.getByText('Câu 1')).toBeTruthy();
      expect(screen.getByText('Câu 2')).toBeTruthy();
      expect(screen.getByText('Câu 3')).toBeTruthy();

      // Câu 1 đã trả lời hiển thị đáp án 'A'
      expect(screen.getAllByText('A').length).toBeGreaterThan(0);

      // Bấm vào tab Câu 2
      const tab2 = screen.getByRole('tab', { name: /Câu hỏi 2/i });
      fireEvent.click(tab2);
      expect(onNavigate).toHaveBeenCalledWith(1);

      // Bấm nút "Câu tiếp trong đoạn"
      const nextBtn = screen.getByRole('button', { name: /Câu tiếp trong đoạn/i });
      fireEvent.click(nextBtn);
      expect(onNavigate).toHaveBeenCalledWith(1);
    });
  });

  // ===========================================================================
  // 3. ZERO AUDIO RELOAD / RESET INVARIANT (Q1 -> Q2 -> Q3)
  // ===========================================================================
  describe('3. Zero Audio Reload / Reset Invariant Trong Cùng Nhóm', () => {
    it('Chuyển câu hỏi con trong cùng nhóm KHÔNG gọi loadGroup làm reset audio engine', async () => {
      const fakeAudio = new MockAudioElement();
      const audioFactory = () => fakeAudio as any;
      const engine = new ToeicListeningEngine({ audioFactory });

      const loadGroupSpy = vi.spyOn(engine, 'loadGroup');
      const stopSpy = vi.spyOn(engine, 'stop');

      // Nạp nhóm ban đầu (khi bắt đầu câu Q1)
      engine.loadGroup(mockP3Group, DEFAULT_LISTENING_POLICIES.practice);
      fakeAudio.emit('canplay');
      expect(engine.getState().currentGroupId).toBe('p3_g1');
      expect(loadGroupSpy).toHaveBeenCalledTimes(1);

      // Bắt đầu phát audio
      await engine.play();
      expect(engine.getState().status).toBe('playing');

      // Giả lập thí sinh chuyển từ Q1 sang Q2 (gọi loadGroup với cùng mockP3Group)
      engine.loadGroup(mockP3Group, DEFAULT_LISTENING_POLICIES.practice);

      // Group Lifecycle Guard ngăn chặn việc stop hoặc reload!
      expect(stopSpy).not.toHaveBeenCalled();
      expect(engine.getState().status).toBe('playing');
      expect(engine.getState().currentGroupId).toBe('p3_g1');

      // Giả lập thí sinh chuyển từ Q2 sang Q3
      engine.loadGroup(mockP3Group, DEFAULT_LISTENING_POLICIES.practice);
      expect(stopSpy).not.toHaveBeenCalled();
      expect(engine.getState().status).toBe('playing');

      engine.dispose();
    });

    it('Audio state và thời gian phát được bảo tồn nguyên vẹn khi người dùng trả lời Q1 rồi chuyển Q2', () => {
      const playingState: ToeicListeningEngineState = {
        ...baseEngineState,
        status: 'playing',
        currentTimeMs: 12500,
        hasPlayed: true,
        playCount: 1,
      };

      const { rerender } = render(
        <ToeicListeningGroupView
          group={mockP3Group}
          currentQuestion={mockP3Questions[0]}
          childQuestions={mockP3Questions}
          questionIndexWithinGroup={0}
          globalQuestionNumber={41}
          totalExamQuestions={200}
          userAnswers={{}}
          onSelectAnswer={vi.fn()}
          onNavigateToChildQuestion={vi.fn()}
          policy={DEFAULT_LISTENING_POLICIES.practice}
          engineState={playingState}
          onPlay={vi.fn()}
          onPause={vi.fn()}
          revealedTranscript={false}
          onToggleTranscript={vi.fn()}
        />
      );

      // Đang phát audio
      expect(screen.getByText('Tạm dừng')).toBeTruthy();

      // Thí sinh chọn đáp án B cho câu 1 rồi chuyển sang câu 2
      rerender(
        <ToeicListeningGroupView
          group={mockP3Group}
          currentQuestion={mockP3Questions[1]}
          childQuestions={mockP3Questions}
          questionIndexWithinGroup={1}
          globalQuestionNumber={42}
          totalExamQuestions={200}
          userAnswers={{ p3_q1: 'B' }}
          onSelectAnswer={vi.fn()}
          onNavigateToChildQuestion={vi.fn()}
          policy={DEFAULT_LISTENING_POLICIES.practice}
          engineState={playingState}
          onPlay={vi.fn()}
          onPause={vi.fn()}
          revealedTranscript={false}
          onToggleTranscript={vi.fn()}
        />
      );

      // Audio vẫn tiếp tục hiển thị trạng thái đang phát (Tạm dừng)
      expect(screen.getByText('Tạm dừng')).toBeTruthy();
      // Câu hỏi 2 hiển thị nội dung mới
      expect(screen.getByText('What problem does the woman mention?')).toBeTruthy();
    });
  });

  // ===========================================================================
  // 4. GROUP CHANGE CLEANUP (G1 -> G2)
  // ===========================================================================
  describe('4. Group Change Cleanup & Initialization', () => {
    it('Chuyển từ nhóm Hội thoại (G1) sang nhóm Bài nói (G2) lập tức dọn dẹp audio cũ và khởi tạo nhóm mới', async () => {
      const fakeAudio = new MockAudioElement();
      const audioFactory = () => fakeAudio as any;
      const engine = new ToeicListeningEngine({ audioFactory });

      // Nạp nhóm G1 và bắt đầu phát
      engine.loadGroup(mockP3Group, DEFAULT_LISTENING_POLICIES.practice);
      fakeAudio.emit('canplay');
      await engine.play();
      expect(engine.getState().status).toBe('playing');
      expect(engine.getState().currentGroupId).toBe('p3_g1');

      // Chuyển sang nhóm Part 4 (G2)
      engine.loadGroup(mockP4Group, DEFAULT_LISTENING_POLICIES.practice);

      // G1 đã bị dọn dẹp, G2 được nạp với state ready/idle
      expect(engine.getState().currentGroupId).toBe('p4_g1');
      expect(engine.getState().currentAudioGroupId).toBe('audio_p4_g1');
      expect(engine.getState().audioUrl).toBe('https://cdn.example.com/p4_g1.mp3');
      expect(fakeAudio.paused).toBe(true);

      engine.dispose();
    });
  });

  // ===========================================================================
  // 5. MOCK EXAM POLICY ENFORCEMENT ON SHARED GROUP AUDIO
  // ===========================================================================
  describe('5. Mock Exam vs Practice Mode Policy Enforcement', () => {
    it('Mock Exam: Phát audio 1 lần cho cả cụm nhóm, khóa Replay trên toàn bộ 3 câu hỏi', () => {
      const mockLockedState: ToeicListeningEngineState = {
        ...baseEngineState,
        status: 'ended',
        hasPlayed: true,
        playCount: 1,
        isEligibleToPlay: false,
      };

      // Hiển thị ở Q1
      const { rerender } = render(
        <ToeicListeningGroupView
          group={mockP3Group}
          currentQuestion={mockP3Questions[0]}
          childQuestions={mockP3Questions}
          questionIndexWithinGroup={0}
          globalQuestionNumber={41}
          totalExamQuestions={200}
          userAnswers={{}}
          onSelectAnswer={vi.fn()}
          onNavigateToChildQuestion={vi.fn()}
          policy={DEFAULT_LISTENING_POLICIES.mock}
          engineState={mockLockedState}
          onPlay={vi.fn()}
          onPause={vi.fn()}
          revealedTranscript={false}
          onToggleTranscript={vi.fn()}
        />
      );

      // Nút phát bị khóa "Đã phát (1 lần)"
      const playBtnQ1 = screen.getByRole('button', { name: /Đã phát \(1 lần\)/i });
      expect(playBtnQ1.hasAttribute('disabled')).toBe(true);

      // Chuyển sang Q2
      rerender(
        <ToeicListeningGroupView
          group={mockP3Group}
          currentQuestion={mockP3Questions[1]}
          childQuestions={mockP3Questions}
          questionIndexWithinGroup={1}
          globalQuestionNumber={42}
          totalExamQuestions={200}
          userAnswers={{}}
          onSelectAnswer={vi.fn()}
          onNavigateToChildQuestion={vi.fn()}
          policy={DEFAULT_LISTENING_POLICIES.mock}
          engineState={mockLockedState}
          onPlay={vi.fn()}
          onPause={vi.fn()}
          revealedTranscript={false}
          onToggleTranscript={vi.fn()}
        />
      );

      // Ở Q2, nút phát VẪN BỊ KHÓA vì cùng shared group audio!
      const playBtnQ2 = screen.getByRole('button', { name: /Đã phát \(1 lần\)/i });
      expect(playBtnQ2.hasAttribute('disabled')).toBe(true);

      // Chuyển sang Q3
      rerender(
        <ToeicListeningGroupView
          group={mockP3Group}
          currentQuestion={mockP3Questions[2]}
          childQuestions={mockP3Questions}
          questionIndexWithinGroup={2}
          globalQuestionNumber={43}
          totalExamQuestions={200}
          userAnswers={{}}
          onSelectAnswer={vi.fn()}
          onNavigateToChildQuestion={vi.fn()}
          policy={DEFAULT_LISTENING_POLICIES.mock}
          engineState={mockLockedState}
          onPlay={vi.fn()}
          onPause={vi.fn()}
          revealedTranscript={false}
          onToggleTranscript={vi.fn()}
        />
      );

      // Ở Q3, nút phát VẪN BỊ KHÓA!
      const playBtnQ3 = screen.getByRole('button', { name: /Đã phát \(1 lần\)/i });
      expect(playBtnQ3.hasAttribute('disabled')).toBe(true);
    });

    it('Mock Exam: Tuyệt đối không render transcript container hay gây DOM leak', () => {
      render(
        <ToeicListeningGroupView
          group={mockP3Group}
          currentQuestion={mockP3Questions[0]}
          childQuestions={mockP3Questions}
          questionIndexWithinGroup={0}
          globalQuestionNumber={41}
          totalExamQuestions={200}
          userAnswers={{}}
          onSelectAnswer={vi.fn()}
          onNavigateToChildQuestion={vi.fn()}
          policy={DEFAULT_LISTENING_POLICIES.mock}
          engineState={baseEngineState}
          onPlay={vi.fn()}
          onPause={vi.fn()}
          revealedTranscript={true} // Dù prop true thì policy.showTranscript vẫn ngăn cản
          onToggleTranscript={vi.fn()}
        />
      );

      // Không có container transcript trong DOM
      expect(screen.queryByTestId('group-transcript-container')).toBeNull();
      expect(screen.queryByText(/Kịch Bản Lời Thoại/i)).toBeNull();
      expect(screen.queryByText(/Grand Hotel/i)).toBeNull();
    });

    it('Practice Mode: Hiển thị transcript phân vai (Speaker A/B, Man/Woman) và highlight đoạn', () => {
      const onSeek = vi.fn();
      const stateWithHighlight: ToeicListeningEngineState = {
        ...baseEngineState,
        status: 'playing',
        activeSegmentIndex: 1, // Segment của Woman đang active
      };

      render(
        <ToeicListeningGroupView
          group={mockP3Group}
          currentQuestion={mockP3Questions[0]}
          childQuestions={mockP3Questions}
          questionIndexWithinGroup={0}
          globalQuestionNumber={41}
          totalExamQuestions={200}
          userAnswers={{}}
          onSelectAnswer={vi.fn()}
          onNavigateToChildQuestion={vi.fn()}
          policy={DEFAULT_LISTENING_POLICIES.practice}
          engineState={stateWithHighlight}
          onPlay={vi.fn()}
          onPause={vi.fn()}
          onSeek={onSeek}
          revealedTranscript={true}
          onToggleTranscript={vi.fn()}
        />
      );

      // Transcript container hiển thị
      expect(screen.getByTestId('group-transcript-container')).toBeTruthy();

      // Speaker badges
      const manBadges = screen.getAllByText('Man');
      expect(manBadges.length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('Woman')).toBeTruthy();

      // Bấm vào segment để seek
      const womanSegment = screen.getByText(/I just tried to access room 402/i);
      fireEvent.click(womanSegment);
      expect(onSeek).toHaveBeenCalledWith(6500);
    });
  });

  // ===========================================================================
  // 6. ANSWER STATE PRESERVATION & PART 4 IMAGE RENDERING
  // ===========================================================================
  describe('6. Answer State Preservation & Part 4 Image Support', () => {
    it('Chọn đáp án cho câu hỏi con độc lập và không làm mất đáp án khi chuyển tab', () => {
      const onSelect = vi.fn();
      const { rerender } = render(
        <ToeicListeningGroupView
          group={mockP3Group}
          currentQuestion={mockP3Questions[0]}
          childQuestions={mockP3Questions}
          questionIndexWithinGroup={0}
          globalQuestionNumber={41}
          totalExamQuestions={200}
          userAnswers={{}}
          onSelectAnswer={onSelect}
          onNavigateToChildQuestion={vi.fn()}
          policy={DEFAULT_LISTENING_POLICIES.practice}
          engineState={baseEngineState}
          onPlay={vi.fn()}
          onPause={vi.fn()}
          revealedTranscript={false}
          onToggleTranscript={vi.fn()}
        />
      );

      // Thí sinh chọn phương án (A)
      const choiceA = screen.getByRole('button', { name: /Lựa chọn A/i });
      fireEvent.click(choiceA);
      expect(onSelect).toHaveBeenCalledWith('A');

      // Giả lập userAnswers đã lưu đáp án cho Q1 và Q2
      rerender(
        <ToeicListeningGroupView
          group={mockP3Group}
          currentQuestion={mockP3Questions[0]}
          childQuestions={mockP3Questions}
          questionIndexWithinGroup={0}
          globalQuestionNumber={41}
          totalExamQuestions={200}
          userAnswers={{ p3_q1: 'A', p3_q2: 'B' }}
          onSelectAnswer={onSelect}
          onNavigateToChildQuestion={vi.fn()}
          policy={DEFAULT_LISTENING_POLICIES.practice}
          engineState={baseEngineState}
          onPlay={vi.fn()}
          onPause={vi.fn()}
          revealedTranscript={false}
          onToggleTranscript={vi.fn()}
        />
      );

      // Lựa chọn A được đánh dấu selected
      expect(choiceA.getAttribute('aria-pressed')).toBe('true');
      // Tab 1 và Tab 2 hiển thị nhãn đáp án đã chọn
      expect(screen.getAllByText('A').length).toBeGreaterThan(0);
      expect(screen.getAllByText('B').length).toBeGreaterThan(0);
    });

    it('Part 4: Hiển thị hình ảnh biểu đồ đi kèm với alt text an toàn không lộ đáp án', () => {
      render(
        <ToeicListeningGroupView
          group={mockP4Group}
          currentQuestion={mockP3Questions[0]} // câu bất kỳ
          childQuestions={mockP3Questions}
          questionIndexWithinGroup={0}
          globalQuestionNumber={71}
          totalExamQuestions={200}
          userAnswers={{}}
          onSelectAnswer={vi.fn()}
          onNavigateToChildQuestion={vi.fn()}
          policy={DEFAULT_LISTENING_POLICIES.mock}
          engineState={baseEngineState}
          onPlay={vi.fn()}
          onPause={vi.fn()}
          revealedTranscript={false}
          onToggleTranscript={vi.fn()}
        />
      );

      const img = screen.getByRole('img');
      expect(img).toBeTruthy();
      expect(img.getAttribute('src')).toBe('https://images.example.com/p4_chart.png');
      // Alt text an toàn
      expect(img.getAttribute('alt')).not.toContain('A.');
      expect(img.getAttribute('alt')).not.toContain('correctAnswer');
    });
  });
});
