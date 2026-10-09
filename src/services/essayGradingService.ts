import type { 
  CEFRLevel, 
  DiffSegment, 
  DiffSegmentType, 
  EssayCriteriaBreakdown, 
  EssayGradingResult, 
  GradeEssayOptions 
} from '../types';

/**
 * Ánh xạ điểm số (0 - 100) sang cấp độ CEFR chuẩn:
 * - A1: < 40
 * - A2: 40 - 59
 * - B1: 60 - 74
 * - B2: 75 - 84
 * - C1: 85 - 94
 * - C2: 95+
 */
export function scoreToCEFRLevel(score: number): CEFRLevel {
  const s = Math.max(0, Math.min(100, Math.round(score)));
  if (s < 40) return 'A1';
  if (s <= 59) return 'A2';
  if (s <= 74) return 'B1';
  if (s <= 84) return 'B2';
  if (s <= 94) return 'C1';
  return 'C2';
}

/**
 * Tính điểm trung bình cộng 4 tiêu chí CEFR và quy đổi ra cấp độ CEFR tổng quát:
 * (Task Achievement + Coherence & Cohesion + Lexical Resource + Grammatical Accuracy) / 4
 */
export function calculateOverallScore(criteria: EssayCriteriaBreakdown): {
  overallScore: number;
  overallCEFR: CEFRLevel;
} {
  const sum =
    criteria.taskAchievement.score +
    criteria.coherenceCohesion.score +
    criteria.lexicalResource.score +
    criteria.grammaticalAccuracy.score;
  const overallScore = Math.max(0, Math.min(100, Math.round(sum / 4)));
  const overallCEFR = scoreToCEFRLevel(overallScore);
  return { overallScore, overallCEFR };
}

/**
 * Nối lại các đoạn diffSegment để khôi phục toàn vẹn 100% văn bản ban đầu
 */
export function reconstructOriginalText(segments: DiffSegment[]): string {
  if (!Array.isArray(segments)) return '';
  return segments.map((s) => s.originalText || '').join('');
}

/**
 * Nối lại các đoạn diffSegment theo bản sửa đổi đã được nâng cấp (revised)
 */
export function reconstructRevisedText(segments: DiffSegment[]): string {
  if (!Array.isArray(segments)) return '';
  return segments.map((s) => (s.revisedText !== undefined ? s.revisedText : s.originalText || '')).join('');
}

// Từ điển mẫu phục vụ Fallback Mock Engine phân giải Diff Segments
const FALLBACK_UPGRADES: Array<{
  pattern: RegExp;
  revisedText: string;
  type: DiffSegmentType;
  explanation: string;
}> = [
  {
    pattern: /\bvery good\b/i,
    revisedText: 'immensely beneficial',
    type: 'enhancement',
    explanation: 'Nâng cấp từ vựng "very good" lên cụm từ học thuật C1 "immensely beneficial".',
  },
  {
    pattern: /\bvery important\b/i,
    revisedText: 'of paramount importance',
    type: 'enhancement',
    explanation: 'Nâng cấp cụm "very important" thành thành ngữ học thuật C1/C2 "of paramount importance".',
  },
  {
    pattern: /\bin my opinion\b/i,
    revisedText: 'from my perspective',
    type: 'enhancement',
    explanation: 'Thay thế cụm từ quen thuộc bằng liên từ học thuật C1 "from my perspective".',
  },
  {
    pattern: /\ba lot of\b/i,
    revisedText: 'a substantial number of',
    type: 'enhancement',
    explanation: 'Dùng "a substantial number of" thay cho "a lot of" để tăng tính trang trọng trong văn viết.',
  },
  {
    pattern: /\brelies\b/i,
    revisedText: 'rely',
    type: 'correction',
    explanation: 'Sửa lỗi hòa hợp chủ vị: chủ ngữ số nhiều cần đi với động từ nguyên mẫu "rely".',
  },
  {
    pattern: /\bimportant\b/i,
    revisedText: 'pivotal',
    type: 'enhancement',
    explanation: 'Nâng cấp tính từ "important" thành "pivotal" (then chốt/trọng yếu) ở cấp độ C1.',
  },
  {
    pattern: /\bhelp\b/i,
    revisedText: 'facilitate',
    type: 'enhancement',
    explanation: 'Sử dụng động từ học thuật "facilitate" thay vì "help" trong văn cảnh học thuật.',
  },
  {
    pattern: /\bgood\b/i,
    revisedText: 'advantageous',
    type: 'enhancement',
    explanation: 'Nâng cấp tính từ "good" thành "advantageous" (có lợi/thuận lợi) chuẩn C1.',
  },
  {
    pattern: /\bbad\b/i,
    revisedText: 'detrimental',
    type: 'enhancement',
    explanation: 'Nâng cấp tính từ "bad" thành "detrimental" (bất lợi/gây hại) chuẩn C1.',
  },
];

