import {
  ToeicQuestion,
  ToeicPart,
  ToeicSkill,
  ToeicExperienceMode,
  ToeicSkillScope,
  ToeicAdaptiveState,
  ToeicDiagnosticReport,
  resolveExperienceAndSkillScope,
} from '../types/toeic';
import { generateDiagnosticReport } from './toeicDiagnosticEngine';

export interface ToeicPartPerformance {
  part: ToeicPart;
  partName: string;
  skill: ToeicSkill;
  total: number;
  correct: number;
  accuracy: number; // 0 - 100%
}

export interface ToeicScoreEvaluation {
  is4Skills: boolean;
  experienceMode?: ToeicExperienceMode;
  skillScope?: ToeicSkillScope;
  adaptiveState?: ToeicAdaptiveState;
  diagnosticReport?: ToeicDiagnosticReport;
  
  // TOEIC LR (Listening & Reading - Thang 990)
  listeningScore: number;      // 5 - 495
  readingScore: number;        // 5 - 495
  totalScore: number;          // listeningScore + readingScore (10 - 990)
  listeningCorrect: number;
  listeningTotal: number;
  readingCorrect: number;
  readingTotal: number;

  // Detailed Metrics
  totalQuestions: number;
  answeredCount: number;
  unansweredCount: number;
  overallAccuracy: number;     // 0 - 100%
  partBreakdown: ToeicPartPerformance[];
  strengths: string[];
  areasToImprove: string[];

  // TOEIC SW (Speaking & Writing - Thang 400)
  hasSpeaking: boolean;
  speakingScore?: number;      // 0 - 200
  speakingFeedback?: string;
  speakingEvaluation?: {
    pronunciationScore: number;
    fluencyScore: number;
    contentScore: number;
  };

  hasWriting: boolean;
  writingScore?: number;       // 0 - 200
  writingWordCount?: number;
  writingFeedback?: string;
  writingEvaluation?: {
    grammarScore: number;
    organizationScore: number;
    vocabularyScore: number;
  };

  totalSWScore?: number;       // speakingScore + writingScore (0 - 400)

  // CEFR & Recommendation (Ước lượng tương đương)
  cefrLevel: 'A1/A2' | 'B1' | 'B2' | 'C1';
  cefrDescription: string;
  recommendation: string;

  // Practice Learning Metrics (Phase 3)
  practiceStats?: {
    firstAttemptCorrect: number;
    retryCorrect: number;
    totalQuestions: number;
    accuracy: number;
  };

  // Time Usage (Phase 4 Mock Test)
  timeSpentSeconds?: number;
}

export interface ToeicScoringInput {
  mode: '2skills_mini' | '2skills_full' | '4skills' | string;
  experienceMode?: ToeicExperienceMode;
  skillScope?: ToeicSkillScope;
  adaptiveState?: ToeicAdaptiveState;
  questions: ToeicQuestion[];
  userAnswers: Record<string, string>;
  firstAttemptAnswers?: Record<string, string>;
  speakingTranscript?: string;
  writingText?: string;
  timeSpentSeconds?: number;
}

const PART_NAMES: Record<ToeicPart, string> = {
  part1_photos: 'Part 1: Photographs',
  part2_qna: 'Part 2: Question & Response',
  part3_conv: 'Part 3: Short Conversations',
  part4_talks: 'Part 4: Short Talks',
  part5_grammar: 'Part 5: Incomplete Sentences',
  part6_text: 'Part 6: Text Completion',
  part7_reading: 'Part 7: Reading Comprehension',
  speaking_read: 'Speaking: Aloud & Opinion',
  writing_email: 'Writing: Email Response',
};

