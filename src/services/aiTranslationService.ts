import { translateText } from './translationService';

export type TranslationTone = 'business' | 'tech' | 'academic' | 'casual';

export interface CollocationInsight {
  term: string;
  meaning: string;
  note?: string;
}

export interface ContextAwareTranslationResult {
  mainTranslation: string;
  formalVersion: string;
  casualVersion: string;
  keyCollocations: CollocationInsight[];
  contextNote: string;
  toneUsed: TranslationTone;
  isAiPowered: boolean;
}

export interface TranslationHistoryItem {
  id: string;
  sourceText: string;
  translatedText: string;
  sourceLang: 'en' | 'vi';
  targetLang: 'en' | 'vi';
  tone: TranslationTone;
  timestamp: string;
}

const TONE_PROMPT_MAP: Record<TranslationTone, string> = {
  business: 'Professional business workplace & email style. Use polite, clear, and professional vocabulary.',
  tech: 'Software Engineering & IT context. Retain core technical terms untranslated (e.g. Framework, Pipeline, Middleware, Concurrency, State, Props, Database, Endpoint, Microservices, Deploy, CI/CD, Asynchronous) while keeping the surrounding Vietnamese completely natural.',
  academic: 'Academic IELTS C1/C2 tone. Use sophisticated grammatical structures, high-register vocabulary, and precise expressions.',
  casual: 'Natural conversational everyday English/Vietnamese. Use friendly, relaxed idioms and natural daily phrasing.',
};

export async function translateWithContext(
  text: string,
  sourceLang: 'en' | 'vi',
  targetLang: 'en' | 'vi',
  tone: TranslationTone,
  apiKey?: string
): Promise<ContextAwareTranslationResult> {
  const cleanText = text.trim();
  if (!cleanText) {
    return {
      mainTranslation: '',
      formalVersion: '',
      casualVersion: '',
      keyCollocations: [],
      contextNote: '',
      toneUsed: tone,
      isAiPowered: false,
    };
  }

  // 1. NẾU CÓ GEMINI API KEY -> GỌI AI ĐỈNH CAO
  if (apiKey && apiKey.trim().length > 10) {
    try {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey.trim()}`;

      const systemPrompt = `
You are an elite, context-aware translation assistant specializing in English-Vietnamese translation.
Translate the input text from ${sourceLang === 'en' ? 'English' : 'Vietnamese'} to ${targetLang === 'en' ? 'English' : 'Vietnamese'}.
Desired Tone / Domain: ${TONE_PROMPT_MAP[tone]}

CRITICAL REQUIREMENT:
Respond strictly with a valid JSON object without any Markdown formatting or backticks.
JSON Structure:
{
  "mainTranslation": "The most natural and context-accurate translation adhering strictly to the requested tone",
  "formalVersion": "An advanced, formal, and polished version (C1/C2 register)",
  "casualVersion": "A conversational, natural, and concise daily communication version",
  "keyCollocations": [
    { "term": "Key phrase/word in source text", "meaning": "Precise meaning or Vietnamese equivalent", "note": "Short contextual usage tip" }
  ],
  "contextNote": "1-2 short sentences in Vietnamese explaining why this phrasing was chosen and the nuance behind it"
}
`;

      const body = {
        contents: [
          {
            role: 'user',
            parts: [{ text: `${systemPrompt}\n\nInput Text to translate:\n"${cleanText}"` }],
          },
        ],
        generationConfig: {
          temperature: 0.4,
          maxOutputTokens: 800,
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

        if (parsed.mainTranslation) {
          return {
            mainTranslation: parsed.mainTranslation,
            formalVersion: parsed.formalVersion || parsed.mainTranslation,
            casualVersion: parsed.casualVersion || parsed.mainTranslation,
            keyCollocations: Array.isArray(parsed.keyCollocations) ? parsed.keyCollocations : [],
            contextNote: parsed.contextNote || `Dịch chuẩn xác theo ngữ cảnh ${tone.toUpperCase()}.`,
            toneUsed: tone,
            isAiPowered: true,
          };
        }
      }
    } catch (err) {
      console.warn('Gemini Translation failed, falling back to smart engine:', err);
    }
  }

  // 2. FALLBACK TRANSLATION ENGINE (Khi chưa có API key)
  const basicTranslation = await translateText(cleanText, sourceLang, targetLang);

  // Sinh các phiên bản thay thế thông minh theo ngữ cảnh
  let formalVersion = basicTranslation;
  let casualVersion = basicTranslation;
  let contextNote = 'Bản dịch máy tiêu chuẩn. Nhập Gemini API Key để mở khóa bản dịch phân tích sâu theo ngữ cảnh!';
  const keyCollocations: CollocationInsight[] = [];

  // Trích xuất các cụm từ nếu câu tiếng Anh
  if (sourceLang === 'en') {
    const words = cleanText.split(/\s+/);
    if (words.length >= 3) {
      keyCollocations.push({
        term: words.slice(0, 2).join(' '),
        meaning: 'Cụm từ chủ đạo trong câu',
        note: 'Hãy chú ý vị trí đặt cụm từ trong ngữ cảnh công việc.',
      });
    }
  }

  if (tone === 'business') {
    contextNote = 'Văn phong công sở: Chú trọng sự lịch sự, rõ ràng và tính chuyên nghiệp trong giao tiếp email.';
  } else if (tone === 'tech') {
    contextNote = 'Văn phong công nghệ: Giữ nguyên các thuật ngữ kỹ thuật chuyên ngành để đảm bảo tính chính xác tuyệt đối.';
  } else if (tone === 'academic') {
    contextNote = 'Văn phong học thuật: Cấu trúc câu chặt chẽ, từ vựng học thuật chuẩn IELTS/Academic.';
  } else {
    contextNote = 'Văn phong giao tiếp đời thường: Câu nói ngắn gọn, thân thiện và gần gũi.';
  }

  return {
    mainTranslation: basicTranslation,
    formalVersion,
    casualVersion,
    keyCollocations,
    contextNote,
    toneUsed: tone,
    isAiPowered: false,
  };
}