/**
 * Sinh mảng diffSegments cho Fallback Mock Engine:
 * Luôn bảo toàn tính toàn vẹn 100%: reconstructOriginalText(segments) === essay
 */
export function buildFallbackDiffSegments(essay: string): DiffSegment[] {
  if (!essay) {
    return [{ type: 'unchanged', originalText: '' }];
  }

  interface MatchItem {
    start: number;
    end: number;
    revisedText: string;
    type: DiffSegmentType;
    explanation: string;
  }

  const matches: MatchItem[] = [];

  for (const item of FALLBACK_UPGRADES) {
    const regex = new RegExp(item.pattern.source, 'gi');
    let m: RegExpExecArray | null;
    while ((m = regex.exec(essay)) !== null) {
      matches.push({
        start: m.index,
        end: m.index + m[0].length,
        revisedText: item.revisedText,
        type: item.type,
        explanation: item.explanation,
      });
    }
  }

  // Sắp xếp các đoạn khớp theo vị trí xuất hiện trong bài
  matches.sort((a, b) => a.start - b.start);

  // Lọc các đoạn trùng lặp hoặc lồng nhau
  const cleanMatches: MatchItem[] = [];
  let currentEnd = 0;
  for (const match of matches) {
    if (match.start >= currentEnd) {
      cleanMatches.push(match);
      currentEnd = match.end;
    }
  }

  // Nếu không khớp từ điển mẫu nào, tìm từ đơn dài >= 6 ký tự để làm mẫu nâng cấp
  if (cleanMatches.length === 0 && essay.trim().length > 0) {
    const wordRegex = /\b[a-zA-Z]{6,}\b/g;
    const fallbackMatch = wordRegex.exec(essay);
    if (fallbackMatch) {
      cleanMatches.push({
        start: fallbackMatch.index,
        end: fallbackMatch.index + fallbackMatch[0].length,
        revisedText: fallbackMatch[0],
        type: 'enhancement',
        explanation: `Đề xuất duy trì hoặc mở rộng cấu trúc câu với từ khóa "${fallbackMatch[0]}".`,
      });
    }
  }

  // Nếu vẫn không có match nào, toàn bộ bài là unchanged
  if (cleanMatches.length === 0) {
    return [{ type: 'unchanged', originalText: essay }];
  }

  // Chia tách essay thành các segment liên tục bảo toàn nguyên vẹn văn bản
  const segments: DiffSegment[] = [];
  let lastIndex = 0;

  for (const match of cleanMatches) {
    if (match.start > lastIndex) {
      segments.push({
        type: 'unchanged',
        originalText: essay.slice(lastIndex, match.start),
      });
    }

    segments.push({
      type: match.type,
      originalText: essay.slice(match.start, match.end),
      revisedText: match.revisedText,
      explanation: match.explanation,
      reasonVi: match.explanation,
    });

    lastIndex = match.end;
  }

  if (lastIndex < essay.length) {
    segments.push({
      type: 'unchanged',
      originalText: essay.slice(lastIndex),
    });
  }

  return segments;
}

/**
 * Sinh bộ dữ liệu giả lập (Realistic Mock Data) đạt chuẩn CEFR & IELTS
 */
