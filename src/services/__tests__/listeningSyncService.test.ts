import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  tokenizeSentence,
  parseDurationToSeconds,
  buildLessonSyncMap,
  mapCharIndexToSync,
  mapTimeToSync,
  resolvePositionFromTime,
  resolvePositionFromProgress,
  resolvePositionFromCharIndex,
  resolvePositionFromSentence,
  resolvePositionFromGlobalWord,
  ListeningSyncController,
  HighlightState,
  PlaybackPosition,
  SeekState,
  LogicalSeekRequest,
} from '../listeningSyncService';
import { LISTENING_LESSONS } from '../../data/fourSkills/listening';
import { ListeningLesson } from '../../data/fourSkills/types';

describe('Listening Synchronization & Tokenization Engine (Phase 1)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  // =========================================================================
  // 1. TOKENIZATION ENGINE: PRESERVATION & LEXICAL IDENTITY
  // =========================================================================
  describe('1. Tokenization Engine', () => {
    it('bảo toàn 100% text, whitespace, dấu câu và trật tự ký tự', () => {
      const sentence = 'Hello, world! Welcome to the 24-hour clinic; is it open?';
      const tokens = tokenizeSentence(sentence);

      // Ghép lại phải đúng 100% nguyên bản
      const reconstructed = tokens.map((t) => t.text).join('');
      expect(reconstructed).toBe(sentence);
    });

    it('bảo toàn contractions với dấu nháy (apostrophe): don\'t, I\'d, we\'re, it\'s', () => {
      const text = "Don't worry, we're ready and I'd love to say it's working!";
      const tokens = tokenizeSentence(text);
      const words = tokens.filter((t) => t.isWord);

      expect(words.map((w) => w.text)).toEqual([
        "Don't",
        'worry',
        "we're",
        'ready',
        'and',
        "I'd",
        'love',
        'to',
        'say',
        "it's",
        'working',
      ]);

      // Lexical identity cleanWord
      const dontToken = words.find((w) => w.text === "Don't");
      expect(dontToken?.cleanWord).toBe("don't");

      const wereToken = words.find((w) => w.text === "we're");
      expect(wereToken?.cleanWord).toBe("we're");

      const idToken = words.find((w) => w.text === "I'd");
      expect(idToken?.cleanWord).toBe("i'd");
    });

    it('bảo toàn hyphenated words và số (numbers): 24-hour, state-of-the-art, $50, 100%', () => {
      const text = 'A 24-hour state-of-the-art system costs $50 or 100% satisfaction.';
      const tokens = tokenizeSentence(text);
      const words = tokens.filter((t) => t.isWord);

      expect(words.map((w) => w.text)).toContain('24-hour');
      expect(words.map((w) => w.text)).toContain('state-of-the-art');
      expect(words.map((w) => w.text)).toContain('50');
      expect(words.map((w) => w.text)).toContain('100');

      // Punctuation preserved
      const puncts = tokens.filter((t) => !t.isWord && t.text.trim().length > 0);
      expect(puncts.map((p) => p.text)).toContain('$');
      expect(puncts.map((p) => p.text)).toContain('%');
      expect(puncts.map((p) => p.text)).toContain('.');
    });

    it('đánh số wordIndex chính xác và startChar / endChar khớp tuyệt đối với substring', () => {
      const text = 'Fast micro-services scale easily.';
      const tokens = tokenizeSentence(text);

      tokens.forEach((t) => {
        expect(text.substring(t.startChar, t.endChar)).toBe(t.text);
      });

      const words = tokens.filter((t) => t.isWord);
      expect(words.map((w) => w.wordIndex)).toEqual([0, 1, 2, 3]);
    });
  });

  // =========================================================================
  // 2. DURATION PARSER & LESSON SYNC MAP
  // =========================================================================
  describe('2. Lesson Sync Map & Duration Parsing', () => {
    it('parseDurationToSeconds xử lý chuẩn các định dạng thời lượng', () => {
      expect(parseDurationToSeconds('1:50')).toBe(110);
      expect(parseDurationToSeconds('2:30')).toBe(150);
      expect(parseDurationToSeconds('0:45')).toBe(45);
      expect(parseDurationToSeconds('1:02:15')).toBe(3735);
      expect(parseDurationToSeconds('90s')).toBe(90);
      expect(parseDurationToSeconds('')).toBe(0);
    });

    it('buildLessonSyncMap xây dựng map thành công cho toàn bộ 24 bài trong LISTENING_LESSONS', () => {
      expect(LISTENING_LESSONS.length).toBeGreaterThanOrEqual(24);

      for (const lesson of LISTENING_LESSONS) {
        const syncMap = buildLessonSyncMap(lesson, 1.0);
        expect(syncMap.lessonId).toBe(lesson.id);
        expect(syncMap.sentences.length).toBe(lesson.sentences.length);
        expect(syncMap.totalEstimatedMs).toBeGreaterThan(0);

        // Kiểm tra tính liên tục của audioStartChar và audioEndChar
        for (let i = 0; i < syncMap.sentences.length; i++) {
          const sent = syncMap.sentences[i];
          expect(sent.sentenceIndex).toBe(i);
          expect(sent.tokens.length).toBeGreaterThan(0);
          expect(sent.estimatedDurationMs).toBeGreaterThan(0);

          if (i === 0) {
            expect(sent.audioStartChar).toBe(0);
          } else {
            expect(sent.audioStartChar).toBe(syncMap.sentences[i - 1].audioEndChar);
          }
        }
      }
    });

    it('xử lý an toàn khi transcript rỗng hoặc chỉ có 1 câu', () => {
      const emptyLesson: ListeningLesson = {
        id: 'empty_test',
        title: 'Empty',
        category: 'Tech',
        level: 'A1',
        duration: '1:00',
        description: '',
        audioText: '',
        sentences: [],
        questions: [],
      };
      const emptyMap = buildLessonSyncMap(emptyLesson);
      expect(emptyMap.sentences).toEqual([]);
      expect(emptyMap.totalEstimatedMs).toBe(0);

      const oneSentLesson: ListeningLesson = {
        id: 'one_sent',
        title: 'One',
        category: 'Tech',
        level: 'A1',
        duration: '0:30',
        description: '',
        audioText: 'Only one sentence exists.',
        sentences: [{ en: 'Only one sentence exists.', vi: 'Chỉ có 1 câu duy nhất.' }],
        questions: [],
      };
      const oneMap = buildLessonSyncMap(oneSentLesson);
      expect(oneMap.sentences.length).toBe(1);
      expect(oneMap.sentences[0].audioStartChar).toBe(0);
      expect(oneMap.sentences[0].audioEndChar).toBe(oneSentLesson.audioText.length);
    });
  });

  // =========================================================================
  // 3. CHARINDEX & TIME MAPPING
  // =========================================================================
  describe('3. Character & Time Sync Mapping', () => {
    const mockLesson: ListeningLesson = {
      id: 'mock_lesson',
      title: 'Mock Lesson',
      category: 'Tech',
      level: 'B1',
      duration: '0:20',
      description: 'Mock',
      audioText: 'Sentence zero is here. Sentence one follows immediately. Sentence two concludes.',
      sentences: [
        { en: 'Sentence zero is here.', vi: 'Câu số không ở đây.' },
        { en: 'Sentence one follows immediately.', vi: 'Câu số một tiếp theo ngay sau.' },
        { en: 'Sentence two concludes.', vi: 'Câu số hai kết luận.' },
      ],
      questions: [],
    };

    it('mapCharIndexToSync map đúng sentence và word theo charIndex', () => {
      const syncMap = buildLessonSyncMap(mockLesson, 1.0);

      // Char 0: Sentence 0, Word 0 ("Sentence")
      const r0 = mapCharIndexToSync(syncMap, 0);
      expect(r0.sentenceIndex).toBe(0);
      expect(r0.wordIndex).toBe(0);

      // Char 9: Sentence 0, Word 1 ("zero")
      const r1 = mapCharIndexToSync(syncMap, 9);
      expect(r1.sentenceIndex).toBe(0);
      expect(r1.wordIndex).toBe(1);

      // Vị trí bắt đầu sentence 1
      const sent1Start = syncMap.sentences[1].coreTextStartChar;
      const rSent1 = mapCharIndexToSync(syncMap, sent1Start);
      expect(rSent1.sentenceIndex).toBe(1);
      expect(rSent1.wordIndex).toBe(0);

      // Vị trí bắt đầu sentence 2
      const sent2Start = syncMap.sentences[2].coreTextStartChar;
      const rSent2 = mapCharIndexToSync(syncMap, sent2Start);
      expect(rSent2.sentenceIndex).toBe(2);
      expect(rSent2.wordIndex).toBe(0);
    });

    it('mapTimeToSync map mượt mà theo thời gian ước tính (deterministic fallback)', () => {
      const syncMap = buildLessonSyncMap(mockLesson, 1.0);

      // Thời điểm ban đầu (t = 0)
      const t0 = mapTimeToSync(syncMap, 0);
      expect(t0.sentenceIndex).toBe(0);

      // Thời điểm giữa sentence 1
      const s1Mid = (syncMap.sentences[1].estimatedStartMs + syncMap.sentences[1].estimatedEndMs) / 2;
      const t1 = mapTimeToSync(syncMap, s1Mid);
      expect(t1.sentenceIndex).toBe(1);

      // Thời điểm sentence 2
      const s2Mid = (syncMap.sentences[2].estimatedStartMs + syncMap.sentences[2].estimatedEndMs) / 2;
      const t2 = mapTimeToSync(syncMap, s2Mid);
      expect(t2.sentenceIndex).toBe(2);
    });
  });

  // =========================================================================
  // 4. LISTENING SYNC CONTROLLER LIFECYCLE
  // =========================================================================
  describe('4. ListeningSyncController Lifecycle & Synchronization Invariants', () => {
    const mockLesson: ListeningLesson = {
      id: 'mock_controller_lesson',
      title: 'Controller Lesson',
      category: 'Tech',
      level: 'B1',
      duration: '0:15',
      description: 'Controller test',
      audioText: 'Alpha sentence starts. Beta sentence moves forward. Gamma sentence wraps up.',
      sentences: [
        { en: 'Alpha sentence starts.', vi: 'Câu Alpha bắt đầu.' },
        { en: 'Beta sentence moves forward.', vi: 'Câu Beta tiến bước.' },
        { en: 'Gamma sentence wraps up.', vi: 'Câu Gamma khép lại.' },
      ],
      questions: [],
    };

    it('start → sentence 0 được highlight lập tức', () => {
      const states: HighlightState[] = [];
      const controller = new ListeningSyncController({
        onHighlightChange: (s) => states.push({ ...s }),
      });

      controller.start(mockLesson, 1.0);

      expect(states.length).toBe(1);
      expect(states[0].activeSentenceIndex).toBe(0);
      expect(states[0].highlightMode).toBe('sentence');
      controller.stop();
    });

    it('native onBoundary: chuyển sentence 0 → 1 → 2 chuẩn xác và chỉ notify khi index thay đổi', () => {
      const states: HighlightState[] = [];
      const controller = new ListeningSyncController({
        onHighlightChange: (s) => states.push({ ...s }),
      });

      const session = controller.start(mockLesson, 1.0);
      expect(states.length).toBe(1);
      expect(states[0].activeSentenceIndex).toBe(0);

      // Event boundary trong sentence 0 (ví dụ word 1 tại char 6)
      controller.onBoundary(6, 'word', session);
      // Do highlightMode là 'sentence', activeSentenceIndex vẫn là 0 -> KHÔNG trigger redundant state
      expect(states.length).toBe(1);

      // Event boundary bước sang sentence 1
      const syncMap = buildLessonSyncMap(mockLesson, 1.0);
      const sent1Start = syncMap.sentences[1].coreTextStartChar;
      controller.onBoundary(sent1Start, 'word', session);

      expect(states.length).toBe(2);
      expect(states[1].activeSentenceIndex).toBe(1);

      // Event boundary bước sang sentence 2
      const sent2Start = syncMap.sentences[2].coreTextStartChar;
      controller.onBoundary(sent2Start, 'word', session);

      expect(states.length).toBe(3);
      expect(states[2].activeSentenceIndex).toBe(2);

      controller.stop();
    });

    it('deterministic fallback: tự động tiến từ sentence 0 → 1 → 2 khi không có native boundary', () => {
      const states: HighlightState[] = [];
      const controller = new ListeningSyncController({
        onHighlightChange: (s) => states.push({ ...s }),
      });

      controller.start(mockLesson, 1.0);
      expect(states[states.length - 1].activeSentenceIndex).toBe(0);

      const syncMap = buildLessonSyncMap(mockLesson, 1.0);
      const sent0Duration = syncMap.sentences[0].estimatedDurationMs;

      // Giả lập thời gian trôi qua hết câu 0
      vi.advanceTimersByTime(sent0Duration + 100);

      // Fallback timer kích hoạt -> chuyển sang câu 1
      expect(states[states.length - 1].activeSentenceIndex).toBe(1);

      // Giả lập thời gian trôi qua hết câu 1
      const sent1Duration = syncMap.sentences[1].estimatedDurationMs;
      vi.advanceTimersByTime(sent1Duration + 100);

      // Chuyển sang câu 2
      expect(states[states.length - 1].activeSentenceIndex).toBe(2);

      controller.stop();
    });

    it('pause → giữ đúng highlight; resume → tiếp tục đúng vị trí', () => {
      const states: HighlightState[] = [];
      const controller = new ListeningSyncController({
        onHighlightChange: (s) => states.push({ ...s }),
      });

      controller.start(mockLesson, 1.0);
      const syncMap = buildLessonSyncMap(mockLesson, 1.0);
      const sent0Duration = syncMap.sentences[0].estimatedDurationMs;

      // Tiến tới câu 1
      vi.advanceTimersByTime(sent0Duration + 100);
      expect(controller.getState().activeSentenceIndex).toBe(1);

      // Pause
      controller.pause();
      const stateCountBeforePause = states.length;

      // Trôi thêm 5 giây trong lúc pause -> highlight không được trôi
      vi.advanceTimersByTime(5000);
      expect(controller.getState().activeSentenceIndex).toBe(1);
      expect(states.length).toBe(stateCountBeforePause);

      // Resume
      controller.resume();
      expect(controller.getState().activeSentenceIndex).toBe(1);

      // Sau khi resume và trôi tiếp thời lượng câu 1 -> chuyển câu 2
      const sent1Duration = syncMap.sentences[1].estimatedDurationMs;
      vi.advanceTimersByTime(sent1Duration + 100);
      expect(controller.getState().activeSentenceIndex).toBe(2);

      controller.stop();
    });

    it('restart / replay: tính lại và bắt đầu lại từ sentence 0', () => {
      const states: HighlightState[] = [];
      const controller = new ListeningSyncController({
        onHighlightChange: (s) => states.push({ ...s }),
      });

      controller.start(mockLesson, 1.0);
      const syncMap = buildLessonSyncMap(mockLesson, 1.0);
      const sent0Duration = syncMap.sentences[0].estimatedDurationMs;
      vi.advanceTimersByTime(sent0Duration + 100);
      expect(controller.getState().activeSentenceIndex).toBe(1);

      // Replay / Start lại
      controller.start(mockLesson, 1.0);
      expect(controller.getState().activeSentenceIndex).toBe(0);

      controller.stop();
    });

    it('switch lesson: dập tắt playback cũ, clear state cũ và không bị stale callback từ bài cũ', () => {
      const states: HighlightState[] = [];
      const controller = new ListeningSyncController({
        onHighlightChange: (s) => states.push({ ...s }),
      });

      const oldSession = controller.start(mockLesson, 1.0);
      expect(controller.getState().activeSentenceIndex).toBe(0);

      // Đổi sang bài khác
      const lesson2: ListeningLesson = {
        ...mockLesson,
        id: 'lesson_2',
        title: 'Lesson 2',
        audioText: 'New lesson text starts here. Second part.',
        sentences: [
          { en: 'New lesson text starts here.', vi: 'Bài mới bắt đầu.' },
          { en: 'Second part.', vi: 'Phần hai.' },
        ],
      };

      controller.setLesson(lesson2);
      // Khi set lesson mới, highlight state phải được clear về null
      expect(controller.getState().activeSentenceIndex).toBeNull();

      // Giả lập callback từ session cũ bài cũ trả về muộn
      controller.onBoundary(20, 'word', oldSession);
      // Callback cũ bị chặn triệt để (session check), không được revive highlight
      expect(controller.getState().activeSentenceIndex).toBeNull();

      controller.destroy();
    });

    it('playback end & unmount: clear highlight về null và hủy toàn bộ timer/reference', () => {
      let playbackEnded = false;
      const controller = new ListeningSyncController({
        onHighlightChange: vi.fn(),
        onPlaybackEnd: () => {
          playbackEnded = true;
        },
      });

      controller.start(mockLesson, 1.0);
      expect(controller.getState().activeSentenceIndex).toBe(0);

      controller.handleEnd();
      expect(controller.getState().activeSentenceIndex).toBeNull();
      expect(playbackEnded).toBe(true);

      // Unmount / destroy
      controller.destroy();
      expect(controller.getState().activeSentenceIndex).toBeNull();
    });

    it('seekToSentence: cập nhật câu active ngay lập tức', () => {
      const controller = new ListeningSyncController({
        onHighlightChange: vi.fn(),
      });

      controller.start(mockLesson, 1.0);
      expect(controller.getState().activeSentenceIndex).toBe(0);

      controller.seekToSentence(2);
      expect(controller.getState().activeSentenceIndex).toBe(2);

      controller.seekToSentence(0);
      expect(controller.getState().activeSentenceIndex).toBe(0);

      controller.stop();
    });
  });

  // =========================================================================
  // 5. PHASE 2: WORD-LEVEL SYNCHRONIZATION, FALLBACKS & RUNTIME SWITCHING
  // =========================================================================
  describe('5. Word-Level Synchronization, Fallbacks & Runtime Switching (Phase 2)', () => {
    const wordTestLesson: ListeningLesson = {
      id: 'test_word_sync',
      title: 'Word Sync & Edge Cases',
      description: 'Test lesson description for word sync',
      level: 'B1',
      category: 'Daily Life',
      duration: '0:30',
      audioText:
        "Welcome to the cafe. It is what it is, isn't it? 24-hour service costs $50.",
      sentences: [
        { en: 'Welcome to the cafe.', vi: 'Chào mừng bạn đến quán cà phê.' },
        { en: "It is what it is, isn't it?", vi: 'Chuyện gì đến sẽ đến, đúng không?' },
        { en: '24-hour service costs $50.', vi: 'Dịch vụ 24 giờ có giá 50 đô.' },
      ],
      questions: [],
    };

    it('Native boundary progression: word 0 → word 1 → word N trong word mode', () => {
      const controller = new ListeningSyncController({
        onHighlightChange: vi.fn(),
      });

      controller.setHighlightMode('word');
      const session = controller.start(wordTestLesson, 1.0);

      // Start: sentence 0, word 0
      expect(controller.getState()).toMatchObject({
        highlightMode: 'word',
        activeSentenceIndex: 0,
        activeWordIndex: 0,
      });

      // "Welcome to the cafe."
      // Sentence 0 start = 0
      // "Welcome" -> 0, "to" -> 8, "the" -> 11, "cafe" -> 15
      controller.onBoundary(8, 'word', session); // "to"
      expect(controller.getState().activeWordIndex).toBe(1);

      controller.onBoundary(11, 'word', session); // "the"
      expect(controller.getState().activeWordIndex).toBe(2);

      controller.onBoundary(15, 'word', session); // "cafe"
      expect(controller.getState().activeWordIndex).toBe(3);

      controller.stop();
    });

    it('Runtime switching: sentence ↔ word không reset audio session, map vị trí hiện tại', () => {
      let state = {} as HighlightState;
      const controller = new ListeningSyncController({
        onHighlightChange: (s) => {
          state = { ...s };
        },
      });

      // Bắt đầu ở sentence mode
      const session1 = controller.start(wordTestLesson, 1.0);
      expect(controller.getState().highlightMode).toBe('sentence');
      expect(controller.getState().activeSentenceIndex).toBe(0);

      // Nhận boundary từ "cafe" (charIndex 15) trong sentence mode
      controller.onBoundary(15, 'word', session1);
      // Trong sentence mode, activeWordIndex trong state được notify là null
      expect(state.highlightMode).toBe('sentence');
      expect(state.activeSentenceIndex).toBe(0);
      expect(state.activeWordIndex).toBeNull();

      // Đổi sang word mode trong khi đang phát
      controller.setHighlightMode('word');
      // Session ID không được thay đổi (audio không restart)
      expect(controller.getState().highlightMode).toBe('word');
      expect(controller.getState().activeSentenceIndex).toBe(0);
      expect(controller.getState().activeWordIndex).toBe(3); // "cafe" mapped ngay lập tức

      // Đổi ngược lại về sentence mode
      controller.setHighlightMode('sentence');
      expect(controller.getState().highlightMode).toBe('sentence');
      expect(controller.getState().activeSentenceIndex).toBe(0);
      expect(controller.getState().activeWordIndex).toBeNull();

      controller.stop();
    });

    it('Edge cases: duplicate words trong cùng 1 câu (It is what it is)', () => {
      const syncMap = buildLessonSyncMap(wordTestLesson, 1.0);
      const sent1 = syncMap.sentences[1]; // "It is what it is, isn't it?"

      expect(sent1.words.length).toBe(7);
      expect(sent1.words.map((w) => w.text)).toEqual(['It', 'is', 'what', 'it', 'is', "isn't", 'it']);

      // Kiểm tra mapCharIndexToSync phân biệt đúng 2 từ 'it' và 2 từ 'is'
      const sent1Start = sent1.audioStartChar; // start offset of sentence 1

      // Instance 1: "It" (char 0 of sentence)
      const mapWord0 = mapCharIndexToSync(syncMap, sent1.coreTextStartChar);
      expect(mapWord0.sentenceIndex).toBe(1);
      expect(mapWord0.wordIndex).toBe(0);

      // Instance 1: "is" (char 3 of sentence)
      const mapWord1 = mapCharIndexToSync(syncMap, sent1.coreTextStartChar + 3);
      expect(mapWord1.wordIndex).toBe(1);

      // Instance 2: "it" (char 11 of sentence)
      const mapWord3 = mapCharIndexToSync(syncMap, sent1.coreTextStartChar + 11);
      expect(mapWord3.wordIndex).toBe(3);

      // Instance 2: "is" (char 14 of sentence)
      const mapWord4 = mapCharIndexToSync(syncMap, sent1.coreTextStartChar + 14);
      expect(mapWord4.wordIndex).toBe(4);
    });

    it('Edge cases: missing/NaN charIndex, unsupported boundary, name !== word', () => {
      const controller = new ListeningSyncController({
        onHighlightChange: vi.fn(),
      });
      controller.setHighlightMode('word');
      const session = controller.start(wordTestLesson, 1.0);

      // charIndex is undefined or NaN -> không crash, giữ highlight hiện tại
      controller.onBoundary(undefined as any, 'word', session);
      expect(controller.getState().activeSentenceIndex).toBe(0);
      expect(controller.getState().activeWordIndex).toBe(0);

      controller.onBoundary(NaN as any, 'word', session);
      expect(controller.getState().activeSentenceIndex).toBe(0);
      expect(controller.getState().activeWordIndex).toBe(0);

      controller.onBoundary(-5, 'word', session);
      expect(controller.getState().activeSentenceIndex).toBe(0);
      expect(controller.getState().activeWordIndex).toBe(0);

      // Browser phát boundary name = 'sentence' tại charIndex thuộc câu 1
      const sent1Start = wordTestLesson.sentences[0].en.length + 1;
      controller.onBoundary(sent1Start, 'sentence', session);
      expect(controller.getState().activeSentenceIndex).toBe(1);
      expect(controller.getState().activeWordIndex).toBe(0);

      controller.stop();
    });

    it('Fallback path: ticker tự động tiến word by word khi không có native boundary', () => {
      const controller = new ListeningSyncController({
        onHighlightChange: vi.fn(),
      });
      controller.setHighlightMode('word');
      controller.start(wordTestLesson, 1.0);

      expect(controller.getState().activeWordIndex).toBe(0);

      // Tính chính xác thời lượng của từ thứ nhất để advance timers vượt qua từ 0
      const syncMap = buildLessonSyncMap(wordTestLesson, 1.0);
      const word0Duration = syncMap.sentences[0].words[0].estimatedDurationMs;

      vi.advanceTimersByTime(word0Duration + 150);
      expect(controller.getState().activeSentenceIndex).toBe(0);
      expect(controller.getState().activeWordIndex).toBeGreaterThan(0);

      controller.stop();
    });

    it('Edge cases: transcript rỗng hoặc single-word transcript', () => {
      const emptyLesson: ListeningLesson = {
        id: 'empty_lesson',
        title: 'Empty',
        description: 'Empty test lesson',
        level: 'A1',
        category: 'Daily Life',
        duration: '0:10',
        audioText: '',
        sentences: [],
        questions: [],
      };

      const emptySync = buildLessonSyncMap(emptyLesson, 1.0);
      expect(emptySync.sentences.length).toBe(0);

      const singleWordLesson: ListeningLesson = {
        id: 'single_word_lesson',
        title: 'Single Word',
        description: 'Single word test lesson',
        level: 'A1',
        category: 'Daily Life',
        duration: '0:05',
        audioText: 'Hello.',
        sentences: [{ en: 'Hello.', vi: 'Xin chào.' }],
        questions: [],
      };

      const singleSync = buildLessonSyncMap(singleWordLesson, 1.0);
      expect(singleSync.sentences.length).toBe(1);
      expect(singleSync.sentences[0].words.length).toBe(1);
      expect(singleSync.sentences[0].words[0].cleanWord).toBe('hello');

      const mapped = mapCharIndexToSync(singleSync, 0);
      expect(mapped.sentenceIndex).toBe(0);
      expect(mapped.wordIndex).toBe(0);
    });

    it('Xác thực toàn diện 24 bài nghe A1–C2: Tokenization & SyncMap fidelity 100%', () => {
      expect(LISTENING_LESSONS.length).toBeGreaterThanOrEqual(24);

      for (const lesson of LISTENING_LESSONS) {
        const syncMap = buildLessonSyncMap(lesson, 1.0);
        expect(syncMap.sentences.length).toBe(lesson.sentences.length);
        expect(syncMap.totalEstimatedMs).toBeGreaterThan(0);

        for (let sIdx = 0; sIdx < lesson.sentences.length; sIdx++) {
          const sent = lesson.sentences[sIdx];
          const span = syncMap.sentences[sIdx];

          // 1. Tái tạo 100% nguyên vẹn text từ tokens
          const reconstructed = span.tokens.map((t) => t.text).join('');
          expect(reconstructed).toBe(sent.en);

          // 2. Kiểm tra tính hợp lệ của word spans
          for (let wIdx = 0; wIdx < span.words.length; wIdx++) {
            const word = span.words[wIdx];
            expect(word.isWord).toBe(true);
            expect(word.cleanWord).toBeTruthy();
            expect(word.wordStartMs).toBeLessThanOrEqual(word.wordEndMs);
            expect(word.audioStartChar).toBeLessThan(word.audioEndChar);
          }

          // 3. Timing boundaries của câu
          expect(span.estimatedStartMs).toBeLessThan(span.estimatedEndMs);
        }

        // 4. mapTimeToSync từ 0 đến totalEstimatedMs không bao giờ crash hoặc trả về NaN
        const testTimes = [0, syncMap.totalEstimatedMs / 2, syncMap.totalEstimatedMs - 10];
        for (const t of testTimes) {
          const res = mapTimeToSync(syncMap, t);
          expect(res.sentenceIndex).toBeGreaterThanOrEqual(0);
          expect(res.sentenceIndex).toBeLessThan(lesson.sentences.length);
        }
      }
    });
  });

  // =========================================================================
  // 6. WORD HIGHLIGHT JITTER & MONOTONIC PROTECTION (PHASE 1 FIX)
  // =========================================================================
  describe('6. Word Highlight Jitter & Monotonic Protection (Phase 1 Fix)', () => {
    const jitterLesson: ListeningLesson = {
      id: 'jitter_test_lesson',
      title: 'Jitter Test',
      category: 'Tech',
      level: 'B1',
      duration: '0:30',
      description: 'Jitter prevention test',
      audioText:
        'First sentence starts here. Second sentence follows immediately. Third sentence concludes.',
      sentences: [
        { en: 'First sentence starts here.', vi: 'Câu đầu bắt đầu tại đây.' },
        { en: 'Second sentence follows immediately.', vi: 'Câu hai tiếp nối ngay.' },
        { en: 'Third sentence concludes.', vi: 'Câu ba kết thúc.' },
      ],
      questions: [],
    };

    it('Jitter regression: monotonic forward-only protection blocks backward word jumping in normal playback', () => {
      const controller = new ListeningSyncController({
        onHighlightChange: vi.fn(),
      });
      controller.setHighlightMode('word');
      const session = controller.start(jitterLesson, 1.0);

      // Start: sentence 0, word 0 ("First")
      expect(controller.getState().activeWordIndex).toBe(0);

      // Word 1: "sentence" (char 6)
      controller.onBoundary(6, 'word', session);
      expect(controller.getState().activeWordIndex).toBe(1);

      // Word 2: "starts" (char 15)
      controller.onBoundary(15, 'word', session);
      expect(controller.getState().activeWordIndex).toBe(2);

      // Word 3: "here" (char 22)
      controller.onBoundary(22, 'word', session);
      expect(controller.getState().activeWordIndex).toBe(3);

      // STALE / OUT-OF-ORDER EVENT: char 6 (word 1) arrives late
      controller.onBoundary(6, 'word', session);
      // Monotonic guard blocks backward regression: activeWordIndex STAYS at 3!
      expect(controller.getState().activeWordIndex).toBe(3);

      // STALE EVENT: char 15 (word 2) arrives late
      controller.onBoundary(15, 'word', session);
      expect(controller.getState().activeWordIndex).toBe(3);

      // Advance to Sentence 1, Word 0 ("Second", char 28)
      controller.onBoundary(28, 'word', session);
      expect(controller.getState().activeSentenceIndex).toBe(1);
      expect(controller.getState().activeWordIndex).toBe(0);

      // STALE EVENT: char 22 from Sentence 0 arrives late
      controller.onBoundary(22, 'word', session);
      // Monotonic guard blocks sentence regression: activeSentenceIndex STAYS at 1!
      expect(controller.getState().activeSentenceIndex).toBe(1);
      expect(controller.getState().activeWordIndex).toBe(0);

      controller.stop();
    });

    it('Single authoritative tracking source: fallback estimator cannot overwrite native boundary', () => {
      const states: HighlightState[] = [];
      const controller = new ListeningSyncController({
        onHighlightChange: (s) => states.push({ ...s }),
      });
      controller.setHighlightMode('word');

      const session = controller.start(jitterLesson, 1.0);
      expect(controller.getTrackingSource()).toBe('fallback');

      // Native boundary arrives: tracking source transitions to 'native-boundary'
      controller.onBoundary(22, 'word', session); // Sentence 0, word 3 ("here")
      expect(controller.getTrackingSource()).toBe('native-boundary');
      expect(controller.getState().activeWordIndex).toBe(3);

      // Advance fake timers by 1500ms (fallback ticker would have ticked 25 times)
      vi.advanceTimersByTime(1500);

      // Fallback ticker is strictly muted: does NOT overwrite native boundary state
      expect(controller.getTrackingSource()).toBe('native-boundary');
      expect(controller.getState().activeSentenceIndex).toBe(0);
      expect(controller.getState().activeWordIndex).toBe(3);

      controller.stop();
    });

    it('Stale session invalidation: callbacks from previous sessions are strictly rejected', () => {
      const controller = new ListeningSyncController({
        onHighlightChange: vi.fn(),
      });
      controller.setHighlightMode('word');

      // Session 1 starts
      const session1 = controller.start(jitterLesson, 1.0);
      controller.onBoundary(6, 'word', session1);
      expect(controller.getState().activeWordIndex).toBe(1);

      // User restarts audio -> Session 2 starts
      const session2 = controller.start(jitterLesson, 1.0);
      expect(controller.getState().activeWordIndex).toBe(0);

      // Stale callback from session 1 arrives with char 28 (Sentence 1)
      controller.onBoundary(28, 'word', session1);
      // Must be completely ignored: state stays at session 2 start
      expect(controller.getState().activeSentenceIndex).toBe(0);
      expect(controller.getState().activeWordIndex).toBe(0);

      // Legitimate callback from session 2 is accepted
      controller.onBoundary(15, 'word', session2);
      expect(controller.getState().activeWordIndex).toBe(2);

      controller.stop();
    });

    it('Legitimate backward movement: seekToSentence, seek, and restart work cleanly without monotonic blockage', () => {
      const controller = new ListeningSyncController({
        onHighlightChange: vi.fn(),
      });
      controller.setHighlightMode('word');
      const session = controller.start(jitterLesson, 1.0);

      // Advance to Sentence 2, Word 1
      const syncMap = buildLessonSyncMap(jitterLesson, 1.0);
      const sent2Start = syncMap.sentences[2].audioStartChar;
      controller.onBoundary(sent2Start + 6, 'word', session);
      expect(controller.getState().activeSentenceIndex).toBe(2);

      // Seek backward to Sentence 0: allowBackwardMovement must permit this
      controller.seekToSentence(0);
      expect(controller.getState().activeSentenceIndex).toBe(0);
      expect(controller.getState().activeWordIndex).toBe(0);

      // Seek forward to Sentence 1, Word 2
      controller.seek(1, 2);
      expect(controller.getState().activeSentenceIndex).toBe(1);
      expect(controller.getState().activeWordIndex).toBe(2);

      // Seek backward to Sentence 1, Word 0
      controller.seek(1, 0);
      expect(controller.getState().activeSentenceIndex).toBe(1);
      expect(controller.getState().activeWordIndex).toBe(0);

      // Restart via start(): cleanly resets to Sentence 0, Word 0
      controller.start(jitterLesson, 1.0);
      expect(controller.getState().activeSentenceIndex).toBe(0);
      expect(controller.getState().activeWordIndex).toBe(0);

      controller.stop();
    });

    it('TrackingSource state lifecycle: starts as fallback, transitions to native-boundary, resets on stop', () => {
      const controller = new ListeningSyncController({
        onHighlightChange: vi.fn(),
      });

      expect(controller.getTrackingSource()).toBe('fallback');

      const session = controller.start(jitterLesson, 1.0);
      expect(controller.getTrackingSource()).toBe('fallback');
      expect(controller.getState().trackingSource).toBe('fallback');

      controller.onBoundary(0, 'word', session);
      expect(controller.getTrackingSource()).toBe('native-boundary');
      expect(controller.getState().trackingSource).toBe('native-boundary');

      controller.stop();
      expect(controller.getTrackingSource()).toBe('fallback');
      expect(controller.getState().trackingSource).toBe('fallback');
    });
  });

  // =========================================================================
  // 7. UNIFIED PLAYBACK POSITION & LOGICAL SEEK ENGINE (PHASE 2)
  // =========================================================================
  describe('7. Unified Playback Position & Logical Seek Engine (Phase 2)', () => {
    const seekLesson: ListeningLesson = {
      id: 'seek_test_lesson',
      title: 'Unified Seek Test',
      category: 'Tech',
      level: 'B2',
      duration: '0:30',
      description: 'Comprehensive test for unified position model & seek engine',
      audioText:
        'Zero starts the engine. One continues the operation. Two processes the remaining data.',
      sentences: [
        { en: 'Zero starts the engine.', vi: 'Số không khởi động động cơ.' },
        { en: 'One continues the operation.', vi: 'Số một tiếp tục thao tác.' },
        { en: 'Two processes the remaining data.', vi: 'Số hai xử lý dữ liệu còn lại.' },
      ],
      questions: [],
    };

    it('1. Unified position model: resolves accurately between time, progress, charIndex, and sentence/word', () => {
      const syncMap = buildLessonSyncMap(seekLesson, 1.0);
      expect(syncMap.totalWords).toBeGreaterThan(0);

      // 0% progress -> Sentence 0, Word 0, Char 0, globalWordIndex 0
      const pos0 = resolvePositionFromProgress(syncMap, 0);
      expect(pos0.sentenceIndex).toBe(0);
      expect(pos0.wordIndex).toBe(0);
      expect(pos0.charIndex).toBe(0);
      expect(pos0.globalWordIndex).toBe(0);
      expect(pos0.progress).toBe(0);

      // Sentence 1, Word 1
      const posSent1Word1 = resolvePositionFromSentence(syncMap, 1, 1);
      expect(posSent1Word1.sentenceIndex).toBe(1);
      expect(posSent1Word1.wordIndex).toBe(1);
      expect(posSent1Word1.currentTimeMs).toBeGreaterThan(0);
      expect(posSent1Word1.progress).toBeGreaterThan(0);

      // Global word index resolution
      const targetGIdx = 5;
      const posGWord = resolvePositionFromGlobalWord(syncMap, targetGIdx);
      expect(posGWord.globalWordIndex).toBe(targetGIdx);

      // CharIndex resolution
      const posChar = resolvePositionFromCharIndex(syncMap, syncMap.sentences[2].audioStartChar);
      expect(posChar.sentenceIndex).toBe(2);
    });

    it('2. Seek forward: 20% -> seek -> 80% updates active position immediately and ignores stale earlier callbacks', () => {
      const controller = new ListeningSyncController({
        onHighlightChange: vi.fn(),
      });
      controller.setHighlightMode('word');
      const session1 = controller.start(seekLesson, 1.0);

      // Initial: sentence 0, word 0
      expect(controller.getState().activeSentenceIndex).toBe(0);

      // Seek forward to 80% (Sentence 2)
      const seekRequest = controller.seekToProgress(0.8);
      expect(seekRequest).not.toBeNull();
      expect(seekRequest?.shouldPlay).toBe(true);
      expect(seekRequest?.position.sentenceIndex).toBe(2);

      // Session ID was incremented on seek
      expect(seekRequest?.sessionId).toBeGreaterThan(session1);
      const session2 = seekRequest!.sessionId;

      // Active state is now at sentence 2
      expect(controller.getState().activeSentenceIndex).toBe(2);

      // STALE EVENT: An earlier callback from session 1 arrives for word 1 (char 6)
      controller.onBoundary(6, 'word', session1);
      // Stale callback MUST be ignored, active stays at sentence 2!
      expect(controller.getState().activeSentenceIndex).toBe(2);

      // Legitimate callback for session 2 arrives
      controller.onBoundary(0, 'word', session2);
      expect(controller.getState().activeSentenceIndex).toBe(2);

      controller.stop();
    });

    it('3. Seek backward: 80% -> seek -> 20% allows backward highlight without monotonic blockage', () => {
      const controller = new ListeningSyncController({
        onHighlightChange: vi.fn(),
      });
      controller.setHighlightMode('word');
      controller.start(seekLesson, 1.0);

      // Seek forward to sentence 2
      controller.seekToSentence(2, 2);
      expect(controller.getState().activeSentenceIndex).toBe(2);
      expect(controller.getState().activeWordIndex).toBe(2);

      // Seek backward to sentence 0, word 1
      const backRequest = controller.seekToSentence(0, 1);
      expect(backRequest).not.toBeNull();
      // Monotonic guard must NOT block intentional backward seek!
      expect(controller.getState().activeSentenceIndex).toBe(0);
      expect(controller.getState().activeWordIndex).toBe(1);

      controller.stop();
    });

    it('4. Pause + seek: maintains paused state, updates highlight, and sets shouldPlay = false', () => {
      const controller = new ListeningSyncController({
        onHighlightChange: vi.fn(),
      });
      controller.setHighlightMode('word');
      controller.start(seekLesson, 1.0);

      // Pause playback
      controller.pause();
      expect(controller.getSeekState().wasPlayingBeforeSeek).toBe(false);

      // Seek while paused
      const req = controller.seekToSentence(1, 2);
      expect(req).not.toBeNull();
      expect(req?.shouldPlay).toBe(false);

      // Controller must REMAIN paused
      expect(controller.getState().activeSentenceIndex).toBe(1);
      expect(controller.getState().activeWordIndex).toBe(2);

      // Advance timers by 2 seconds: fallback ticker must NOT tick because it is paused
      vi.advanceTimersByTime(2000);
      expect(controller.getState().activeSentenceIndex).toBe(1);
      expect(controller.getState().activeWordIndex).toBe(2);

      controller.stop();
    });

    it('5. Playing + seek: maintains playing state, starts new session ticker, and sets shouldPlay = true', () => {
      const controller = new ListeningSyncController({
        onHighlightChange: vi.fn(),
      });
      controller.setHighlightMode('word');
      controller.start(seekLesson, 1.0);

      // Seek while playing
      const req = controller.seekToSentence(1, 0);
      expect(req).not.toBeNull();
      expect(req?.shouldPlay).toBe(true);

      // Controller continues playing at seek target
      expect(controller.getState().activeSentenceIndex).toBe(1);
      expect(controller.getState().activeWordIndex).toBe(0);

      controller.stop();
    });

    it('6. Global offset handling: local charIndex 0 from new utterance slice maps to target global word', () => {
      const controller = new ListeningSyncController({
        onHighlightChange: vi.fn(),
      });
      controller.setHighlightMode('word');
      controller.start(seekLesson, 1.0);

      const syncMap = buildLessonSyncMap(seekLesson, 1.0);
      const sent1StartChar = syncMap.sentences[1].audioStartChar;

      // Seek to sentence 1
      const seekReq = controller.seekToSentence(1, 0);
      expect(seekReq).not.toBeNull();
      expect(seekReq?.playbackStartCharOffset).toBe(sent1StartChar);

      // In Web Speech API, new utterance speaks text slice starting at sent1StartChar.
      // Therefore, the browser fires onboundary with local charIndex = 0.
      controller.onBoundary(0, 'word', seekReq!.sessionId);

      // Controller adds playbackStartCharOffset internally -> globalChar is sent1StartChar
      // Mapped position is global sentence 1, word 0 ("One"), NOT sentence 0!
      expect(controller.getState().activeSentenceIndex).toBe(1);
      expect(controller.getState().activeWordIndex).toBe(0);

      controller.stop();
    });

    it('7. Native HTMLAudioElement integration: seek updates audio.currentTime directly', () => {
      const controller = new ListeningSyncController({
        onHighlightChange: vi.fn(),
      });
      const mockAudio = {
        currentTime: 0,
      } as HTMLAudioElement;

      controller.setAudioElement(mockAudio);
      expect(controller.getAudioElement()).toBe(mockAudio);

      controller.start(seekLesson, 1.0);

      // Seek to 5000ms
      controller.seekToTimeMs(5000);
      // mockAudio.currentTime must be 5.0 seconds
      expect(mockAudio.currentTime).toBe(5);

      controller.stop();
    });

    it('8. Mode switching after seek: preserves playback position and resolves corresponding highlight without restart', () => {
      const controller = new ListeningSyncController({
        onHighlightChange: vi.fn(),
      });
      controller.setHighlightMode('word');
      controller.start(seekLesson, 1.0);

      // Seek to Sentence 1, Word 2
      controller.seekToSentence(1, 2);
      expect(controller.getState().activeSentenceIndex).toBe(1);
      expect(controller.getState().activeWordIndex).toBe(2);

      // Switch to Sentence mode: sentence 1 is highlighted, word is null
      controller.setHighlightMode('sentence');
      expect(controller.getState().highlightMode).toBe('sentence');
      expect(controller.getState().activeSentenceIndex).toBe(1);
      expect(controller.getState().activeWordIndex).toBeNull();

      // Switch back to Word mode: word 2 is highlighted without audio reset
      controller.setHighlightMode('word');
      expect(controller.getState().highlightMode).toBe('word');
      expect(controller.getState().activeSentenceIndex).toBe(1);
      expect(controller.getState().activeWordIndex).toBe(2);

      controller.stop();
    });

    it('9. Edge cases: 0%, 100%, empty transcript, rapid repeated seeks, seek after end', () => {
      const controller = new ListeningSyncController({
        onHighlightChange: vi.fn(),
      });
      controller.setHighlightMode('word');

      // Empty lesson test
      const emptyLesson: ListeningLesson = {
        ...seekLesson,
        id: 'empty_seek',
        audioText: '',
        sentences: [],
      };
      controller.setLesson(emptyLesson);
      expect(controller.seekToProgress(0.5)).toBeNull();
      expect(controller.getCurrentPosition().sentenceIndex).toBe(-1);

      // Re-set valid lesson
      controller.setLesson(seekLesson);
      controller.start();

      // Seek 0%
      const req0 = controller.seekToProgress(0);
      expect(req0?.position.sentenceIndex).toBe(0);
      expect(req0?.position.wordIndex).toBe(0);
      expect(req0?.position.progress).toBe(0);

      // Seek 100%
      const req100 = controller.seekToProgress(1.0);
      expect(req100?.position.sentenceIndex).toBe(2);
      expect(req100?.position.progress).toBe(1);

      // Rapid repeated seeks
      const r1 = controller.seekToProgress(0.2);
      const r2 = controller.seekToProgress(0.4);
      const r3 = controller.seekToProgress(0.6);
      expect(r3?.sessionId).toBeGreaterThan(r2!.sessionId);
      expect(r2?.sessionId).toBeGreaterThan(r1!.sessionId);
      expect(controller.getState().activeSentenceIndex).toBe(r3?.position.sentenceIndex);

      // Playback ends naturally
      controller.handleEnd();
      expect(controller.getState().activeSentenceIndex).toBeNull();

      // Seek after playback has ended
      const reqAfterEnd = controller.seekToProgress(0.5);
      expect(reqAfterEnd).not.toBeNull();
      expect(reqAfterEnd?.shouldPlay).toBe(false);
      expect(controller.getState().activeSentenceIndex).toBe(reqAfterEnd?.position.sentenceIndex);

      controller.stop();
    });
  });
});
