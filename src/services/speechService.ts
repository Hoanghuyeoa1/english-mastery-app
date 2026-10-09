// src/services/speechService.ts
import { alignSpokenWords } from './textAlignmentService';
import type { ShadowingFeedback } from '../types';

// Global Set để giữ tham chiếu tới SpeechSynthesisUtterance, ngăn chặn lỗi Garbage Collection trên Chrome / Safari
const activeUtterances = new Set<SpeechSynthesisUtterance>();

/**
 * Hủy toàn bộ phát âm đang chạy bằng SpeechSynthesis API
 */
export function cancelSpeech(): void {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    return;
  }
  try {
    window.speechSynthesis.cancel();
  } catch {
    // ignore
  }
}

/**
 * Phát âm từ vựng / câu tiếng Anh bằng SpeechSynthesis API
 */
export function speakWord(text: string, voiceType: 'en-US' | 'en-GB' = 'en-US', speed = 0.85): void {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    console.warn('SpeechSynthesis is not supported in this browser environment.');
    return;
  }

  cancelSpeech(); // Ngắt câu trước nếu đang nói

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = voiceType;
  utterance.rate = speed;
  utterance.pitch = 1.0;

  // Lấy voice tiếng Anh phù hợp nếu có
  try {
    const voices = window.speechSynthesis.getVoices();
    if (voices && voices.length > 0) {
      const selectedVoice = voices.find(v => v.lang.includes(voiceType.replace('-', '_')) || v.lang.includes(voiceType));
      if (selectedVoice) {
        utterance.voice = selectedVoice;
      }
    }
  } catch {
    // ignore
  }

  window.speechSynthesis.speak(utterance);
}

export const speakText = speakWord;

export interface PlayShadowingPromptOptions {
  text: string;
  accent?: 'en-US' | 'en-GB';
  speed?: number; // 0.75 | 1.0
  volume?: number; // 0.0 - 1.0 (ví dụ: 0.3 cho simultaneous mode, 1.0 cho echo mode)
  onStart?: () => void;
  onEnd?: () => void;
  onError?: (error: any) => void;
}

/**
 * Phát âm câu mẫu luyện Shadowing bằng SpeechSynthesis API
 * Xử lý callback onEnd chuẩn xác và ngăn chặn lỗi GC ngắt TTS giữa chừng trên Chrome/Safari
 */
export function playShadowingPrompt(options: PlayShadowingPromptOptions): { stop: () => void } {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    options.onEnd?.();
    return { stop: () => {} };
  }

  try {
    window.speechSynthesis.cancel();
  } catch {
    // ignore
  }

  let utterance: SpeechSynthesisUtterance;
  try {
    utterance = typeof SpeechSynthesisUtterance !== 'undefined'
      ? new SpeechSynthesisUtterance(options.text)
      : ({} as any);
  } catch {
    options.onEnd?.();
    return { stop: () => {} };
  }

  utterance.lang = options.accent || 'en-US';
  utterance.rate = options.speed ?? 1.0;
  utterance.volume = options.volume ?? 1.0;
  utterance.pitch = 1.0;

  try {
    const voices = window.speechSynthesis.getVoices();
    if (voices && voices.length > 0) {
      const targetLang = options.accent || 'en-US';
      const selectedVoice = voices.find(
        v => v.lang.includes(targetLang.replace('-', '_')) || v.lang.includes(targetLang)
      );
      if (selectedVoice) {
        utterance.voice = selectedVoice;
      }
    }
  } catch {
    // ignore
  }

  // Lưu vào Set để GC không giải phóng nhầm khi âm thanh đang chạy
  activeUtterances.add(utterance);

  let hasEnded = false;
  const cleanup = () => {
    if (!hasEnded) {
      hasEnded = true;
      activeUtterances.delete(utterance);
    }
  };

  utterance.onstart = () => {
    options.onStart?.();
  };

  utterance.onend = () => {
    cleanup();
    options.onEnd?.();
  };

  utterance.onerror = (event: any) => {
    cleanup();
    options.onError?.(event);
    options.onEnd?.();
  };

  try {
    window.speechSynthesis.speak(utterance);
  } catch (err) {
    cleanup();
    options.onError?.(err);
    options.onEnd?.();
  }

  return {
    stop: () => {
      cleanup();
      try {
        window.speechSynthesis.cancel();
      } catch {
        // ignore
      }
    },
  };
}