export function generateFallbackGrading(essay: string, _topic?: string): EssayGradingResult {
  const clean = essay || '';
  const wordCount = clean.trim() ? clean.trim().split(/\s+/).filter(Boolean).length : 0;
  const diffSegments = buildFallbackDiffSegments(clean);
  const fullRevisedEssay = reconstructRevisedText(diffSegments);

  const criteria: EssayCriteriaBreakdown = {
    taskAchievement: {
      score: 75,
      cefrLevel: 'B2',
      feedback: 'Bài viết phản hồi đúng và đầy đủ các khía cạnh của đề bài, lập luận có căn cứ và có ví dụ minh họa tương đối thuyết phục.',
    },
    coherenceCohesion: {
      score: 80,
      cefrLevel: 'B2',
      feedback: 'Tổ chức các đoạn văn chặt chẽ, các liên từ chuyển tiếp (Furthermore, Consequently, In addition) được sử dụng linh hoạt và tự nhiên.',
    },
    lexicalResource: {
      score: 76,
      cefrLevel: 'B2',
      feedback: 'Vốn từ vựng tương đối phong phú, diễn đạt được các ý niệm trừu tượng. Đề xuất tăng cường thêm các collocations học thuật band C1.',
    },
    grammaticalAccuracy: {
      score: 81,
      cefrLevel: 'B2',
      feedback: 'Kiểm soát tốt các thì cơ bản và cấu trúc câu phức. Chú ý một số điểm nhỏ về mạo từ và sự hòa hợp chủ vị ở câu dài.',
    },
  };

  const { overallScore, overallCEFR } = calculateOverallScore(criteria);

  return {
    overallScore,
    overallCEFR,
    wordCount,
    criteria,
    strengths: [
      'Bố cục bài viết 4 đoạn chuẩn mực (Mở bài, 2 Thân bài, Kết bài).',
      'Luận điểm mạch lạc, sử dụng liên từ chuyển đoạn linh hoạt và tự nhiên.',
      'Khả năng truyền tải thông điệp rõ ràng, đúng trọng tâm chủ đề.',
    ],
    improvements: [
      'Nâng cấp các tính từ và trạng từ thông dụng lên trình độ C1/C2 để tăng tính học thuật.',
      'Đa dạng hóa các cấu trúc ngữ pháp nâng cao như đảo ngữ (Inversion) hoặc mệnh đề quan hệ rút gọn.',
      'Bổ sung thêm số liệu hoặc ví dụ thực tiễn cụ thể để tăng độ thuyết phục cho luận cứ.',
    ],
    diffSegments,
    fullRevisedEssay,
    isFallback: true,
  };
}

/**
 * Service chấm bài luận tiếng Anh tự động bằng Gemini 1.5 Flash
 * Tuân thủ tuyệt đối chính sách Zero-Crash:
 * - Không throw unhandled error ra component.
 * - Khi thiếu API Key, gặp lỗi mạng, HTTP 429: tự động trả về bộ dữ liệu fallback hoàn chỉnh kèm cờ isFallback: true.
 */
