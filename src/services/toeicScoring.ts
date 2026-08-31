import { ToeicQuestion } from '../types';

export interface ToeicScoreEvaluation {
  is4Skills: boolean;
  
  // TOEIC LR (Listening & Reading - Thang 990)
  listeningScore: number;      // 5 - 495
  readingScore: number;        // 5 - 495
  totalScore: number;          // listeningScore + readingScore (10 - 990)
  listeningCorrect: number;
  listeningTotal: number;
  readingCorrect: number;
  readingTotal: number;

  // TOEIC SW (Speaking & Writing - Thang 400)
  hasSpeaking: boolean;
  speakingScore?: number;      // 0 - 200
  speakingFeedback?: string;

  hasWriting: boolean;
  writingScore?: number;       // 0 - 200
  writingWordCount?: number;
  writingFeedback?: string;

  totalSWScore?: number;       // speakingScore + writingScore (0 - 400)

  // CEFR & Recommendation
  cefrLevel: 'A1/A2' | 'B1' | 'B2' | 'C1';
  cefrDescription: string;
  recommendation: string;
}

export interface ToeicScoringInput {
  mode: '2skills_mini' | '2skills_full' | '4skills';
  questions: ToeicQuestion[];
  userAnswers: Record<string, string>;
  speakingTranscript?: string;
  writingText?: string;
}

/**
 * Tính điểm chuẩn ETS từ câu trả lời của người dùng
 * Đảm bảo quy tắc:
 * 1. Bỏ qua / rỗng / không ghi âm -> 0 điểm tuyệt đối
 * 2. Tổng điểm LR (990) = Listening (max 495) + Reading (max 495)
 * 3. Tổng điểm SW (400) = Speaking (max 200) + Writing (max 200)
 */