// Type definitions cho Web Speech API
export type SpeechErrorCode = 
  | 'not-supported'
  | 'permission-denied'
  | 'no-speech'
  | 'audio-capture'
  | 'network'
  | 'unknown';

export interface SpeechRecognizerError {
  code: SpeechErrorCode;
  message: string;
  guide?: string;
}

export interface BrowserSpeechSupportInfo {
  isSupported: boolean;
  browserName: string;
  isFirefox: boolean;
  isSafari: boolean;
  isIOS: boolean;
  recommendation: string;
}

/**
 * Kiểm tra an toàn sự tồn tại của SpeechRecognition (chống lỗi SSR / thiếu API)
 */
export function isSpeechRecognitionSupported(): boolean {
  if (typeof window === 'undefined') return false;
  const win = window as unknown as {
    SpeechRecognition?: unknown;
    webkitSpeechRecognition?: unknown;
  };
  return Boolean(win.SpeechRecognition || win.webkitSpeechRecognition);
}

/**
 * Phân tích UserAgent cơ bản nhằm nhận diện trình duyệt và đưa ra khuyến nghị chính xác
 */
export function getSpeechBrowserSupport(): BrowserSpeechSupportInfo {
  const isSupported = isSpeechRecognitionSupported();
  if (typeof window === 'undefined') {
    return {
      isSupported: false,
      browserName: 'Unknown',
      isFirefox: false,
      isSafari: false,
      isIOS: false,
      recommendation: 'Trình duyệt hiện tại chưa hỗ trợ nhận diện giọng nói. Để luyện nói và chấm điểm phát âm chính xác, vui lòng mở ứng dụng trên Google Chrome hoặc Microsoft Edge.',
    };
  }

  const ua = window.navigator.userAgent.toLowerCase();
  const isFirefox = ua.includes('firefox');
  const isIOS = /iphone|ipad|ipod/.test(ua);
  const isSafari = ua.includes('safari') && !ua.includes('chrome') && !ua.includes('chromium') && !ua.includes('android');

  let browserName = 'Browser';
  let recommendation = 'Trình duyệt hiện tại chưa hỗ trợ nhận diện giọng nói. Để luyện nói và chấm điểm phát âm chính xác, vui lòng mở ứng dụng trên Google Chrome hoặc Microsoft Edge.';

  if (isFirefox) {
    browserName = 'Mozilla Firefox';
    recommendation = 'Mozilla Firefox chưa kích hoạt sẵn SpeechRecognition API. Vui lòng chuyển sang Google Chrome hoặc Microsoft Edge để luyện phát âm.';
  } else if (isSafari) {
    browserName = isIOS ? 'Safari on iOS' : 'Apple Safari';
    recommendation = 'Safari có thể gặp hạn chế khi nhận diện giọng nói tiếng Anh. Khuyến nghị mở ứng dụng trên Google Chrome hoặc Microsoft Edge trên máy tính/Android.';
  }

  return {
    isSupported,
    browserName,
    isFirefox,
    isSafari,
    isIOS,
    recommendation,
  };
}

/**
 * Nhận diện giọng nói để luyện phát âm
 */
export interface SpeechRecognizerHandle {
  recognition: any;
  stop: () => void;
}

export interface SpeechRecognitionOptions {
  continuous?: boolean;
  interimResults?: boolean;
  lang?: string;
  maxAlternatives?: number;
  onResult?: (transcript: string, isFinal: boolean) => void;
  onError?: (errorMessage: string, errorDetail?: SpeechRecognizerError) => void;
  onEnd?: () => void;
  onStart?: () => void;
}

/**
 * Khởi tạo SpeechRecognition hỗ trợ cả Single-shot và Streaming Continuous
 */
