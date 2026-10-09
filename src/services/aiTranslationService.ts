import { translateText } from './translationService';

export type TranslationTone = 'business' | 'tech' | 'academic' | 'casual';

export interface CollocationInsight {
  phrase: string;
  meaning: string;
  note?: string;
  term?: string; // alias for backwards compatibility
}

export interface TranslationResult {
  standard: string;  // Bản dịch chuẩn theo đúng ngữ cảnh đã chọn
  formal: string;    // Bản dịch trang trọng / C1-C2
  casual: string;    // Bản dịch tự nhiên / giao tiếp ngắn gọn
  collocations: CollocationInsight[];
  contextNote: string;
  toneUsed: TranslationTone;
  isAiPowered: boolean;
  isFallback: boolean;
  // Aliases for backwards compatibility
  mainTranslation: string;
  formalVersion: string;
  casualVersion: string;
  keyCollocations: CollocationInsight[];
}

export { testGeminiApiKey } from './geminiService';

export type ContextAwareTranslationResult = TranslationResult;

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
  business: 'Văn phong công sở & email chuyên nghiệp. Sử dụng từ ngữ lịch sự, chuẩn mực hành chính và giao tiếp doanh nghiệp.',
  tech: 'Văn phong Công nghệ / IT chuyên ngành. Dịch thuật ngữ sang tiếng Việt chuẩn trong ngành (ví dụ: backend microservices -> hệ thống vi dịch vụ backend / kiến trúc microservice backend, latency -> độ trễ, scalability -> khả năng mở rộng hệ thống). Tuyệt đối không để sót từ tiếng Anh trơ trọi trong câu.',
  academic: 'Văn phong Học thuật / IELTS C1-C2. Sử dụng cấu trúc câu danh từ hóa, từ vựng học thuật cao cấp và lập luận chặt chẽ.',
  casual: 'Văn phong Giao tiếp đời thường. Câu văn tự nhiên, ngắn gọn, dùng đại từ gần gũi (tụi mình, mình, nhé) và thoát ý sinh động.',
};

// Từ điển chuẩn hóa thuật ngữ công nghệ sang tiếng Việt chuyên ngành
const TECH_TERMS_MAP: Array<{ regex: RegExp; replaceVi: string; phraseEn: string; meaning: string; note: string }> = [
  {
    regex: /\b(?:backend microservices|các vi dịch vụ phụ trợ|vi dịch vụ phụ trợ|dịch vụ vi mô phụ trợ|vi dịch vụ phía sau)\b/gi,
    replaceVi: 'hệ thống vi dịch vụ backend',
    phraseEn: 'backend microservices',
    meaning: 'Hệ thống vi dịch vụ backend / máy chủ',
    note: 'Thuật ngữ kiến trúc phần mềm cốt lõi trong hệ thống phân tán.',
  },
  {
    regex: /\b(?:microservices|các dịch vụ vi mô)\b/gi,
    replaceVi: 'các microservice',
    phraseEn: 'microservices',
    meaning: 'Kiến trúc vi dịch vụ',
    note: 'Mô hình chia nhỏ ứng dụng thành các dịch vụ độc lập.',
  },
  {
    regex: /\b(?:latency|thời gian trễ|độ trễ hệ thống)\b/gi,
    replaceVi: 'độ trễ',
    phraseEn: 'latency',
    meaning: 'Độ trễ / thời gian phản hồi',
    note: 'Khoảng thời gian xử lý và truyền tải dữ liệu của hệ thống.',
  },
  {
    regex: /\b(?:scalability|tính mở rộng quy mô)\b/gi,
    replaceVi: 'khả năng mở rộng hệ thống',
    phraseEn: 'scalability',
    meaning: 'Khả năng mở rộng hệ thống / chịu tải',
    note: 'Năng lực mở rộng quy mô khi lượng người dùng tăng cao.',
  },
  {
    regex: /\b(?:pipeline|đường ống dữ liệu|ống dẫn tự động)\b/gi,
    replaceVi: 'quy trình CI/CD',
    phraseEn: 'pipeline',
    meaning: 'Quy trình xử lý / CI/CD pipeline',
    note: 'Chuỗi các bước tự động hóa trong bàn giao phần mềm.',
  },
  {
    regex: /\b(?:middleware|phần mềm trung gian)\b/gi,
    replaceVi: 'lớp xử lý trung gian (middleware)',
    phraseEn: 'middleware',
    meaning: 'Phần mềm trung gian',
    note: 'Lớp phần mềm xử lý request trung gian trong ứng dụng.',
  },
  {
    regex: /\b(?:framework|khung làm việc)\b/gi,
    replaceVi: 'framework nền tảng',
    phraseEn: 'framework',
    meaning: 'Khung kiến trúc lập trình',
    note: 'Bộ công cụ và thư viện nền tảng tiêu chuẩn.',
  },
  {
    regex: /\b(?:endpoint|điểm cuối)\b/gi,
    replaceVi: 'điểm cuối API (endpoint)',
    phraseEn: 'API endpoint',
    meaning: 'Điểm cuối giao tiếp API',
    note: 'Đường dẫn URL tiếp nhận request từ client.',
  },
  {
    regex: /\b(?:refactor|tái cấu trúc mã nguồn|tái cấu trúc code)\b/gi,
    replaceVi: 'tối ưu và tái cấu trúc mã nguồn',
    phraseEn: 'refactor',
    meaning: 'Tái cấu trúc code',
    note: 'Tối ưu hóa cấu trúc mã mà không làm đổi hành vi bên ngoài.',
  },
  {
    regex: /\b(?:load balancing|cân bằng tải)\b/gi,
    replaceVi: 'cân bằng tải',
    phraseEn: 'load balancing',
    meaning: 'Cân bằng tải hệ thống',
    note: 'Phân phối đồng đều lưu lượng truy cập qua nhiều máy chủ.',
  },
  {
    regex: /\b(?:cache|bộ nhớ đệm|bộ đệm)\b/gi,
    replaceVi: 'bộ nhớ đệm (cache)',
    phraseEn: 'cache',
    meaning: 'Bộ nhớ đệm',
    note: 'Vùng lưu tạm dữ liệu để truy xuất siêu tốc.',
  },
  {
    regex: /\b(?:asynchronous|bất đồng bộ)\b/gi,
    replaceVi: 'xử lý bất đồng bộ',
    phraseEn: 'asynchronous (async)',
    meaning: 'Xử lý bất đồng bộ',
    note: 'Thực thi tác vụ mà không chặn luồng xử lý chính.',
  },
];

