import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  isSpeechRecognitionSupported,
  getSpeechBrowserSupport,
  createSpeechRecognizer,
  startSpeechRecognition,
  playShadowingPrompt,
  startShadowingSession,
  stopShadowingSession,
  normalizePronunciationText,
  calculateAccuracy,
  assessPronunciation,
} from '../speechService';

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
  constructor(text: string) {
    this.text = text;
  }
}

class MockSpeechRecognition {
  continuous = false;
  interimResults = false;
  lang = 'en-US';
  maxAlternatives = 1;
  onresult: ((e: any) => void) | null = null;
  onerror: ((e: any) => void) | null = null;
  onend: (() => void) | null = null;
  onstart: (() => void) | null = null;
  start = vi.fn(function (this: MockSpeechRecognition) {
    this.onstart?.();
  });
  stop = vi.fn();
  abort = vi.fn();
}

describe('speechService (Web Speech API resilience, TTS & Shadowing Orchestrator)', () => {
  beforeEach(() => {
    (globalThis as any).SpeechSynthesisUtterance = MockSpeechSynthesisUtterance;
    (globalThis as any).window = {
      navigator: { userAgent: '' },
      SpeechSynthesisUtterance: MockSpeechSynthesisUtterance,
      SpeechRecognition: MockSpeechRecognition,
      speechSynthesis: {
        cancel: vi.fn(),
        getVoices: () => [],
        speak: vi.fn((utterance: MockSpeechSynthesisUtterance) => {
          utterance.onstart?.();
        }),
      },
    };
  });

  afterEach(() => {
    stopShadowingSession();
    delete (globalThis as any).window;
    delete (globalThis as any).SpeechSynthesisUtterance;
    vi.restoreAllMocks();
  });

  describe('1. isSpeechRecognitionSupported', () => {
    it('trả về true khi window.SpeechRecognition tồn tại', () => {
      (window as any).SpeechRecognition = class {};
      (window as any).webkitSpeechRecognition = undefined;
      expect(isSpeechRecognitionSupported()).toBe(true);
    });

    it('trả về true khi window.webkitSpeechRecognition tồn tại', () => {
      (window as any).SpeechRecognition = undefined;
      (window as any).webkitSpeechRecognition = class {};
      expect(isSpeechRecognitionSupported()).toBe(true);
    });

    it('trả về false khi cả 2 API đều bị thiếu hoặc bị xóa (undefined)', () => {
      delete (window as any).SpeechRecognition;
      delete (window as any).webkitSpeechRecognition;
      expect(isSpeechRecognitionSupported()).toBe(false);
    });
  });

  describe('2. getSpeechBrowserSupport & Browser Detection', () => {
    it('nhận diện Mozilla Firefox và đưa ra khuyến nghị chuyển sang Chrome/Edge', () => {
      delete (window as any).SpeechRecognition;
      delete (window as any).webkitSpeechRecognition;

      vi.spyOn(window.navigator, 'userAgent', 'get').mockReturnValue(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/119.0'
      );

      const info = getSpeechBrowserSupport();
      expect(info.isSupported).toBe(false);
      expect(info.isFirefox).toBe(true);
      expect(info.browserName).toBe('Mozilla Firefox');
      expect(info.recommendation).toContain('Firefox');
    });

    it('nhận diện Apple Safari trên iOS', () => {
      vi.spyOn(window.navigator, 'userAgent', 'get').mockReturnValue(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Mobile/15E148 Safari/604.1'
      );

      const info = getSpeechBrowserSupport();
      expect(info.isSafari).toBe(true);
      expect(info.isIOS).toBe(true);
      expect(info.browserName).toBe('Safari on iOS');
    });
  });

  describe('3. createSpeechRecognizer - Error Handling & Graceful Degradation', () => {
    it('gọi onError với code not-supported khi SpeechRecognition không khả dụng', () => {
      delete (window as any).SpeechRecognition;
      delete (window as any).webkitSpeechRecognition;

      const onErrorMock = vi.fn();
      const onResultMock = vi.fn();

      const handle = createSpeechRecognizer(onResultMock, onErrorMock);

      expect(handle).toBeNull();
      expect(onErrorMock).toHaveBeenCalledTimes(1);
      expect(onErrorMock).toHaveBeenCalledWith(
        expect.stringContaining('Trình duyệt hiện tại chưa hỗ trợ nhận diện giọng nói'),
        expect.objectContaining({
          code: 'not-supported',
          guide: expect.stringContaining('Google Chrome'),
        })
      );
    });
  });

  describe('4. normalizePronunciationText & calculateAccuracy', () => {
    it('chuẩn hóa chuỗi, loại bỏ dấu câu và khoảng trắng dư thừa', () => {
      expect(normalizePronunciationText('  "Hello, World!?"  ')).toBe('hello world');
      expect(normalizePronunciationText('It’s a nice day.')).toBe('its a nice day');
    });

    it('tính độ tương đồng 100% khi 2 chuỗi trùng khớp', () => {
      expect(calculateAccuracy('computer', 'computer')).toBe(100);
      expect(calculateAccuracy('Hello, world!', 'hello world')).toBe(100);
    });

    it('tính độ tương đồng giảm dần theo Levenshtein Distance', () => {
      const score = calculateAccuracy('technology', 'technolagy');
      expect(score).toBeGreaterThanOrEqual(80);
      expect(score).toBeLessThan(100);

      expect(calculateAccuracy('apple', 'banana')).toBeLessThan(30);
    });
  });

  describe('5. assessPronunciation', () => {
    it('đánh giá chuẩn xác tier excellent khi phát âm chính xác (>= 85)', () => {
      const result = assessPronunciation('developer', 'developer');
      expect(result.score).toBe(100);
      expect(result.tier).toBe('excellent');
      expect(result.xpEarned).toBe(25);
    });

    it('đánh giá tier good khi sai sót nhẹ (>= 60 và < 85)', () => {
      const result = assessPronunciation('congratulations', 'congratulate');
      expect(result.tier).toBe('good');
      expect(result.xpEarned).toBe(15);
    });

    it('đánh giá tier try_again khi không có âm thanh hoặc sai hoàn toàn', () => {
      const result = assessPronunciation('artificial intelligence', '');
      expect(result.score).toBe(0);
      expect(result.tier).toBe('try_again');
      expect(result.xpEarned).toBe(0);
    });
  });

  describe('6. playShadowingPrompt (TTS with GC resilience)', () => {
    it('cấu hình đúng text, accent, speed và volume', () => {
      let capturedUtterance: MockSpeechSynthesisUtterance | null = null;
      (window as any).speechSynthesis.speak = vi.fn((utt) => {
        capturedUtterance = utt;
      });

      const onStart = vi.fn();
      const onEnd = vi.fn();

      const handle = playShadowingPrompt({
        text: 'The quick brown fox',
        accent: 'en-GB',
        speed: 0.75,
        volume: 0.3,
        onStart,
        onEnd,
      });

      expect(window.speechSynthesis.cancel).toHaveBeenCalled();
      expect(window.speechSynthesis.speak).toHaveBeenCalledTimes(1);
      expect(capturedUtterance).not.toBeNull();
      expect(capturedUtterance!.text).toBe('The quick brown fox');
      expect(capturedUtterance!.lang).toBe('en-GB');
      expect(capturedUtterance!.rate).toBe(0.75);
      expect(capturedUtterance!.volume).toBe(0.3);

      capturedUtterance!.onstart?.();
      expect(onStart).toHaveBeenCalledTimes(1);

      capturedUtterance!.onend?.();
      expect(onEnd).toHaveBeenCalledTimes(1);

      handle.stop();
      expect(window.speechSynthesis.cancel).toHaveBeenCalledTimes(2);
    });
  });

  describe('7. startShadowingSession - Echo Mode', () => {
    it('chạy luồng TTS -> đếm ngược 500ms -> tự động kích hoạt STT', () => {
      vi.useFakeTimers();

      let capturedUtterance: MockSpeechSynthesisUtterance | null = null;
      (window as any).speechSynthesis.speak = vi.fn((utt) => {
        capturedUtterance = utt;
      });

      const onTTSStart = vi.fn();
      const onTTSEnd = vi.fn();
      const onSTTStart = vi.fn();

      const session = startShadowingSession({
        targetSentence: 'Artificial intelligence is reshaping the future.',
        mode: 'echo',
        accent: 'en-US',
        speed: 1.0,
        onTTSStart,
        onTTSEnd,
        onSTTStart,
      });

      expect(session.getMode()).toBe('echo');
      expect(session.isActive()).toBe(true);
      expect(capturedUtterance).not.toBeNull();
      expect(capturedUtterance!.volume).toBe(1.0); // Full volume in Echo Mode

      // TTS bắt đầu
      capturedUtterance!.onstart?.();
      expect(onTTSStart).toHaveBeenCalledTimes(1);

      // TTS kết thúc
      capturedUtterance!.onend?.();
      expect(onTTSEnd).toHaveBeenCalledTimes(1);
      // STT chưa được kích hoạt ngay lập tức vì đang đếm ngược 500ms
      expect(onSTTStart).not.toHaveBeenCalled();

      // Tua nhanh 500ms
      vi.advanceTimersByTime(500);

      // STT đã được kích hoạt sau 500ms
      expect(onSTTStart).toHaveBeenCalledTimes(1);

      session.stop();
      expect(session.isActive()).toBe(false);

      vi.useRealTimers();
    });
  });

  describe('8. startShadowingSession - Simultaneous Mode', () => {
    it('giảm âm lượng TTS xuống 30% và kích hoạt STT ngay khi TTS bắt đầu', () => {
      let capturedUtterance: MockSpeechSynthesisUtterance | null = null;
      (window as any).speechSynthesis.speak = vi.fn((utt) => {
        capturedUtterance = utt;
        // Trong simultaneous mode, khi speak được gọi, onstart kích hoạt
        utt.onstart?.();
      });

      const onTTSStart = vi.fn();
      const onTTSEnd = vi.fn();
      const onSTTStart = vi.fn();

      const session = startShadowingSession({
        targetSentence: 'Practice makes perfect.',
        mode: 'simultaneous',
        accent: 'en-US',
        speed: 1.0,
        onTTSStart,
        onTTSEnd,
        onSTTStart,
      });

      expect(session.getMode()).toBe('simultaneous');
      expect(capturedUtterance).not.toBeNull();
      // Âm lượng giảm xuống 30% để người dùng vừa nghe vừa nói
      expect(capturedUtterance!.volume).toBe(0.3);

      expect(onTTSStart).toHaveBeenCalledTimes(1);
      expect(onSTTStart).toHaveBeenCalledTimes(1);

      capturedUtterance!.onend?.();
      expect(onTTSEnd).toHaveBeenCalledTimes(1);

      session.stop();
      expect(session.isActive()).toBe(false);
    });
  });

  describe('9. Streaming Interim Results & Real-time Alignment', () => {
    it('gọi onInterimFeedback với kết quả alignSpokenWords mỗi khi nhận transcript', () => {
      let capturedRecognition: MockSpeechRecognition | null = null;
      (window as any).SpeechRecognition = class extends MockSpeechRecognition {
        constructor() {
          super();
          capturedRecognition = this;
        }
      };

      const onInterimFeedback = vi.fn();
      const onFinalFeedback = vi.fn();

      const session = startShadowingSession({
        targetSentence: 'The quick brown fox jumps',
        mode: 'simultaneous',
        onInterimFeedback,
        onFinalFeedback,
      });

      expect(capturedRecognition).not.toBeNull();
      expect(capturedRecognition!.continuous).toBe(true);
      expect(capturedRecognition!.interimResults).toBe(true);

      // Mô phỏng sự kiện onresult streaming 1: "The quick"
      capturedRecognition!.onresult?.({
        resultIndex: 0,
        results: [
          [{ transcript: 'The quick' }],
        ],
      });

      expect(onInterimFeedback).toHaveBeenCalledTimes(1);
      const interimFeedback1 = onInterimFeedback.mock.calls[0][0];
      expect(interimFeedback1.totalWords).toBe(5);
      expect(interimFeedback1.completedWords).toBe(2); // 'the', 'quick'
      expect(interimFeedback1.accuracyScore).toBe(40); // 2 / 5 * 100

      // Mô phỏng sự kiện onresult streaming 2: "The quick brown fox jumps" (final)
      const finalResultItem: any = [{ transcript: 'The quick brown fox jumps' }];
      finalResultItem.isFinal = true;

      capturedRecognition!.onresult?.({
        resultIndex: 0,
        results: [finalResultItem],
      });

      expect(onInterimFeedback).toHaveBeenCalledTimes(2);
      expect(onFinalFeedback).toHaveBeenCalledTimes(1);
      const finalFeedback = onFinalFeedback.mock.calls[0][0];
      expect(finalFeedback.accuracyScore).toBe(100);
      expect(finalFeedback.completedWords).toBe(5);

      session.stop();
    });
  });

  describe('10. Memory Leak Prevention & Lifecycle Cleanup', () => {
    it('stopShadowingSession hủy triệt để cả TTS và STT, gỡ bỏ toàn bộ event listeners', () => {
      let capturedRecognition: MockSpeechRecognition | null = null;
      (window as any).SpeechRecognition = class extends MockSpeechRecognition {
        constructor() {
          super();
          capturedRecognition = this;
        }
      };

      const onSessionEnd = vi.fn();

      const session = startShadowingSession({
        targetSentence: 'Clean architecture and zero memory leak.',
        mode: 'simultaneous',
        onSessionEnd,
      });

      expect(session.isActive()).toBe(true);
      expect(capturedRecognition).not.toBeNull();

      // Gọi stopShadowingSession
      stopShadowingSession();

      expect(session.isActive()).toBe(false);
      expect(window.speechSynthesis.cancel).toHaveBeenCalled();
      expect(capturedRecognition!.abort).toHaveBeenCalled();

      // Kiểm tra toàn bộ handler đã được gỡ bỏ (tránh memory leak)
      expect(capturedRecognition!.onresult).toBeNull();
      expect(capturedRecognition!.onerror).toBeNull();
      expect(capturedRecognition!.onend).toBeNull();
      expect(capturedRecognition!.onstart).toBeNull();

      expect(onSessionEnd).toHaveBeenCalledTimes(1);
    });

    it('tự động dọn dẹp phiên cũ khi khởi động phiên Shadowing mới', () => {
      const onSessionEndOld = vi.fn();

      const session1 = startShadowingSession({
        targetSentence: 'Session 1 sentence',
        onSessionEnd: onSessionEndOld,
      });

      expect(session1.isActive()).toBe(true);

      // Khởi động phiên 2
      const session2 = startShadowingSession({
        targetSentence: 'Session 2 sentence',
      });

      // Phiên 1 phải tự động kết thúc
      expect(session1.isActive()).toBe(false);
      expect(onSessionEndOld).toHaveBeenCalledTimes(1);
      expect(session2.isActive()).toBe(true);

      session2.stop();
    });
  });
});