export function startSpeechRecognition(
  options: SpeechRecognitionOptions
): SpeechRecognizerHandle | null {
  if (typeof window === 'undefined') {
    const errorDetail: SpeechRecognizerError = {
      code: 'not-supported',
      message: 'Môi trường không có cửa sổ trình duyệt (window is undefined).',
    };
    options.onError?.(errorDetail.message, errorDetail);
    return null;
  }

  const win = window as any;
  const SpeechRecognitionClass = win.SpeechRecognition || win.webkitSpeechRecognition;

  if (!SpeechRecognitionClass) {
    const errorDetail: SpeechRecognizerError = {
      code: 'not-supported',
      message: 'Trình duyệt hiện tại chưa hỗ trợ nhận diện giọng nói.',
      guide: 'Để luyện nói và chấm điểm phát âm chính xác, vui lòng mở ứng dụng trên Google Chrome hoặc Microsoft Edge.',
    };
    options.onError?.(`${errorDetail.message} ${errorDetail.guide}`, errorDetail);
    return null;
  }

  try {
    const recognition = new SpeechRecognitionClass();
    recognition.continuous = options.continuous ?? false;
    recognition.interimResults = options.interimResults ?? true;
    recognition.lang = options.lang || 'en-US';
    recognition.maxAlternatives = options.maxAlternatives ?? 1;

    recognition.onresult = (event: any) => {
      let interimTranscript = '';
      let isFinal = false;

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        const transcriptSegment = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          isFinal = true;
          interimTranscript = transcriptSegment;
        } else {
          interimTranscript += transcriptSegment;
        }
      }

      options.onResult?.(interimTranscript.trim().toLowerCase(), isFinal);
    };

    recognition.onerror = (event: any) => {
      let code: SpeechErrorCode = 'unknown';
      let message = `Lỗi nhận diện âm thanh: ${event.error || 'không xác định'}`;
      let guide: string | undefined = undefined;

      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        code = 'permission-denied';
        message = 'Quyền truy cập Microphone bị từ chối.';
        guide = 'Vui lòng bấm vào biểu tượng ổ khóa / quyền trang web trên thanh URL của trình duyệt để gạt bật lại Micro.';
      } else if (event.error === 'no-speech') {
        code = 'no-speech';
        message = 'Không nghe thấy giọng nói. Bạn hãy thử lại gần mic hơn nhé.';
      } else if (event.error === 'audio-capture') {
        code = 'audio-capture';
        message = 'Không tìm thấy thiết bị thu âm (Microphone). Hãy kiểm tra lại kết nối micro của bạn.';
      } else if (event.error === 'network') {
        code = 'network';
        message = 'Lỗi kết nối mạng đến dịch vụ nhận diện giọng nói.';
      }

      options.onError?.(guide ? `${message} ${guide}` : message, { code, message, guide });
    };

    if (options.onStart) {
      recognition.onstart = options.onStart;
    }
    if (options.onEnd) {
      recognition.onend = options.onEnd;
    }

    recognition.start();

    return {
      recognition,
      stop: () => {
        try {
          recognition.onresult = null;
          recognition.onerror = null;
          recognition.onend = null;
          recognition.onstart = null;
          if (typeof recognition.abort === 'function') {
            recognition.abort();
          } else if (typeof recognition.stop === 'function') {
            recognition.stop();
          }
        } catch {
          // ignore
        }
      },
    };
  } catch (err: any) {
    const isPermission = 
      err?.name === 'NotAllowedError' || 
      err?.name === 'PermissionDeniedError' ||
      err?.message?.toLowerCase().includes('permission') ||
      err?.message?.toLowerCase().includes('not allowed');

    const code: SpeechErrorCode = isPermission ? 'permission-denied' : 'unknown';
    const message = isPermission
      ? 'Quyền truy cập Microphone bị từ chối.'
      : `Không thể khởi động microphone: ${err?.message || 'Lỗi không xác định'}`;
    const guide = isPermission
      ? 'Vui lòng bấm vào biểu tượng ổ khóa / quyền trang web trên thanh URL của trình duyệt để gạt bật lại Micro.'
      : undefined;

    options.onError?.(guide ? `${message} ${guide}` : message, { code, message, guide });
    return null;
  }
}

/**
 * Nhận diện giọng nói để luyện phát âm (Tương thích ngược)
 */
export function createSpeechRecognizer(
  onResult: (transcript: string, isFinal: boolean) => void,
  onError: (errorMessage: string, errorDetail?: SpeechRecognizerError) => void,
  onEnd?: () => void
): SpeechRecognizerHandle | null {
  return startSpeechRecognition({
    continuous: false,
    interimResults: true,
    lang: 'en-US',
    onResult,
    onError,
    onEnd,
  });
}

export type ShadowingMode = 'echo' | 'simultaneous';

export interface ShadowingSessionOptions {
  targetSentence: string;
  mode?: ShadowingMode; // 'echo' (default) | 'simultaneous'
  accent?: 'en-US' | 'en-GB';
  speed?: number; // 0.75 | 1.0, default: 1.0
  onTTSStart?: () => void;
  onTTSEnd?: () => void;
  onSTTStart?: () => void;
  onInterimFeedback?: (feedback: ShadowingFeedback) => void;
  onFinalFeedback?: (feedback: ShadowingFeedback) => void;
  onError?: (errorMessage: string, errorDetail?: SpeechRecognizerError) => void;
  onSessionEnd?: () => void;
}