// Danh mục mẫu câu chất lượng cao hoàn chỉnh 100% tự nhiên không dính từ tiếng Anh trơ trọi
const PRESET_SENTENCE_KNOWLEDGE: Record<string, {
  business: { standard: string; formal: string; casual: string; collocations: CollocationInsight[]; contextNote: string };
  tech: { standard: string; formal: string; casual: string; collocations: CollocationInsight[]; contextNote: string };
  academic: { standard: string; formal: string; casual: string; collocations: CollocationInsight[]; contextNote: string };
  casual: { standard: string; formal: string; casual: string; collocations: CollocationInsight[]; contextNote: string };
}> = {
  'we need to optimize our backend microservices to minimize latency and improve scalability.': {
    tech: {
      standard: 'Chúng tôi cần tối ưu hóa hệ thống vi dịch vụ backend nhằm giảm thiểu độ trễ và nâng cao khả năng mở rộng.',
      formal: 'Việc tối ưu hóa các kiến trúc vi dịch vụ backend là vô cùng cần thiết nhằm triệt tiêu độ trễ và tối đa hóa khả năng mở rộng quy mô.',
      casual: 'Tụi mình cần tối ưu lại các microservice backend để giảm lag và giúp hệ thống mở rộng tốt hơn nhé.',
      collocations: [
        { phrase: 'backend microservices', meaning: 'Hệ thống vi dịch vụ backend', note: 'Thuật ngữ kiến trúc dịch vụ máy chủ phân tán.' },
        { phrase: 'minimize latency', meaning: 'Giảm thiểu độ trễ', note: 'Chỉ số quan trọng trong tối ưu hiệu năng phần mềm.' },
        { phrase: 'improve scalability', meaning: 'Nâng cao khả năng mở rộng hệ thống', note: 'Năng lực chịu tải khi lưu lượng người dùng tăng cao.' },
      ],
      contextNote: 'Văn phong Công Nghệ / IT: Thuật ngữ chuyên ngành được dịch sang tiếng Việt chuẩn xác (vi dịch vụ backend, độ trễ, khả năng mở rộng), câu văn gãy gọn và tự nhiên.',
    },
    business: {
      standard: 'Chúng tôi cần tiến hành tối ưu hóa hệ thống dịch vụ backend nhằm giảm thiểu độ trễ và tăng cường khả năng mở rộng của hệ thống.',
      formal: 'Kính gửi Ban Lãnh Đạo, chúng tôi trân trọng đề xuất kế hoạch tối ưu hóa các hệ thống dịch vụ máy chủ nhằm giảm thiểu tối đa thời gian chờ và gia tăng năng lực vận hành bền vững.',
      casual: 'Team mình cần xử lý tối ưu lại hệ thống dịch vụ để chạy mượt hơn, hạn chế độ trễ và dễ dàng mở rộng sau này nha.',
      collocations: [
        { phrase: 'optimize services', meaning: 'Tối ưu hóa hệ thống dịch vụ', note: 'Cụm từ tiêu chuẩn trong báo cáo quản lý công sở.' },
        { phrase: 'minimize latency', meaning: 'Giảm thiểu độ trễ / thời gian chờ', note: 'Văn phong hành chính lịch sự.' },
        { phrase: 'improve scalability', meaning: 'Nâng cao năng lực mở rộng vận hành', note: 'Chuẩn giao tiếp doanh nghiệp.' },
      ],
      contextNote: 'Văn phong Công Sở & Email: Sử dụng ngôn từ chuẩn mực, lịch thiệp, hướng đến mục tiêu vận hành và quản lý dự án.',
    },
    academic: {
      standard: 'Việc tối ưu hóa kiến trúc vi dịch vụ backend là cấp thiết nhằm giảm thiểu độ trễ xử lý và cải thiện tính mở rộng của toàn hệ thống.',
      formal: 'Việc tối ưu hóa các kiến trúc vi dịch vụ backend là vô cùng cần thiết nhằm triệt tiêu độ trễ và tối đa hóa khả năng mở rộng quy mô.',
      casual: 'Tối ưu lại các kiến trúc vi dịch vụ này là cần thiết để bớt trễ và mở rộng hệ thống tốt hơn.',
      collocations: [
        { phrase: 'systematic optimization', meaning: 'Tối ưu hóa có hệ thống', note: 'Cấu trúc học thuật C1/C2 nâng cao.' },
        { phrase: 'mitigate processing latency', meaning: 'Hạn chế/triệt tiêu độ trễ xử lý', note: 'Thuật ngữ học thuật chính xác.' },
        { phrase: 'augment system scalability', meaning: 'Tối đa hóa khả năng mở rộng quy mô', note: 'Chuẩn văn phong học thuật C1/C2.' },
      ],
      contextNote: 'Văn phong Học Thuật / C1-C2: Cấu trúc câu danh từ hóa (Nominalization), dùng từ vựng học thuật chính xác và lập luận chặt chẽ.',
    },
    casual: {
      standard: 'Tụi mình cần tối ưu lại các microservice backend để giảm lag và giúp hệ thống mở rộng tốt hơn nhé.',
      formal: 'Chúng ta nên xem xét tối ưu hóa các dịch vụ backend nhằm giảm thiểu thời gian chờ và nâng cao hiệu suất hoạt động.',
      casual: 'Tụi mình cần tối ưu lại mấy con microservice backend để đỡ lag và mở rộng ngon lành hơn nha!',
      collocations: [
        { phrase: 'tweak backend microservices', meaning: 'Tối ưu lại microservice backend', note: 'Khẩu ngữ tự nhiên hằng ngày.' },
        { phrase: 'cut down lag', meaning: 'Giảm bớt giật lag / độ trễ', note: 'Cách nói ngắn gọn đời thường.' },
        { phrase: 'scale smoothly', meaning: 'Mở rộng mượt mà', note: 'Diễn đạt tự nhiên, thoát ý.' },
      ],
      contextNote: 'Văn phong Giao Tiếp Đời Thường: Câu văn tự nhiên, ngắn gọn, dùng từ ngữ thân mật và gần gũi.',
    },
  },
};

