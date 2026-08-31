// src/services/speechService.ts

/**
 * Phát âm từ vựng / câu tiếng Anh bằng SpeechSynthesis API
 */
export function speakWord(text: string, voiceType: 'en-US' | 'en-GB' = 'en-US', speed = 0.85): void {
  if (!('speechSynthesis' in window)) {
    console.warn('SpeechSynthesis is not supported in this browser environment.');
    return;
  }

  window.speechSynthesis.cancel(); // Ngắt câu trước nếu đang nói

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = voiceType;
  utterance.rate = speed;
  utterance.pitch = 1.0;

  // Lấy voice tiếng Anh phù hợp nếu có
  const voices = window.speechSynthesis.getVoices();
  const selectedVoice = voices.find(v => v.lang.includes(voiceType.replace('-', '_')) || v.lang.includes(voiceType));
  if (selectedVoice) {
    utterance.voice = selectedVoice;
  }

  window.speechSynthesis.speak(utterance);
}

/**
 * Nhận diện giọng nói để luyện phát âm
 */
export interface SpeechRecognizerHandle {
  recognition: any;
  stop: () => void;
}

export function createSpeechRecognizer(
  onResult: (transcript: string, isFinal: boolean) => void,
  onError: (errorMessage: string) => void,
  onEnd?: () => void
): SpeechRecognizerHandle | null {
  const SpeechRecognition =
    (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

  if (!SpeechRecognition) {
    onError('Trình duyệt của bạn chưa hỗ trợ Web Speech Recognition. Hãy dùng Google Chrome hoặc Edge để luyện nói.');
    return null;
  }

  try {
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    recognition.maxAlternatives = 1;

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

      onResult(interimTranscript.trim().toLowerCase(), isFinal);
    };

    recognition.onerror = (event: any) => {
      if (event.error === 'no-speech') {
        onError('Không nghe thấy giọng nói. Bạn hãy thử lại gần mic hơn nhé.');
      } else if (event.error === 'not-allowed') {
        onError('Quyền truy cập Microphone bị từ chối. Vui lòng cấp quyền trong cài đặt trình duyệt.');
      } else {
        onError(`Lỗi nhận diện âm thanh: ${event.error}`);
      }
    };

    if (onEnd) {
      recognition.onend = onEnd;
    }

    recognition.start();

    return {
      recognition,
      stop: () => {
        try {
          recognition.stop();
        } catch {
          // ignore
        }
      }
    };
  } catch (err: any) {
    onError(`Không thể khởi động microphone: ${err?.message || 'Lỗi không xác định'}`);
    return null;
  }
}

/**
 * Tính điểm độ tương đồng Levenshtein Distance giữa từ dự kiến và giọng đọc thực tế
 */
export function calculateAccuracy(expected: string, actual: string): number {
  const cleanExp = expected.toLowerCase().replace(/[^a-z0-9]/g, '').trim();
  const cleanAct = actual.toLowerCase().replace(/[^a-z0-9]/g, '').trim();

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