export interface ShadowingSessionHandle {
  stop: () => void;
  getMode: () => ShadowingMode;
  isActive: () => boolean;
}

// Global active session tracker to ensure clean single-session lifecycle & prevent memory leak
let activeShadowingSession: ShadowingSessionHandle | null = null;

/**
 * Hủy triệt để phiên luyện nói Shadowing hiện tại, dừng cả TTS và giải phóng Micro
 */
export function stopShadowingSession(): void {
  if (activeShadowingSession) {
    const session = activeShadowingSession;
    activeShadowingSession = null;
    session.stop();
  } else {
    activeUtterances.clear();
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.cancel();
      } catch {
        // ignore
      }
    }
  }
}

/**
 * Điều phối luồng phát âm (TTS) và nhận diện giọng nói (STT) cho Smart Shadowing
 * Hỗ trợ 2 chế độ:
 * 1. Echo Mode: Phát xong TTS -> trễ 500ms -> tự động kích hoạt STT để người học nhắc lại.
 * 2. Simultaneous Mode: Giảm âm lượng TTS xuống 30% -> kích hoạt STT ngay khi TTS bắt đầu phát để nói song song.
 */
export function startShadowingSession(options: ShadowingSessionOptions): ShadowingSessionHandle {
  // Dọn dẹp phiên trước nếu đang chạy
  stopShadowingSession();

  const mode: ShadowingMode = options.mode || 'echo';
  let isRunning = true;
  let echoTimer: ReturnType<typeof setTimeout> | null = null;
  let ttsHandle: { stop: () => void } | null = null;
  let recognitionInstance: any = null;

  const sessionHandle: ShadowingSessionHandle = {
    stop: () => {
      if (!isRunning) return;
      isRunning = false;

      if (echoTimer) {
        clearTimeout(echoTimer);
        echoTimer = null;
      }

      if (ttsHandle) {
        ttsHandle.stop();
        ttsHandle = null;
      }

      if (recognitionInstance) {
        try {
          recognitionInstance.onresult = null;
          recognitionInstance.onerror = null;
          recognitionInstance.onend = null;
          recognitionInstance.onstart = null;
          if (typeof recognitionInstance.abort === 'function') {
            recognitionInstance.abort();
          } else if (typeof recognitionInstance.stop === 'function') {
            recognitionInstance.stop();
          }
        } catch {
          // ignore
        }
        recognitionInstance = null;
      }

      if (activeShadowingSession === sessionHandle) {
        activeShadowingSession = null;
      }

      options.onSessionEnd?.();
    },
    getMode: () => mode,
    isActive: () => isRunning,
  };

  activeShadowingSession = sessionHandle;

  // Kiểm tra hỗ trợ nhận diện giọng nói
  if (!isSpeechRecognitionSupported()) {
    const errorDetail: SpeechRecognizerError = {
      code: 'not-supported',
      message: 'Trình duyệt hiện tại chưa hỗ trợ nhận diện giọng nói.',
      guide: 'Để luyện nói và chấm điểm phát âm chính xác, vui lòng mở ứng dụng trên Google Chrome hoặc Microsoft Edge.',
    };
    options.onError?.(`${errorDetail.message} ${errorDetail.guide}`, errorDetail);
    sessionHandle.stop();
    return sessionHandle;
  }

  const startSTT = () => {
    if (!isRunning) return;

    const win = window as any;
    const SpeechRecognitionClass = win.SpeechRecognition || win.webkitSpeechRecognition;
    if (!SpeechRecognitionClass) return;

    try {
      const recognition = new SpeechRecognitionClass();
      recognitionInstance = recognition;
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = options.accent || 'en-US';
      recognition.maxAlternatives = 1;

      recognition.onstart = () => {
        if (isRunning) {
          options.onSTTStart?.();
        }
      };

      recognition.onresult = (event: any) => {
        if (!isRunning) return;

        let accumulatedTranscript = '';
        let isFinal = false;

        for (let i = 0; i < event.results.length; ++i) {
          const res = event.results[i];
          if (res && res[0]) {
            const transcript = res[0].transcript || '';
            accumulatedTranscript += (accumulatedTranscript ? ' ' : '') + transcript;
            if (res.isFinal) {
              isFinal = true;
            }
          }
        }

        const spoken = accumulatedTranscript.trim();
        if (spoken) {
          const feedback = alignSpokenWords(options.targetSentence, spoken);
          options.onInterimFeedback?.(feedback);
          if (isFinal) {
            options.onFinalFeedback?.(feedback);
          }
        }
      };

      recognition.onerror = (event: any) => {
        if (!isRunning) return;

        let code: SpeechErrorCode = 'unknown';
        let message = `Lỗi nhận diện âm thanh: ${event.error || 'không xác định'}`;
        let guide: string | undefined = undefined;

        if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
          code = 'permission-denied';
          message = 'Quyền truy cập Microphone bị từ chối.';
          guide = 'Vui lòng bấm vào biểu tượng ổ khóa / quyền trang web trên thanh URL của trình duyệt để gạt bật lại Micro.';
        } else if (event.error === 'no-speech') {
          code = 'no-speech';
          message = 'Không nghe thấy giọng nói. Bạn hãy thử lại gần mic hơn nhé.';
        } else if (event.error === 'audio-capture') {
          code = 'audio-capture';
          message = 'Không tìm thấy thiết bị thu âm (Microphone). Hãy kiểm tra lại kết nối micro của bạn.';
        } else if (event.error === 'network') {
          code = 'network';
          message = 'Lỗi kết nối mạng đến dịch vụ nhận diện giọng nói.';
        }

        options.onError?.(guide ? `${message} ${guide}` : message, { code, message, guide });
      };

      recognition.onend = () => {
        if (!isRunning) return;
      };

      recognition.start();
    } catch (err: any) {
      const isPermission = 
        err?.name === 'NotAllowedError' || 
        err?.name === 'PermissionDeniedError' ||
        err?.message?.toLowerCase().includes('permission') ||
        err?.message?.toLowerCase().includes('not allowed');

      const code: SpeechErrorCode = isPermission ? 'permission-denied' : 'unknown';
      const message = isPermission
        ? 'Quyền truy cập Microphone bị từ chối.'
        : `Không thể khởi động microphone: ${err?.message || 'Lỗi không xác định'}`;
      const guide = isPermission
        ? 'Vui lòng bấm vào biểu tượng ổ khóa / quyền trang web trên thanh URL của trình duyệt để gạt bật lại Micro.'
        : undefined;

      options.onError?.(guide ? `${message} ${guide}` : message, { code, message, guide });
    }
  };

  if (mode === 'echo') {
    // Echo Mode: Phát xong TTS -> đếm ngược trễ 500ms -> tự động kích hoạt STT
    ttsHandle = playShadowingPrompt({
      text: options.targetSentence,
      accent: options.accent,
      speed: options.speed ?? 1.0,
      volume: 1.0,
      onStart: () => {
        if (isRunning) options.onTTSStart?.();
      },
      onEnd: () => {
        if (!isRunning) return;
        options.onTTSEnd?.();
        echoTimer = setTimeout(() => {
          if (isRunning) {
            startSTT();
          }
        }, 500);
      },
      onError: (err) => {
        if (!isRunning) return;
        options.onError?.(`Lỗi phát âm mẫu: ${err?.message || 'Lỗi TTS'}`, {
          code: 'unknown',
          message: 'Lỗi phát âm mẫu',
        });
        echoTimer = setTimeout(() => {
          if (isRunning) {
            startSTT();
          }
        }, 500);
      },
    });
  } else {
    // Simultaneous Mode: Giảm âm lượng TTS xuống 30% -> kích hoạt STT ngay khi TTS bắt đầu phát
    ttsHandle = playShadowingPrompt({
      text: options.targetSentence,
      accent: options.accent,
      speed: options.speed ?? 1.0,
      volume: 0.3, // 30% âm lượng
      onStart: () => {
        if (isRunning) {
          options.onTTSStart?.();
          startSTT(); // Kích hoạt STT ngay khi bắt đầu phát mẫu
        }
      },
      onEnd: () => {
        if (isRunning) {
          options.onTTSEnd?.();
        }
      },
      onError: (err) => {
        if (isRunning) {
          options.onError?.(`Lỗi phát âm mẫu: ${err?.message || 'Lỗi TTS'}`, {
            code: 'unknown',
            message: 'Lỗi phát âm mẫu',
          });
          startSTT();
        }
      },
    });
  }

  return sessionHandle;
}