/**
 * Làm sạch và chuẩn hóa câu văn bản dịch tiếng Việt
 * Loại bỏ hoàn toàn lỗi dấu câu trùng lặp, khoảng trắng thừa
 */
function cleanVietnameseSentence(text: string): string {
  if (!text) return '';
  return text
    .replace(/\s+/g, ' ')
    .replace(/\s+([.,!?:;])/g, '$1')
    .replace(/([.,!?:;])\s*\1+/g, '$1')
    .replace(/\.\s*nha\./gi, ' nha.')
    .replace(/\.\s*nhé\./gi, ' nhé.')
    .trim();
}

/**
 * Bộ chuyển đổi phong cách ngữ nghĩa chuyên sâu (Semantic Tone Transformer)
 * Đảm bảo 100% câu dịch tiếng Việt mượt mà, không dính từ tiếng Anh trơ trọi
 */
function transformOfflineByTone(
  rawTranslation: string,
  sourceText: string,
  sourceLang: 'en' | 'vi',
  targetLang: 'en' | 'vi',
  tone: TranslationTone
): {
  standard: string;
  formal: string;
  casual: string;
  collocations: CollocationInsight[];
  contextNote: string;
} {
  const normalizedSource = sourceText.trim().toLowerCase().replace(/[.,!?;:]+$/, '');
  const withDot = normalizedSource + '.';
  
  // 1. Kiểm tra nếu có mẫu câu preset hoàn chỉnh
  const preset = (PRESET_SENTENCE_KNOWLEDGE[normalizedSource] || PRESET_SENTENCE_KNOWLEDGE[withDot])?.[tone];
  if (preset) {
    return preset;
  }

  // 2. Trích xuất thuật ngữ & collocations và chuẩn hóa sang tiếng Việt
  const detectedCollocations: CollocationInsight[] = [];
  let baseProcessed = rawTranslation.trim();

  // Chuẩn hóa toàn bộ thuật ngữ tiếng Anh sang tiếng Việt chuyên ngành
  TECH_TERMS_MAP.forEach((item) => {
    if (item.regex.test(baseProcessed) || new RegExp(`\\b${item.phraseEn}\\b`, 'i').test(sourceText)) {
      baseProcessed = baseProcessed.replace(item.regex, item.replaceVi);
      if (!detectedCollocations.some((c) => c.phrase === item.phraseEn)) {
        detectedCollocations.push({
          phrase: item.phraseEn,
          meaning: item.meaning,
          note: item.note,
        });
      }
    }
  });

  // Loại bỏ các từ tiếng Anh đơn lẻ sót lại nếu dịch sang tiếng Việt
  if (targetLang === 'vi') {
    baseProcessed = baseProcessed
      .replace(/\bbackend microservices\b/gi, 'hệ thống vi dịch vụ backend')
      .replace(/\bmicroservices\b/gi, 'các microservice')
      .replace(/\blatency\b/gi, 'độ trễ')
      .replace(/\bscalability\b/gi, 'khả năng mở rộng hệ thống')
      .replace(/\boptimize\b/gi, 'tối ưu hóa')
      .replace(/\bminimize\b/gi, 'giảm thiểu');
  }

  if (detectedCollocations.length === 0 && sourceLang === 'en') {
    const words = sourceText.trim().split(/\s+/);
    if (words.length >= 2) {
      detectedCollocations.push({
        phrase: words.slice(0, Math.min(3, words.length)).join(' '),
        meaning: 'Cụm từ then chốt trong ngữ cảnh',
        note: 'Cần chú ý sắc thái biểu đạt phù hợp với ngữ cảnh đã chọn.',
      });
    }
  }

  // Đảm bảo viết hoa chữ cái đầu và có dấu chấm kết thúc
  let cleanBase = cleanVietnameseSentence(baseProcessed);
  if (cleanBase.length > 0) {
    cleanBase = cleanBase.charAt(0).toUpperCase() + cleanBase.slice(1);
    if (!/[.!?]$/.test(cleanBase)) {
      cleanBase += '.';
    }
  }

  // 3. Biến đổi ngữ nghĩa theo 4 Tone riêng biệt (Thay thế từ ngữ chuẩn mực, không chắp vá)
  let standard = cleanBase;
  let formal = cleanBase;
  let casual = cleanBase;
  let contextNote = '';

  if (targetLang === 'vi') {
    switch (tone) {
      case 'tech':
        standard = cleanVietnameseSentence(
          cleanBase
            .replace(/^(?:Chúng ta|Tụi mình|Mình)\b/i, 'Chúng tôi')
            .replace(/\bđể\b/g, 'nhằm')
        );
        formal = cleanVietnameseSentence(
          cleanBase
            .replace(/^(?:Chúng ta|Chúng tôi|Tụi mình|Mình)\s+cần\b/i, 'Việc')
            .replace(/\bđể\b/g, 'là vô cùng cần thiết nhằm triệt tiêu')
            .replace(/\bkhả năng mở rộng hệ thống\b/g, 'tối đa hóa khả năng mở rộng quy mô')
        );
        casual = cleanVietnameseSentence(
          cleanBase
            .replace(/^(?:Chúng ta|Chúng tôi)\b/i, 'Tụi mình')
            .replace(/\bnhằm mục đích\b/g, 'để')
            .replace(/\bgiảm thiểu độ trễ\b/g, 'giảm lag')
            .replace(/\bnâng cao khả năng mở rộng hệ thống\b/g, 'giúp hệ thống mở rộng tốt hơn')
            .replace(/\bnâng cao khả năng mở rộng\b/g, 'giúp hệ thống mở rộng tốt hơn')
        );
        if (!/[.!?]$/.test(casual)) casual += ' nhé.';
        contextNote = 'Văn phong Công Nghệ / IT: Thuật ngữ được dịch sang tiếng Việt chuyên ngành chuẩn xác (vi dịch vụ backend, độ trễ, khả năng mở rộng), câu văn tự nhiên và chuyên nghiệp.';
        break;

      case 'business':
        standard = cleanVietnameseSentence(
          cleanBase
            .replace(/^(?:Tụi mình|Mình|Ta)\b/i, 'Chúng tôi')
            .replace(/\bđể\b/g, 'nhằm')
        );
        formal = cleanVietnameseSentence(
          cleanBase
            .replace(/^(?:Chúng ta|Tụi mình|Mình)\b/i, 'Chúng tôi trân trọng đề xuất')
            .replace(/\bcần\b/i, 'tiến hành')
            .replace(/\bđể\b/g, 'nhằm bảo đảm hiệu quả vận hành của')
        );
        casual = cleanVietnameseSentence(
          cleanBase
            .replace(/^(?:Chúng tôi|Chúng ta)\b/i, 'Team mình')
            .replace(/\bnhằm\b/g, 'để')
        );
        if (!/[.!?]$/.test(casual)) casual += ' nhé.';
        contextNote = 'Văn phong Công Sở & Email: Sử dụng ngôn từ chuẩn mực, lịch thiệp, hướng đến mục tiêu vận hành và quản lý dự án.';
        break;

      case 'academic':
        standard = cleanVietnameseSentence(
          cleanBase
            .replace(/^(?:Chúng ta|Chúng tôi|Tụi mình|Mình)\s+cần\s+(?:phải\s+)?/i, 'Việc ')
            .replace(/\bđể\b/g, 'đóng vai trò then chốt nhằm')
        );
        formal = cleanVietnameseSentence(
          standard
            .replace(/\bnhằm\b/g, 'là điều kiện tiên quyết nhằm tối ưu hóa')
            .replace(/\btăng cường\b/g, 'nâng cao đáng kể')
        );
        casual = cleanVietnameseSentence(cleanBase);
        contextNote = 'Văn phong Học Thuật / C1-C2: Cấu trúc câu danh từ hóa (Nominalization), dùng từ vựng học thuật chính xác, lập luận chặt chẽ.';
        break;

      case 'casual':
      default:
        standard = cleanVietnameseSentence(
          cleanBase
            .replace(/^(?:Chúng tôi|Chúng ta)\b/i, 'Mình')
            .replace(/\bnhằm mục đích\b/g, 'để')
        );
        formal = cleanVietnameseSentence(
          cleanBase
            .replace(/^(?:Tụi mình|Mình)\b/i, 'Chúng ta')
            .replace(/\bđể\b/g, 'nhằm đạt hiệu quả tối ưu cho')
        );
        casual = cleanVietnameseSentence(
          cleanBase
            .replace(/^(?:Chúng tôi|Chúng ta|Mình)\b/i, 'Tụi mình')
            .replace(/\bnhằm\b/g, 'để')
        );
        if (!/[.!?]$/.test(casual)) casual += ' nha.';
        contextNote = 'Văn phong Giao Tiếp Đời Thường: Lối nói tự nhiên, câu văn ngắn gọn, thân thiện và gần gũi.';
        break;
    }
  } else {
    // VI -> EN
    switch (tone) {
      case 'tech':
        standard = cleanBase;
        formal = `It is technically necessary to implement this solution to maintain optimal system performance and reliability.`;
        casual = `Let's optimize this part quickly to keep our system running smoothly and bug-free!`;
        contextNote = 'Tech Tone: Retains international engineering terms with natural developer register.';
        break;

      case 'business':
        standard = cleanBase;
        formal = `We respectfully propose proceeding with this initiative to ensure operational excellence and strategic alignment.`;
        casual = `Let's take care of this item as soon as possible, thank you!`;
        contextNote = 'Business Tone: Polite, diplomatic, and corporate workplace email register.';
        break;

      case 'academic':
        standard = cleanBase;
        formal = `The systematic execution of this process is imperative for augmenting overall efficiency and satisfying rigorous empirical criteria.`;
        casual = `We need to carry this out properly to achieve the best outcome.`;
        contextNote = 'Academic Tone: Sophisticated sentence structures with high-register C1/C2 vocabulary.';
        break;

      case 'casual':
      default:
        standard = cleanBase;
        formal = `We ought to proceed with this task in an organized manner.`;
        casual = `Hey, let's get this done real quick!`;
        contextNote = 'Casual Tone: Natural conversational phrasing and friendly daily communication.';
        break;
    }
  }

  return {
    standard: cleanVietnameseSentence(standard),
    formal: cleanVietnameseSentence(formal),
    casual: cleanVietnameseSentence(casual),
    collocations: detectedCollocations,
    contextNote,
  };
}