export async function gradeEssay(options: GradeEssayOptions): Promise<EssayGradingResult> {
  const { essay, topic = 'General Academic Topic', targetLevel = 'B2', apiKey } = options;
  const trimmedKey = apiKey?.trim();

  // 1. Kiểm tra API Key: nếu không có hoặc quá ngắn -> dùng Fallback Mock ngay
  if (!trimmedKey || trimmedKey.length < 10) {
    console.warn('[EssayGradingService] No valid Gemini API Key configured, using intelligent mock engine fallback.');
    return generateFallbackGrading(essay, topic);
  }

  try {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${encodeURIComponent(trimmedKey)}`;

    const systemPrompt = `
You are an expert Cambridge/IELTS Senior Essay Examiner and Writing Assessment AI.
Evaluate the following English essay strictly according to the 4 CEFR & IELTS criteria:
1. Task Achievement / Response
2. Coherence & Cohesion
3. Lexical Resource
4. Grammatical Range & Accuracy

Target Level: ${targetLevel}
Topic: "${topic}"

CRITICAL INSTRUCTIONS:
1. You must respond strictly with a valid JSON object without any Markdown formatting or backticks (\`\`\`json).
2. The JSON object must match this schema:
{
  "criteria": {
    "taskAchievement": {
      "score": number (0-100),
      "cefrLevel": "A1" | "A2" | "B1" | "B2" | "C1" | "C2",
      "feedback": "Detailed feedback in Vietnamese"
    },
    "coherenceCohesion": {
      "score": number (0-100),
      "cefrLevel": "A1" | "A2" | "B1" | "B2" | "C1" | "C2",
      "feedback": "Detailed feedback in Vietnamese"
    },
    "lexicalResource": {
      "score": number (0-100),
      "cefrLevel": "A1" | "A2" | "B1" | "B2" | "C1" | "C2",
      "feedback": "Detailed feedback in Vietnamese"
    },
    "grammaticalAccuracy": {
      "score": number (0-100),
      "cefrLevel": "A1" | "A2" | "B1" | "B2" | "C1" | "C2",
      "feedback": "Detailed feedback in Vietnamese"
    }
  },
  "strengths": ["string in Vietnamese", "string in Vietnamese", "string in Vietnamese"],
  "improvements": ["string in Vietnamese", "string in Vietnamese", "string in Vietnamese"],
  "diffSegments": [
    {
      "type": "unchanged" | "correction" | "enhancement",
      "originalText": "exact text portion from the student essay",
      "revisedText": "improved or corrected version (only if type != unchanged)",
      "explanation": "concise explanation in Vietnamese of the grammar rule or lexical enhancement"
    }
  ],
  "fullRevisedEssay": "Complete polished essay at C1/C2 band"
}

IMPORTANT FOR DIFF SEGMENTS:
- The concatenation of all 'originalText' fields in 'diffSegments' MUST PRECISELY equal the original essay (including every space, punctuation, and newline).
- 'unchanged' for good parts, 'correction' for grammatical/spelling errors, 'enhancement' for upgrading basic vocabulary/phrasing to academic C1/C2.
`;

    const body = {
      contents: [
        {
          role: 'user',
          parts: [{ text: `${systemPrompt}\n\nStudent Essay to Grade:\n"""\n${essay}\n"""` }],
        },
      ],
      generationConfig: {
        temperature: 0.3,
        topP: 0.9,
        maxOutputTokens: 2048,
      },
    };

    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      const data = await res.json();
      const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
      const cleaned = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleaned);

      if (parsed.criteria && Array.isArray(parsed.diffSegments)) {
        const { overallScore, overallCEFR } = calculateOverallScore(parsed.criteria);
        const wordCount = essay.trim() ? essay.trim().split(/\s+/).filter(Boolean).length : 0;

        let finalSegments: DiffSegment[] = parsed.diffSegments;
        if (reconstructOriginalText(finalSegments) !== essay) {
          finalSegments = buildFallbackDiffSegments(essay);
        } else {
          finalSegments = finalSegments.map((s: DiffSegment) => ({
            type: s.type,
            originalText: s.originalText,
            revisedText: s.revisedText,
            explanation: s.explanation || s.reasonVi,
            reasonVi: s.reasonVi || s.explanation,
          }));
        }

        const fullRevisedEssay = parsed.fullRevisedEssay || reconstructRevisedText(finalSegments);

        return {
          overallScore,
          overallCEFR,
          wordCount,
          criteria: parsed.criteria,
          strengths: Array.isArray(parsed.strengths) && parsed.strengths.length > 0
            ? parsed.strengths
            : ['Bố cục bài viết rõ ràng, đúng trọng tâm đề bài.'],
          improvements: Array.isArray(parsed.improvements) && parsed.improvements.length > 0
            ? parsed.improvements
            : ['Đề xuất nâng cấp từ vựng học thuật C1.'],
          diffSegments: finalSegments,
          fullRevisedEssay,
          isFallback: false,
        };
      }

      console.warn('[EssayGradingService] Gemini API returned JSON missing criteria or diffSegments, using mock fallback.');
    } else {
      console.warn(`[EssayGradingService] Gemini API call returned HTTP ${res.status}: ${res.statusText}, using mock fallback.`);
    }
  } catch (err) {
    console.warn('[EssayGradingService] Gemini API call encountered exception, using intelligent mock fallback:', err);
  }

  // Trả về fallback an toàn khi gặp bất kỳ lỗi nào
  return generateFallbackGrading(essay, topic);
}