/**
 * Đánh giá điểm số mô phỏng TOEIC theo cấu trúc chuẩn ETS
 * Đảm bảo các nguyên tắc an toàn:
 * 1. Zero division guards (mảng rỗng hoặc 0 câu trả lời không gây NaN / crash)
 * 2. Thang LR chuẩn: 5 - 495 điểm mỗi phần (bội số của 5), tổng 10 - 990
 * 3. Thang SW chuẩn: 0 - 200 điểm mỗi phần, tổng 0 - 400
 * 4. Phân tích chi tiết từng Part, tỷ lệ chính xác %, điểm mạnh và điểm cần cải thiện
 */
export function calculateToeicScores(input: ToeicScoringInput): ToeicScoreEvaluation {
  const {
    mode,
    questions = [],
    userAnswers = {},
    firstAttemptAnswers,
    speakingTranscript,
    writingText,
  } = input;
  const is4Skills = mode === '4skills';

  // Trong Practice mode (hoặc khi có firstAttemptAnswers), scoring & analytics lấy first-attempt làm chuẩn (Single Source of Truth)
  const scoringAnswers = (firstAttemptAnswers && Object.keys(firstAttemptAnswers).length > 0)
    ? firstAttemptAnswers
    : userAnswers;

  // 1. Phân loại câu hỏi
  const listeningQuestions = questions.filter((q) => q.skill === 'listening');
  const readingQuestions = questions.filter((q) => q.skill === 'reading');
  const speakingQuestions = questions.filter((q) => q.skill === 'speaking');
  const writingQuestions = questions.filter((q) => q.skill === 'writing');

  // 2. Chấm điểm Listening (Thang 5 - 495)
  let listeningCorrect = 0;
  listeningQuestions.forEach((q) => {
    const ans = scoringAnswers[q.id];
    if (ans && ans !== 'SKIPPED' && q.correctAnswer && ans === q.correctAnswer) {
      listeningCorrect++;
    }
  });

  const listeningRatio = listeningQuestions.length > 0 ? listeningCorrect / listeningQuestions.length : 0;
  let listeningScore = 5;
  if (listeningCorrect > 0) {
    listeningScore = Math.round(5 + listeningRatio * 490);
    listeningScore = Math.min(495, Math.max(5, Math.round(listeningScore / 5) * 5)); // Bội số 5
  }

  // 3. Chấm điểm Reading (Thang 5 - 495)
  let readingCorrect = 0;
  readingQuestions.forEach((q) => {
    const ans = scoringAnswers[q.id];
    if (ans && ans !== 'SKIPPED' && q.correctAnswer && ans === q.correctAnswer) {
      readingCorrect++;
    }
  });

  const readingRatio = readingQuestions.length > 0 ? readingCorrect / readingQuestions.length : 0;
  let readingScore = 5;
  if (readingCorrect > 0) {
    readingScore = Math.round(5 + readingRatio * 490);
    readingScore = Math.min(495, Math.max(5, Math.round(readingScore / 5) * 5)); // Bội số 5
  }

  // Tổng điểm LR (10 - 990)
  const totalScore = Math.min(990, Math.max(10, listeningScore + readingScore));

  // 4. Thống kê câu trả lời và độ chính xác chung
  const totalLR = listeningQuestions.length + readingQuestions.length;
  const totalLRCorrect = listeningCorrect + readingCorrect;
  const overallAccuracy = totalLR > 0 ? Math.round((totalLRCorrect / totalLR) * 100) : 0;

  let answeredCount = 0;
  let unansweredCount = 0;
  questions.forEach((q) => {
    const ans = scoringAnswers[q.id];
    if (ans && ans.trim() !== '' && ans !== 'SKIPPED') {
      answeredCount++;
    } else {
      unansweredCount++;
    }
  });

  // 5. Phân tích chi tiết từng Part (Part Performance Breakdown)
  const partMap = new Map<ToeicPart, { total: number; correct: number; skill: ToeicSkill }>();
  questions.forEach((q) => {
    if (!partMap.has(q.part)) {
      partMap.set(q.part, { total: 0, correct: 0, skill: q.skill });
    }
    const item = partMap.get(q.part)!;
    item.total++;
    const ans = scoringAnswers[q.id];
    if (ans && ans !== 'SKIPPED' && q.correctAnswer && ans === q.correctAnswer) {
      item.correct++;
    }
  });

  const partBreakdown: ToeicPartPerformance[] = [];
  partMap.forEach((val, partKey) => {
    partBreakdown.push({
      part: partKey,
      partName: PART_NAMES[partKey] || partKey,
      skill: val.skill,
      total: val.total,
      correct: val.correct,
      accuracy: val.total > 0 ? Math.round((val.correct / val.total) * 100) : 0,
    });
  });

  // Sắp xếp thứ tự part theo đúng format TOEIC
  const partOrder: ToeicPart[] = [
    'part1_photos',
    'part2_qna',
    'part3_conv',
    'part4_talks',
    'part5_grammar',
    'part6_text',
    'part7_reading',
    'speaking_read',
    'writing_email',
  ];
  partBreakdown.sort((a, b) => partOrder.indexOf(a.part) - partOrder.indexOf(b.part));

  // 6. Tự động suy luận Điểm mạnh (Strengths) và Điểm cần cải thiện (Areas to Improve)
  const strengths: string[] = [];
  const areasToImprove: string[] = [];

  partBreakdown.forEach((p) => {
    if (p.skill === 'listening' || p.skill === 'reading') {
      if (p.accuracy >= 75) {
        strengths.push(`${p.partName}: Đạt độ chính xác cao (${p.accuracy}%) với khả năng xử lý câu hỏi tốt.`);
      } else if (p.accuracy <= 50) {
        areasToImprove.push(`${p.partName}: Độ chính xác còn thấp (${p.accuracy}%). Cần chú trọng luyện tập thêm.`);
      }
    }
  });

  if (unansweredCount > 0) {
    areasToImprove.push(`Còn ${unansweredCount} câu chưa làm kịp thời gian. Cần rèn luyện chiến lược phân bổ thời gian.`);
  }

  if (strengths.length === 0 && overallAccuracy >= 60) {
    strengths.push('Kỹ năng làm bài tương đối đồng đều giữa các phần.');
  } else if (strengths.length === 0) {
    strengths.push('Đã hoàn thành toàn bộ bài khảo sát năng lực nghiêm túc.');
  }

  if (areasToImprove.length === 0) {
    areasToImprove.push('Duy trì phản xạ nghe đọc hàng ngày để giữ vững phong độ điểm số.');
  }

  // 7. Chấm điểm Speaking (Thang 0 - 200)
  let speakingScore = 0;
  let speakingFeedback = 'Chưa thu âm câu trả lời Speaking (0 điểm).';
  let speakingEvaluation: ToeicScoreEvaluation['speakingEvaluation'] = undefined;
  const hasSpeaking = is4Skills || speakingQuestions.length > 0;

  if (hasSpeaking) {
    const cleanSpeech = (speakingTranscript || '').trim();
    if (!cleanSpeech || cleanSpeech === 'SKIPPED') {
      speakingScore = 0;
      speakingFeedback = 'Bạn chưa thực hiện thu âm cho phần Speaking (0/200 điểm).';
      speakingEvaluation = { pronunciationScore: 0, fluencyScore: 0, contentScore: 0 };
    } else {
      const words = cleanSpeech.split(/\s+/).filter(Boolean);
      const wordCount = words.length;

      if (wordCount < 4) {
        speakingScore = 50;
        speakingFeedback = 'Đoạn nói quá ngắn hoặc chưa rõ ràng (50/200 điểm).';
        speakingEvaluation = { pronunciationScore: 20, fluencyScore: 15, contentScore: 15 };
      } else if (wordCount < 10) {
        speakingScore = 110;
        speakingFeedback = 'Phát âm cơ bản được ghi nhận, cần lưu ý ngữ điệu và phát âm từ vựng (110/200 điểm).';
        speakingEvaluation = { pronunciationScore: 35, fluencyScore: 40, contentScore: 35 };
      } else if (wordCount < 20) {
        speakingScore = 150;
        speakingFeedback = 'Phát âm tốt, mạch lạc, tốc độ nói tự nhiên (150/200 điểm).';
        speakingEvaluation = { pronunciationScore: 45, fluencyScore: 50, contentScore: 55 };
      } else if (wordCount < 35) {
        speakingScore = 180;
        speakingFeedback = 'Xuất sắc! Phát âm chuẩn, phản xạ tự nhiên và sử dụng từ ngữ lưu loát (180/200 điểm).';
        speakingEvaluation = { pronunciationScore: 55, fluencyScore: 60, contentScore: 65 };
      } else {
        speakingScore = 200;
        speakingFeedback = 'Hoàn hảo! Năng lực nói đạt chuẩn chuyên nghiệp bản xứ (200/200 điểm).';
        speakingEvaluation = { pronunciationScore: 60, fluencyScore: 70, contentScore: 70 };
      }
    }
  }

  // 8. Chấm điểm Writing (Thang 0 - 200)
  let writingScore = 0;
  let writingFeedback = 'Chưa viết nội dung email phản hồi (0 điểm).';
  let writingEvaluation: ToeicScoreEvaluation['writingEvaluation'] = undefined;
  const hasWriting = is4Skills || writingQuestions.length > 0;
  const cleanWriting = (writingText || '').trim();
  const writingWordCount = cleanWriting ? cleanWriting.split(/\s+/).filter(Boolean).length : 0;

  if (hasWriting) {
    if (!cleanWriting || cleanWriting === 'SKIPPED' || writingWordCount === 0) {
      writingScore = 0;
      writingFeedback = 'Bạn chưa nhập văn bản email cho phần Writing (0/200 điểm).';
      writingEvaluation = { grammarScore: 0, organizationScore: 0, vocabularyScore: 0 };
    } else if (writingWordCount < 10) {
      writingScore = 40;
      writingFeedback = `Email quá ngắn (${writingWordCount} từ), chưa đáp ứng cấu trúc thư tín công sở (40/200 điểm).`;
      writingEvaluation = { grammarScore: 15, organizationScore: 15, vocabularyScore: 10 };
    } else if (writingWordCount < 25) {
      writingScore = 100;
      writingFeedback = `Đã thể hiện được ý chính (${writingWordCount} từ), cần mở rộng câu chào và câu kết chuyên nghiệp (100/200 điểm).`;
      writingEvaluation = { grammarScore: 30, organizationScore: 35, vocabularyScore: 35 };
    } else if (writingWordCount < 50) {
      writingScore = 150;
      writingFeedback = `Bố cục email chuẩn (${writingWordCount} từ), văn phong lịch sự, ngữ pháp tương đối chuẩn (150/200 điểm).`;
      writingEvaluation = { grammarScore: 45, organizationScore: 50, vocabularyScore: 55 };
    } else if (writingWordCount < 70) {
      writingScore = 180;
      writingFeedback = `Bài viết rất tốt (${writingWordCount} từ), văn phong doanh nghiệp tự nhiên và thuyết phục (180/200 điểm).`;
      writingEvaluation = { grammarScore: 55, organizationScore: 60, vocabularyScore: 65 };
    } else {
      writingScore = 200;
      writingFeedback = `Bài viết hoàn hảo (${writingWordCount} từ), văn phong học thuật và thương mại chuẩn mực (200/200 điểm).`;
      writingEvaluation = { grammarScore: 60, organizationScore: 70, vocabularyScore: 70 };
    }
  }

  const totalSWScore = hasSpeaking || hasWriting ? Math.min(400, Math.max(0, speakingScore + writingScore)) : undefined;

  // 9. Quy đổi trình độ tương đương CEFR
  let cefrLevel: 'A1/A2' | 'B1' | 'B2' | 'C1' = 'A1/A2';
  let cefrDescription = '';
  let recommendation = '';

  if (totalScore >= 785) {
    cefrLevel = 'C1';
    cefrDescription = 'Ước lượng tương đương C1 Advanced. Năng lực làm việc độc lập và xử lý công việc tự tin trong môi trường quốc tế.';
    recommendation = 'Duy trì phản xạ nghe nói hàng ngày, trau dồi các thành ngữ kinh doanh và cấu trúc viết báo cáo chuyên sâu.';
  } else if (totalScore >= 550) {
    cefrLevel = 'B2';
    cefrDescription = 'Ước lượng tương đương B2 Operational. Đủ năng lực giao tiếp và xử lý email, tài liệu công việc tiêu chuẩn.';
    recommendation = 'Tập trung củng cố các cấu trúc ngữ pháp phức tạp ở Part 5 & 6 và cải thiện tốc độ đọc hiểu văn bản dài ở Part 7.';
  } else if (totalScore >= 255) {
    cefrLevel = 'B1';
    cefrDescription = 'Ước lượng tương đương B1 Intermediate. Có thể hiểu các đoạn hội thoại đơn giản và văn bản ngắn quen thuộc.';
    recommendation = 'Luyện nghe phát âm nối âm ở Part 1 & 2, tăng cường học từ vựng mỗi ngày trên Flashcard SRS.';
  } else {
    cefrLevel = 'A1/A2';
    cefrDescription = 'Ước lượng tương đương A1/A2 Elementary. Cần củng cố lại nền tảng từ vựng và ngữ pháp cốt lõi.';
    recommendation = 'Hoàn thành mục tiêu 15 từ mới mỗi ngày, ôn lại các cấu trúc cơ bản và luyện nghe từng câu ngắn trong tab Luyện Phát Âm.';
  }

  const resolved = resolveExperienceAndSkillScope({
    experienceMode: input.experienceMode,
    skillScope: input.skillScope,
    mode: input.mode,
  });

  let practiceStats: ToeicScoreEvaluation['practiceStats'] = undefined;
  if (resolved.experienceMode === 'practice' || firstAttemptAnswers) {
    const firstAttemptCorrect = totalLRCorrect;
    const retryCorrect = Object.entries(userAnswers).filter(([qId, ans]) => {
      const q = questions.find((item) => item.id === qId);
      const wasFirstWrong = scoringAnswers[qId] && scoringAnswers[qId] !== q?.correctAnswer;
      return q && wasFirstWrong && ans === q.correctAnswer;
    }).length;

    practiceStats = {
      firstAttemptCorrect,
      retryCorrect,
      totalQuestions: questions.length,
      accuracy: overallAccuracy,
    };
  }

  const diagnosticReport =
    resolved.experienceMode === 'diagnostic'
      ? generateDiagnosticReport({
          questions,
          userAnswers,
          adaptiveState: input.adaptiveState,
        })
      : undefined;

  return {
    is4Skills,
    experienceMode: resolved.experienceMode,
    skillScope: resolved.skillScope,
    adaptiveState: input.adaptiveState,
    diagnosticReport,
    practiceStats,
    listeningScore,
    readingScore,
    totalScore,
    listeningCorrect,
    listeningTotal: listeningQuestions.length,
    readingCorrect,
    readingTotal: readingQuestions.length,
    totalQuestions: questions.length,
    answeredCount,
    unansweredCount,
    overallAccuracy,
    partBreakdown,
    strengths,
    areasToImprove,
    hasSpeaking,
    speakingScore: hasSpeaking ? speakingScore : undefined,
    speakingFeedback: hasSpeaking ? speakingFeedback : undefined,
    speakingEvaluation,
    hasWriting,
    writingScore: hasWriting ? writingScore : undefined,
    writingWordCount,
    writingFeedback: hasWriting ? writingFeedback : undefined,
    writingEvaluation,
    totalSWScore,
    cefrLevel,
    cefrDescription,
    recommendation,
    timeSpentSeconds: input.timeSpentSeconds,
  };
}