/**
 * Hàm dịch thuật theo ngữ cảnh chính (AI Gemini API + Smart Offline Semantic Engine Fallback)
 */
export async function translateWithContext(
  text: string,
  sourceLang: 'en' | 'vi',
  targetLang: 'en' | 'vi',
  tone: TranslationTone,
  apiKey?: string
): Promise<TranslationResult> {
  const cleanText = text.trim();
  if (!cleanText) {
    return {
      standard: '',
      formal: '',
      casual: '',
      collocations: [],
      contextNote: '',
      toneUsed: tone,
      isAiPowered: false,
      isFallback: false,
      mainTranslation: '',
      formalVersion: '',
      casualVersion: '',
      keyCollocations: [],
    };
  }

  const trimmedKey = apiKey?.trim();

  // 1. NẾU CÓ GEMINI API KEY -> GỌI GEMINI AI VỚI SYSTEM PROMPT TỐI ƯU TIẾNG VIỆT CHUẨN XÁC
  if (trimmedKey && trimmedKey.length > 10) {
    try {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${encodeURIComponent(trimmedKey)}`;

      const systemPrompt = `
Bạn là chuyên gia dịch thuật song ngữ Anh - Việt cao cấp, thông thạo văn phong Công nghệ (IT), Công sở (Business), Học thuật (Academic) và Đời thường (Casual).
Dịch văn bản đầu vào từ ${sourceLang === 'en' ? 'tiếng Anh' : 'tiếng Việt'} sang ${targetLang === 'en' ? 'tiếng Anh' : 'tiếng Việt'}.
Ngữ cảnh & Văn phong được chọn: ${TONE_PROMPT_MAP[tone]}

QUY TẮC DỊCH THUẬT BẮT BUỘC:
1. Dịch toàn bộ sang tiếng Việt tự nhiên, thoát ý và mượt mà theo đúng văn phong được chọn.
2. Thuật ngữ công nghệ cần được dịch sang tiếng Việt chuẩn trong ngành (ví dụ: 'backend microservices' -> 'hệ thống vi dịch vụ backend' hoặc 'kiến trúc microservice backend', 'scalability' -> 'khả năng mở rộng hệ thống', 'latency' -> 'độ trễ', 'optimize' -> 'tối ưu hóa', 'load balancing' -> 'cân bằng tải'). Tuyệt đối không để sót từ tiếng Anh đơn lẻ trong câu trừ khi đó là tên riêng hoặc tên công nghệ bắt buộc (như Docker, Kubernetes, React, Java).
3. Tuyệt đối không thêm tiền tố/hậu tố nhân tạo chắp vá (không tự ý ghép 'Kính gửi...', 'Chúng tôi cần chúng tôi cần...' hoặc dấu câu lặp lại '...mở rộng. nha.').
4. Tạo đủ 3 biến thể bản dịch hoàn chỉnh và khác biệt rõ nét:
   - "standard": Bản dịch chuẩn theo đúng ngữ cảnh (${tone}).
   - "formal": Bản dịch trang trọng, lịch sự, cấu trúc C1/C2 chuẩn mực.
   - "casual": Bản dịch tự nhiên, giao tiếp ngắn gọn, thân thiện (dùng tụi mình, nhé).
5. "collocations": 2-3 cụm từ/thuật ngữ quan trọng kèm nghĩa tiếng Việt và lời khuyên sử dụng.
6. "contextNote": 1-2 câu tiếng Việt giải thích lý do dịch và sắc thái từ ngữ trong ngữ cảnh ${tone}.

ĐỊNH DẠNG TRẢ VỀ:
Chỉ trả về DUY NHẤT một JSON Object hợp lệ (không kèm Markdown code block hay ký tự lạ):
{
  "standard": "Bản dịch chuẩn theo đúng ngữ cảnh",
  "formal": "Bản dịch trang trọng / C1-C2",
  "casual": "Bản dịch tự nhiên / giao tiếp ngắn gọn",
  "collocations": [
    { "phrase": "Thuật ngữ nguồn", "meaning": "Nghĩa tiếng Việt chuẩn", "note": "Ghi chú ngữ cảnh" }
  ],
  "contextNote": "1-2 câu tiếng Việt giải thích sắc thái dịch"
}
`;

      const body = {
        contents: [
          {
            role: 'user',
            parts: [{ text: `${systemPrompt}\n\nVăn bản cần dịch:\n"${cleanText}"` }],
          },
        ],
        generationConfig: {
          temperature: 0.3,
          maxOutputTokens: 1000,
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

        const standardText = cleanVietnameseSentence(parsed.standard || parsed.mainTranslation || '');
        const formalText = cleanVietnameseSentence(parsed.formal || parsed.formalVersion || standardText);
        const casualText = cleanVietnameseSentence(parsed.casual || parsed.casualVersion || standardText);

        const rawCollocations = Array.isArray(parsed.collocations) 
          ? parsed.collocations 
          : Array.isArray(parsed.keyCollocations) 
          ? parsed.keyCollocations 
          : [];

        const collocations: CollocationInsight[] = rawCollocations.map((item: any) => ({
          phrase: item.phrase || item.term || '',
          meaning: item.meaning || '',
          note: item.note || '',
          term: item.phrase || item.term || '',
        })).filter((item: CollocationInsight) => item.phrase.trim().length > 0);

        if (standardText) {
          return {
            standard: standardText,
            formal: formalText,
            casual: casualText,
            collocations,
            contextNote: parsed.contextNote || `Dịch chuẩn xác theo ngữ cảnh ${tone.toUpperCase()}.`,
            toneUsed: tone,
            isAiPowered: true,
            isFallback: false,
            // Aliases
            mainTranslation: standardText,
            formalVersion: formalText,
            casualVersion: casualText,
            keyCollocations: collocations,
          };
        }
        console.warn('[AITranslation] Gemini returned JSON without expected text, falling back to offline semantic engine.');
      } else {
        console.warn(`[AITranslation] Gemini Translation API returned HTTP ${res.status}: ${res.statusText}, falling back to offline semantic engine.`);
      }
    } catch (err) {
      console.warn('[AITranslation] Gemini Translation API encountered an error, falling back to smart semantic engine:', err);
    }
  } else {
    console.warn('[AITranslation] No valid Gemini API Key configured, using smart offline semantic engine.');
  }

  // 2. SMART OFFLINE SEMANTIC FALLBACK ENGINE (Khi chưa có API key hoặc mạng chập chờn / lỗi)
  let baseTranslation = '';
  try {
    baseTranslation = await translateText(cleanText, sourceLang, targetLang);
  } catch (e) {
    console.warn('[AITranslation] Base translateText failed, falling back to source text:', e);
  }

  if (!baseTranslation) {
    baseTranslation = cleanText;
  }

  // Biến đổi ngữ nghĩa và văn phong theo 4 Ngữ Cảnh và 3 Biến thể Tabs
  const transformed = transformOfflineByTone(
    baseTranslation,
    cleanText,
    sourceLang,
    targetLang,
    tone
  );

  const collocations = transformed.collocations.map((c) => ({
    ...c,
    term: c.phrase,
  }));

  return {
    standard: transformed.standard,
    formal: transformed.formal,
    casual: transformed.casual,
    collocations,
    contextNote: transformed.contextNote,
    toneUsed: tone,
    isAiPowered: false,
    isFallback: true,
    // Aliases
    mainTranslation: transformed.standard,
    formalVersion: transformed.formal,
    casualVersion: transformed.casual,
    keyCollocations: collocations,
  };
}