/**
 * Chuẩn hóa chuỗi văn bản để so khớp phát âm
 */
export function normalizePronunciationText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[.,/#!$%^&*;:{}=\-_`~()?"'’]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Tính điểm độ tương đồng Levenshtein Distance giữa từ dự kiến và giọng đọc thực tế
 */
export function calculateAccuracy(expected: string, actual: string): number {
  const cleanExp = normalizePronunciationText(expected);
  const cleanAct = normalizePronunciationText(actual);

  if (!cleanExp || !cleanAct) return 0;
  if (cleanExp === cleanAct) return 100;

  const m = cleanExp.length;
  const n = cleanAct.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (cleanExp[i - 1] === cleanAct[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
      }
    }
  }

  const distance = dp[m][n];
  const maxLen = Math.max(m, n);
  const similarity = Math.max(0, (1 - distance / maxLen) * 100);
  return Math.round(similarity);
}

export interface WordMatchDetail {
  word: string;
  status: 'perfect' | 'near' | 'missed';
  score: number;
}

export interface PronunciationAssessmentResult {
  score: number;
  tier: 'excellent' | 'good' | 'try_again';
  title: string;
  feedback: string;
  targetText: string;
  spokenText: string;
  words: WordMatchDetail[];
  xpEarned: number;
}