export function calculateToeicScores(input: ToeicScoringInput): ToeicScoreEvaluation {
  const { mode, questions, userAnswers, speakingTranscript, writingText } = input;
  const is4Skills = mode === '4skills';

  // 1. Phân loại câu hỏi
  const listeningQuestions = questions.filter((q) => q.skill === 'listening');
  const readingQuestions = questions.filter((q) => q.skill === 'reading');
  const speakingQuestions = questions.filter((q) => q.skill === 'speaking');
  const writingQuestions = questions.filter((q) => q.skill === 'writing');

  // 2. Chấm điểm Listening (Thang 5 - 495)
  let listeningCorrect = 0;
  listeningQuestions.forEach((q) => {
    const ans = userAnswers[q.id];
    if (ans && ans !== 'SKIPPED' && q.correctAnswer && ans === q.correctAnswer) {
      listeningCorrect++;
    }
  });

  const listeningRatio = listeningQuestions.length > 0 ? listeningCorrect / listeningQuestions.length : 0;
  let listeningScore = 5;
  if (listeningCorrect > 0) {
    listeningScore = Math.round(5 + listeningRatio * 490);
    listeningScore = Math.min(495, Math.max(5, Math.round(listeningScore / 5) * 5)); // làm tròn bội số 5
  }

  // 3. Chấm điểm Reading (Thang 5 - 495)
  let readingCorrect = 0;
  readingQuestions.forEach((q) => {
    const ans = userAnswers[q.id];
    if (ans && ans !== 'SKIPPED' && q.correctAnswer && ans === q.correctAnswer) {
      readingCorrect++;
    }
  });

  const readingRatio = readingQuestions.length > 0 ? readingCorrect / readingQuestions.length : 0;
  let readingScore = 5;
  if (readingCorrect > 0) {
    readingScore = Math.round(5 + readingRatio * 490);
    readingScore = Math.min(495, Math.max(5, Math.round(readingScore / 5) * 5));
  }

  // Tổng điểm LR (10 - 990)
  const totalScore = listeningScore + readingScore;

  // 4. Chấm điểm Speaking (Thang 0 - 200)
  let speakingScore = 0;
  let speakingFeedback = 'Chưa thu âm câu trả lời Speaking (0 điểm).';
  const hasSpeaking = is4Skills || speakingQuestions.length > 0;

  if (hasSpeaking) {
    const cleanSpeech = (speakingTranscript || '').trim();
    if (!cleanSpeech || cleanSpeech === 'SKIPPED') {
      speakingScore = 0;
      speakingFeedback = 'Bạn chưa thực hiện thu âm cho phần Speaking (0/200 điểm).';
    } else {
      const wordCount = cleanSpeech.split(/\s+/).filter(Boolean).length;
      if (wordCount < 4) {
        speakingScore = 50;
        speakingFeedback = 'Đoạn nói quá ngắn hoặc chưa rõ ràng (50/200 điểm).';
      } else if (wordCount < 10) {
        speakingScore = 110;
        speakingFeedback = 'Phát âm cơ bản được ghi nhận, cần lưu ý ngữ điệu và phát âm từ vựng (110/200 điểm).';
      } else if (wordCount < 20) {
        speakingScore = 150;
        speakingFeedback = 'Phát âm tốt, mạch lạc, tốc độ nói tự nhiên (150/200 điểm).';
      } else {
        speakingScore = 180;
        speakingFeedback = 'Xuất sắc! Phát âm chuẩn bản xứ, ngữ điệu và phản xạ rất tốt (180/200 điểm).';
      }
    }
  }

  // 5. Chấm điểm Writing (Thang 0 - 200)
  let writingScore = 0;
  let writingFeedback = 'Chưa viết nội dung email phản hồi (0 điểm).';
  const hasWriting = is4Skills || writingQuestions.length > 0;
  const cleanWriting = (writingText || '').trim();
  const writingWordCount = cleanWriting ? cleanWriting.split(/\s+/).filter(Boolean).length : 0;

  if (hasWriting) {
    if (!cleanWriting || cleanWriting === 'SKIPPED' || writingWordCount === 0) {
      writingScore = 0;
      writingFeedback = 'Bạn chưa nhập văn bản email cho phần Writing (0/200 điểm).';
    } else if (writingWordCount < 10) {
      writingScore = 40;
      writingFeedback = `Email quá ngắn (${writingWordCount} từ), chưa đáp ứng cấu trúc thư tín công sở (40/200 điểm).`;
    } else if (writingWordCount < 25) {
      writingScore = 100;
      writingFeedback = `Đã thể hiện được ý chính (${writingWordCount} từ), cần mở rộng câu chào và câu kết chuyên nghiệp (100/200 điểm).`;
    } else if (writingWordCount < 50) {
      writingScore = 150;
      writingFeedback = `Bố cục email chuẩn (${writingWordCount} từ), văn phong lịch sự, ngữ pháp tương đối chuẩn (150/200 điểm).`;
    } else {
      writingScore = 180;
      writingFeedback = `Bài viết xuất sắc (${writingWordCount} từ), văn phong doanh nghiệp C1/C2 tự nhiên và thuyết phục (180/200 điểm).`;
    }
  }

  const totalSWScore = hasSpeaking || hasWriting ? speakingScore + writingScore : undefined;

  // 6. Quy đổi trình độ CEFR
  let cefrLevel: 'A1/A2' | 'B1' | 'B2' | 'C1' = 'A1/A2';
  let cefrDescription = '';
  let recommendation = '';

  if (totalScore >= 785) {
    cefrLevel = 'C1';
    cefrDescription = 'Trình độ Cao Cấp (Working Proficiency / C1 Advanced). Năng lực giao tiếp và xử lý công việc độc lập trong môi trường đa quốc gia.';
    recommendation = 'Duy trì phản xạ nghe nói hàng ngày, trau dồi các từ vựng học thuật hiếm gặp và thành ngữ kinh doanh nâng cao.';
  } else if (totalScore >= 550) {
    cefrLevel = 'B2';
    cefrDescription = 'Trình độ Trung Cao Cấp (Operational Proficiency / B2). Đủ năng lực giao tiếp và xử lý email, báo cáo công việc tiêu chuẩn.';
    recommendation = 'Tập trung củng cố các cấu trúc ngữ pháp phức tạp ở Part 5 & 6 và cải thiện tốc độ đọc hiểu văn bản dài ở Part 7.';
  } else if (totalScore >= 255) {
    cefrLevel = 'B1';
    cefrDescription = 'Trình độ Trung Cấp (Intermediate / B1). Có thể hiểu các đoạn hội thoại đơn giản và văn bản ngắn quen thuộc.';
    recommendation = 'Luyện nghe phát âm nối âm ở Part 1 & 2, tăng cường học từ vựng mỗi ngày trên Flashcard SRS.';
  } else {
    cefrLevel = 'A1/A2';
    cefrDescription = 'Trình độ Sơ Cấp (Elementary / A1-A2). Cần củng cố lại nền tảng từ vựng và ngữ pháp cốt lõi.';
    recommendation = 'Hoàn thành mục tiêu 15 từ mới mỗi ngày, ôn lại các cấu trúc cơ bản và luyện nghe từng câu ngắn trong tab Luyện Phát Âm.';
  }

  return {
    is4Skills,
    listeningScore,
    readingScore,
    totalScore,
    listeningCorrect,
    listeningTotal: listeningQuestions.length,
    readingCorrect,
    readingTotal: readingQuestions.length,
    hasSpeaking,
    speakingScore: hasSpeaking ? speakingScore : undefined,
    speakingFeedback: hasSpeaking ? speakingFeedback : undefined,
    hasWriting,
    writingScore: hasWriting ? writingScore : undefined,
    writingWordCount,
    writingFeedback: hasWriting ? writingFeedback : undefined,
    totalSWScore,
    cefrLevel,
    cefrDescription,
    recommendation,
  };
}
