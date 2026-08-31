import { ToeicQuestion } from '../types';

export interface ToeicScoreEvaluation {
  listeningScore: number;
  readingScore: number;
  speakingScore?: number;
  writingScore?: number;
  totalScore: number;
  listeningCorrect: number;
  listeningTotal: number;
  readingCorrect: number;
  readingTotal: number;
  cefrLevel: 'A1/A2' | 'B1' | 'B2' | 'C1';
  cefrDescription: string;
  recommendation: string;
}

/**
 * Tính điểm chuẩn ETS từ câu trả lời của người dùng
 */
export function calculateToeicScores(
  questions: ToeicQuestion[],
  userAnswers: Record<string, string>,
  speakingScoreRaw: number = 160,
  writingScoreRaw: number = 150
): ToeicScoreEvaluation {
  const listeningQuestions = questions.filter((q) => q.skill === 'listening');
  const readingQuestions = questions.filter((q) => q.skill === 'reading');

  let listeningCorrect = 0;
  listeningQuestions.forEach((q) => {
    if (q.correctAnswer && userAnswers[q.id] === q.correctAnswer) {
      listeningCorrect++;
    }
  });

  let readingCorrect = 0;
  readingQuestions.forEach((q) => {
    if (q.correctAnswer && userAnswers[q.id] === q.correctAnswer) {
      readingCorrect++;
    }
  });

  // Quy đổi điểm Listening (5 - 495)
  const listeningRatio = listeningQuestions.length > 0 ? listeningCorrect / listeningQuestions.length : 0;
  let listeningScore = Math.round(5 + listeningRatio * 490);
  listeningScore = Math.min(495, Math.max(5, Math.round(listeningScore / 5) * 5)); // làm tròn bội số của 5

  // Quy đổi điểm Reading (5 - 495)
  const readingRatio = readingQuestions.length > 0 ? readingCorrect / readingQuestions.length : 0;
  let readingScore = Math.round(5 + readingRatio * 490);
  readingScore = Math.min(495, Math.max(5, Math.round(readingScore / 5) * 5));

  const totalScore = listeningScore + readingScore;

  // Xác định CEFR Level
  let cefrLevel: 'A1/A2' | 'B1' | 'B2' | 'C1' = 'A1/A2';
  let cefrDescription = '';
  let recommendation = '';

  if (totalScore >= 785) {
    cefrLevel = 'C1';
    cefrDescription = 'Trình độ Cao Cấp (Working Proficiency / C1 Advanced). Khả năng giao tiếp và làm việc độc lập trong môi trường đa quốc gia.';
    recommendation = 'Duy trì phản xạ nghe nói hàng ngày, trau dồi các từ vựng học thuật hiếm gặp và thành ngữ kinh doanh nâng cao.';
  } else if (totalScore >= 550) {
    cefrLevel = 'B2';
    cefrDescription = 'Trình độ Trung Cao Cấp (Operational Proficiency / B2). Đủ năng lực giao tiếp và xử lý email, báo cáo công việc tiêu chuẩn.';
    recommendation = 'Tập trung củng cố các cấu trúc ngữ pháp phức tạp ở Part 5 & 6 và cải thiện tốc độ đọc hiểu văn bản dài ở Part 7.';
  } else if (totalScore >= 255) {
    cefrLevel = 'B1';
    cefrDescription = 'Trình độ Trung Cấp (Intermediate / B1). Có thể hiểu các đoạn hội thoại đơn giản và văn bản ngắn quen thuộc.';
    recommendation = 'Luyện nghe phát âm nối âm (linking sounds) ở Part 1 & 2, tăng cường học bộ từ vựng 5.000 từ trên Flashcard SRS mỗi ngày.';
  } else {
    cefrLevel = 'A1/A2';
    cefrDescription = 'Trình độ Sơ Cấp (Elementary / A1-A2). Cần xây dựng lại nền tảng từ vựng và ngữ pháp cốt lõi.';
    recommendation = 'Hoàn thành mục tiêu 15 từ mới mỗi ngày, ôn lại các thì cơ bản và luyện nghe từng câu ngắn trong tab Luyện Phát Âm.';
  }

  return {
    listeningScore,
    readingScore,
    speakingScore: speakingScoreRaw,
    writingScore: writingScoreRaw,
    totalScore,
    listeningCorrect,
    listeningTotal: listeningQuestions.length,
    readingCorrect,
    readingTotal: readingQuestions.length,
    cefrLevel,
    cefrDescription,
    recommendation,
  };
}