/**
 * Phân tích và chấm điểm chi tiết phát âm theo từng từ và toàn bộ câu
 */
export function assessPronunciation(targetText: string, spokenText: string): PronunciationAssessmentResult {
  const normTarget = normalizePronunciationText(targetText);
  const normSpoken = normalizePronunciationText(spokenText);

  if (!normSpoken) {
    return {
      score: 0,
      tier: 'try_again',
      title: 'Hãy thử lại / Try Again',
      feedback: 'Chưa nhận diện được giọng nói rõ ràng. Hãy lại gần micro và phát âm lại nhé.',
      targetText,
      spokenText: '',
      words: normTarget.split(' ').map((w) => ({ word: w, status: 'missed', score: 0 })),
      xpEarned: 0,
    };
  }

  const overallAccuracy = calculateAccuracy(normTarget, normSpoken);

  // Phân tích theo từng từ
  const targetWords = normTarget.split(' ').filter(Boolean);
  const spokenWords = normSpoken.split(' ').filter(Boolean);

  const wordDetails: WordMatchDetail[] = targetWords.map((tWord) => {
    // Tìm từ được nói có độ tương đồng cao nhất
    let bestWordScore = 0;
    for (const sWord of spokenWords) {
      const sim = calculateAccuracy(tWord, sWord);
      if (sim > bestWordScore) {
        bestWordScore = sim;
      }
    }

    let status: 'perfect' | 'near' | 'missed' = 'missed';
    if (bestWordScore >= 85) {
      status = 'perfect';
    } else if (bestWordScore >= 55) {
      status = 'near';
    }

    return {
      word: tWord,
      status,
      score: bestWordScore,
    };
  });

  // Đánh giá tổng hợp điểm và tier
  let finalScore = overallAccuracy;
  // Nếu là câu nhiều từ, tính kết hợp giữa word average và overall Levenshtein
  if (targetWords.length > 1) {
    const avgWordScore = wordDetails.reduce((acc, curr) => acc + curr.score, 0) / targetWords.length;
    finalScore = Math.round(overallAccuracy * 0.4 + avgWordScore * 0.6);
  }

  let tier: 'excellent' | 'good' | 'try_again' = 'try_again';
  let title = 'Hãy thử lại / Try Again';
  let feedback = 'Phát âm chưa chuẩn xác. Hãy bấm nút loa để nghe lại mẫu bản xứ và thử lại nhé.';
  let xpEarned = 0;

  if (finalScore >= 85) {
    tier = 'excellent';
    title = 'Tuyệt vời! / Excellent 🎉';
    feedback = 'Phát âm cực kỳ chuẩn xác và rõ ràng. Tiếp tục phát huy nhé!';
    xpEarned = 25;
  } else if (finalScore >= 60) {
    tier = 'good';
    title = 'Tạm được / Good Try 👍';
    const missedWords = wordDetails.filter((w) => w.status !== 'perfect').map((w) => w.word);
    feedback = missedWords.length > 0 
      ? `Đọc khá tốt! Hãy chú ý phát âm rõ hơn các từ: "${missedWords.join(', ')}".`
      : 'Đọc khá ổn, cố gắng phát âm tròn vành rõ chữ hơn để đạt điểm tuyệt đối!';
    xpEarned = 15;
  }

  return {
    score: finalScore,
    tier,
    title,
    feedback,
    targetText,
    spokenText,
    words: wordDetails,
    xpEarned,
  };
}
