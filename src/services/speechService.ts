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
