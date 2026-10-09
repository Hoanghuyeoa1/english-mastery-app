// src/services/textAnalysisService.ts
/**
 * Text Analysis Service (Deterministic NLP & Linguistic Intelligence)
 * 
 * Provides pure, deterministic tokenization, canonical lemma extraction,
 * local CEFR tagging, grammar pattern recognition, phrasal verbs, idioms,
 * and IT/Academic vocabulary tagging for English text in the Translator.
 * 
 * Invariants:
 * 1. Zero Mock Data: Uses authoritative dictionaryIndex & vocabulary bank for CEFR & lemmas.
 * 2. Unrated Integrity: Words not found in dictionary have cefr: undefined (never guessed).
 * 3. Range Integrity: Every token has start/end matching sourceText.slice(start, end) === raw.
 * 4. Overlapping Resolution: Longer/higher-value spans override single tokens without nested DOM.
 * 5. Fail-Safe: Never throws; runtime errors return safe fallback without crashing translation.
 * 6. High Performance: Analyzes 2000+ words in < 50ms without memory bloat.
 */

import type { CEFRLevel, VocabWord } from '../types';
import { getDictionaryWord } from './dictionaryIndex';
import { cleanWordToken, getStemCandidates, lookupContextWord } from './wordLookupService';

export type PhraseCategory = 
  | 'phrasal_verb' 
  | 'idiom' 
  | 'collocation' 
  | 'grammar_pattern' 
  | 'academic' 
  | 'it_term';

export interface TextToken {
  index: number;
  raw: string;                 // Exact surface substring
  clean: string;               // Normalized lowercase word
  lemma: string;               // Base dictionary form
  canonicalId?: string;        // ID from dictionary bank if matched (vocab_... or ext_...)
  start: number;               // 0-based character start index in sourceText
  end: number;                 // 0-based character end index in sourceText
  cefr?: CEFRLevel;            // Oxford/CEFR level if found in dictionary
  partOfSpeech?: string;       // POS from dictionary if available
  category?: string;           // Category/Topic from dictionary
  isAcademic?: boolean;        // True if matches Academic Word List or tag
  isIT?: boolean;              // True if matches IT / Tech vocabulary
  isStopWord?: boolean;        // High-frequency grammatical function word
}

export interface AnalyzedSpan {
  id: string;
  surface: string;             // Exact substring matched in source
  canonical: string;           // Canonical lemma or normalized phrase
  canonicalId?: string;        // Dictionary ID if matched
  start: number;               // 0-based character start index
  end: number;                 // 0-based character end index
  category: PhraseCategory;
  cefr?: CEFRLevel;
  meaning?: string;            // Short translation or grammatical gloss
  patternType?: string;        // 'passive_voice' | 'conditional' | 'relative_clause' | 'perfect_aspect' | 'gerund_infinitive'
  note?: string;               // Explanatory note
}

export interface TextAnalysisResult {
  sourceText: string;
  tokens: TextToken[];
  spans: AnalyzedSpan[];       // Clean, non-overlapping spans
  allCandidates: AnalyzedSpan[]; // All detected candidate spans before conflict resolution
  phrasalVerbs: AnalyzedSpan[];
  idioms: AnalyzedSpan[];
  grammarPatterns: AnalyzedSpan[];
  academicVocabulary: AnalyzedSpan[];
  itVocabulary: AnalyzedSpan[];
  wordCount: number;
  stats: {
    cefrDistribution: Record<CEFRLevel, number>;
    unratedCount: number;
  };
}

// Common English Stop Words (Pronouns, Prepositions, Articles, Auxiliary particles)
const STOP_WORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'if', 'because', 'as', 'until', 'while',
  'of', 'at', 'by', 'for', 'with', 'about', 'against', 'between', 'into', 'through',
  'during', 'before', 'after', 'above', 'below', 'to', 'from', 'up', 'down', 'in',
  'out', 'on', 'off', 'over', 'under', 'again', 'further', 'then', 'once', 'here',
  'there', 'when', 'where', 'why', 'how', 'all', 'any', 'both', 'each', 'few', 'more',
  'most', 'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so',
  'than', 'too', 'very', 'can', 'will', 'just', 'should', 'now', 'i', 'me', 'my',
  'myself', 'we', 'our', 'ours', 'ourselves', 'you', 'your', 'yours', 'yourself',
  'he', 'him', 'his', 'himself', 'she', 'her', 'hers', 'herself', 'it', 'its', 'itself',
  'they', 'them', 'their', 'theirs', 'themselves', 'what', 'which', 'who', 'whom',
  'this', 'that', 'these', 'those', 'am', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'having', 'do', 'does', 'did', 'doing'
]);

// Academic Word List (AWL) Core Reference Set
const AWL_CORE_WORDS = new Set([
  'analyze', 'analysis', 'approach', 'area', 'assess', 'assume', 'authority', 'available',
  'benefit', 'concept', 'consist', 'constitute', 'context', 'contract', 'create', 'data',
  'define', 'derive', 'distribute', 'economy', 'environment', 'establish', 'estimate',
  'evident', 'factor', 'finance', 'formula', 'function', 'identify', 'income', 'indicate',
  'individual', 'interpret', 'involve', 'issue', 'labor', 'legal', 'legislate', 'major',
  'method', 'occur', 'percent', 'period', 'policy', 'principle', 'proceed', 'process',
  'require', 'research', 'respond', 'role', 'section', 'sector', 'significant', 'similar',
  'source', 'specific', 'structure', 'theory', 'vary', 'optimize', 'optimization',
  'maximize', 'minimize', 'implement', 'implementation', 'evaluate', 'evaluation',
  'maintain', 'maintenance', 'objective', 'framework', 'parameter', 'protocol', 'criterion',
  'criteria', 'hypothesis', 'empirical', 'methodology', 'paradigm', 'comprehensive',
  'subsequent', 'consequently', 'fundamental', 'integrity', 'mechanism', 'preliminary'
]);

// IT & Software Engineering Terms Dictionary
const IT_KNOWLEDGE_TERMS: Array<{
  pattern: RegExp;
  canonical: string;
  meaning: string;
  note: string;
}> = [
  {
    pattern: /\bbackend\s+microservices\b/i,
    canonical: 'backend microservices',
    meaning: 'Hệ thống vi dịch vụ backend máy chủ',
    note: 'Kiến trúc phân tán chia nhỏ hệ thống thành các dịch vụ độc lập.',
  },
  {
    pattern: /\bdistributed\s+systems?\b/i,
    canonical: 'distributed system',
    meaning: 'Hệ thống phân tán',
    note: 'Kiến trúc máy tính gồm nhiều nút độc lập phối hợp qua mạng để giải quyết bài toán chung.',
  },
  {
    pattern: /\bmicroservices?\b/i,
    canonical: 'microservice',
    meaning: 'Kiến trúc vi dịch vụ',
    note: 'Mô hình thiết kế phần mềm thành chuỗi dịch vụ phân tán.',
  },
  {
    pattern: /\bload\s+balancing\b/i,
    canonical: 'load balancing',
    meaning: 'Cân bằng tải hệ thống',
    note: 'Kỹ thuật phân phối lưu lượng truy cập qua nhiều máy chủ.',
  },
  {
    pattern: /\bcloud-native\b/i,
    canonical: 'cloud-native',
    meaning: 'Kiến trúc tối ưu hóa cho đám mây',
    note: 'Ứng dụng xây dựng để tận dụng tối đa nền tảng điện toán đám mây.',
  },
  {
    pattern: /\bci\/cd(?:\s+pipeline)?\b/i,
    canonical: 'CI/CD pipeline',
    meaning: 'Quy trình tích hợp và triển khai tự động',
    note: 'Chuỗi tự động hóa kiểm thử và phát hành phần mềm liên tục.',
  },
  {
    pattern: /\bapi\s+endpoints?\b/i,
    canonical: 'API endpoint',
    meaning: 'Điểm cuối giao tiếp API',
    note: 'Đường dẫn tiếp nhận và xử lý request giữa client và server.',
  },
  {
    pattern: /\b(real-time|real\s+time)\b/i,
    canonical: 'real-time',
    meaning: 'Thời gian thực',
    note: 'Xử lý và phản hồi dữ liệu ngay lập tức mà không có độ trễ nhận thấy.',
  },
  {
    pattern: /\b(state-of-the-art)\b/i,
    canonical: 'state-of-the-art',
    meaning: 'Tối tân, hiện đại nhất',
    note: 'Đạt đỉnh cao về công nghệ hoặc kỹ thuật trong lĩnh vực.',
  },
  {
    pattern: /\blatency\b/i,
    canonical: 'latency',
    meaning: 'Độ trễ hệ thống',
    note: 'Khoảng thời gian cần thiết để một gói tin di chuyển và phản hồi.',
  },
  {
    pattern: /\bscalability\b/i,
    canonical: 'scalability',
    meaning: 'Khả năng mở rộng quy mô hệ thống',
    note: 'Năng lực chịu tải mở rộng của hệ thống khi khối lượng công việc tăng cao.',
  },
  {
    pattern: /\bthroughput\b/i,
    canonical: 'throughput',
    meaning: 'Thông lượng xử lý dữ liệu',
    note: 'Số lượng tác vụ hoặc khối lượng dữ liệu xử lý trong một đơn vị thời gian.',
  },
  {
    pattern: /\bconcurrency\b/i,
    canonical: 'concurrency',
    meaning: 'Tính đồng thời / xử lý đa nhiệm',
    note: 'Khả năng thực thi nhiều tác vụ cùng một thời điểm trong hệ thống.',
  },
  {
    pattern: /\basynchronous\b/i,
    canonical: 'asynchronous',
    meaning: 'Xử lý bất đồng bộ (async)',
    note: 'Thực thi tác vụ chạy ngầm mà không làm nghẽn luồng xử lý chính.',
  },
  {
    pattern: /\bmiddleware\b/i,
    canonical: 'middleware',
    meaning: 'Lớp phần mềm trung gian',
    note: 'Thành phần nằm giữa hệ điều hành/dịch vụ để liên kết và lọc request.',
  },
  {
    pattern: /\brefactor(?:ing)?\b/i,
    canonical: 'refactoring',
    meaning: 'Tái cấu trúc mã nguồn',
    note: 'Tối ưu hóa mã nguồn mà không làm thay đổi hành vi bên ngoài.',
  },
  {
    pattern: /\bcontainerization\b/i,
    canonical: 'containerization',
    meaning: 'Đóng gói ứng dụng vào container',
    note: 'Công nghệ đóng gói code và dependencies vào container độc lập (Docker).',
  },
  {
    pattern: /\bkubernetes\b/i,
    canonical: 'kubernetes',
    meaning: 'Hệ thống điều phối container Kubernetes (K8s)',
    note: 'Nền tảng mã nguồn mở điều phối và quản lý cụm container.',
  },
  {
    pattern: /\bserverless\b/i,
    canonical: 'serverless',
    meaning: 'Kiến trúc không máy chủ (Serverless)',
    note: 'Mô hình triển khai mã nguồn tự động cấp phát tài nguyên theo sự kiện.',
  },
  {
    pattern: /\bdatabase\b/i,
    canonical: 'database',
    meaning: 'Cơ sở dữ liệu',
    note: 'Hệ thống lưu trữ và quản lý dữ liệu có cấu trúc.',
  },
  {
    pattern: /\bcache\b/i,
    canonical: 'cache',
    meaning: 'Bộ nhớ đệm',
    note: 'Vùng lưu trữ dữ liệu tạm thời tốc độ cao để giảm tải truy vấn.',
  },
];

// Phrasal Verbs Dictionary (with inflection coverage)
const PHRASAL_VERBS_LIST: Array<{
  pattern: RegExp;
  canonical: string;
  meaning: string;
  note: string;
}> = [
  {
    pattern: /\b(set|sets|setting)\s+up\b/i,
    canonical: 'set up',
    meaning: 'Thiết lập, cài đặt, khởi tạo',
    note: 'Khởi tạo cấu hình hoặc tổ chức một hệ thống/quy trình.',
  },
  {
    pattern: /\b(carry|carries|carried|carrying)\s+out\b/i,
    canonical: 'carry out',
    meaning: 'Tiến hành, thực hiện',
    note: 'Thực thi một kế hoạch, chỉ thị hoặc cuộc nghiên cứu.',
  },
  {
    pattern: /\b(figure|figures|figured|figuring)\s+out\b/i,
    canonical: 'figure out',
    meaning: 'Tìm ra cách giải quyết, hiểu ra',
    note: 'Suy nghĩ thấu đáo để tìm ra câu trả lời hoặc giải pháp.',
  },
  {
    pattern: /\b(look|looks|looked|looking)\s+into\b/i,
    canonical: 'look into',
    meaning: 'Khảo sát, điều tra, xem xét kỹ',
    note: 'Nghiên cứu nguyên nhân của một vấn đề kỹ thuật.',
  },
  {
    pattern: /\b(point|points|pointed|pointing)\s+out\b/i,
    canonical: 'point out',
    meaning: 'Chỉ ra, lưu ý',
    note: 'Nhấn mạnh một điểm quan trọng cần chú ý.',
  },
  {
    pattern: /\b(break|breaks|broke|broken|breaking)\s+down\b/i,
    canonical: 'break down',
    meaning: 'Phân tích chi tiết / Gặp sự cố',
    note: 'Chia nhỏ thành các phần dễ quản lý hoặc hỏng hóc dừng hoạt động.',
  },
  {
    pattern: /\b(roll|rolls|rolled|rolling)\s+out\b/i,
    canonical: 'roll out',
    meaning: 'Phát hành, triển khai từng phần',
    note: 'Đưa tính năng hoặc phiên bản phần mềm mới ra người dùng.',
  },
  {
    pattern: /\b(scale|scales|scaled|scaling)\s+up\b/i,
    canonical: 'scale up',
    meaning: 'Mở rộng quy mô',
    note: 'Gia tăng tài nguyên hoặc năng lực xử lý của hệ thống.',
  },
  {
    pattern: /\b(shut|shuts|shutting)\s+down\b/i,
    canonical: 'shut down',
    meaning: 'Tắt máy, đóng cổng dịch vụ',
    note: 'Ngừng hoạt động một dịch vụ hoặc máy chủ hoàn toàn.',
  },
  {
    pattern: /\b(back|backs|backed|backing)\s+up\b/i,
    canonical: 'back up',
    meaning: 'Sao lưu dữ liệu',
    note: 'Tạo bản sao lưu trữ phòng ngừa sự cố mất mát dữ liệu.',
  },
  {
    pattern: /\b(come|comes|came|coming)\s+up\s+with\b/i,
    canonical: 'come up with',
    meaning: 'Nảy ra ý tưởng, phát kiến giải pháp',
    note: 'Sáng tạo hoặc đề xuất một giải pháp mới.',
  },
  {
    pattern: /\b(keep|keeps|kept|keeping)\s+up\s+with\b/i,
    canonical: 'keep up with',
    meaning: 'Bắt kịp, theo kịp tiến độ',
    note: 'Duy trì tốc độ tương đương với sự phát triển nhanh chóng.',
  },
  {
    pattern: /\b(look|looks|looked|looking)\s+forward\s+to\b/i,
    canonical: 'look forward to',
    meaning: 'Mong đợi, trông chờ',
    note: 'Bày tỏ sự háo hức chờ đón một sự kiện trong tương lai.',
  },
  {
    pattern: /\b(deal|deals|dealt|dealing)\s+with\b/i,
    canonical: 'deal with',
    meaning: 'Giải quyết, xử lý vấn đề',
    note: 'Đối mặt và xử lý một tình huống hoặc lỗi phát sinh.',
  },
  {
    pattern: /\b(give|gives|gave|given|giving)\s+up\b/i,
    canonical: 'give up',
    meaning: 'Từ bỏ, đầu hàng',
    note: 'Ngừng nỗ lực thực hiện một mục tiêu.',
  },
  {
    pattern: /\b(take|takes|took|taken|taking)\s+on\b/i,
    canonical: 'take on',
    meaning: 'Đảm nhận công việc / Tiếp nhận thử thách',
    note: 'Nhận trách nhiệm xử lý một dự án hoặc thách thức mới.',
  },
  {
    pattern: /\b(put|puts|putting)\s+off\b/i,
    canonical: 'put off',
    meaning: 'Trì hoãn, hoãn lại',
    note: 'Dời việc sang một thời điểm muộn hơn.',
  },
  {
    pattern: /\b(call|calls|called|calling)\s+off\b/i,
    canonical: 'call off',
    meaning: 'Hủy bỏ',
    note: 'Quyết định không tiến hành một sự kiện hoặc kế hoạch.',
  },
  {
    pattern: /\b(run|runs|ran|running)\s+out\s+of\b/i,
    canonical: 'run out of',
    meaning: 'Cạn kiệt, hết sạch',
    note: 'Sử dụng hết nguồn tài nguyên (bộ nhớ, thời gian, kinh phí).',
  },
  {
    pattern: /\b(get|gets|got|getting)\s+rid\s+of\b/i,
    canonical: 'get rid of',
    meaning: 'Loại bỏ, vứt bỏ',
    note: 'Xóa bỏ phần tử thừa thãi hoặc mã lỗi không còn cần thiết.',
  },
];

// Idioms Dictionary
const IDIOMS_LIST: Array<{
  pattern: RegExp;
  canonical: string;
  meaning: string;
  note: string;
}> = [
  {
    pattern: /\bcutting\s+edge\b/i,
    canonical: 'cutting edge',
    meaning: 'Tiên tiến, đi đầu công nghệ',
    note: 'Thành tựu mang tính đột phá và mới nhất.',
  },
  {
    pattern: /\bout\s+of\s+the\s+box\b/i,
    canonical: 'out of the box',
    meaning: 'Dùng được ngay không cần cài đặt thêm / Sáng tạo đột phá',
    note: 'Sẵn sàng vận hành ngay lập tức hoặc tư duy khác biệt.',
  },
  {
    pattern: /\bpiece\s+of\s+cake\b/i,
    canonical: 'piece of cake',
    meaning: 'Dễ như trở bàn tay',
    note: 'Nhiệm vụ vô cùng dễ dàng thực hiện.',
  },
  {
    pattern: /\bin\s+the\s+long\s+run\b/i,
    canonical: 'in the long run',
    meaning: 'Về lâu về dài',
    note: 'Kết quả đạt được qua một khoảng thời gian dài.',
  },
  {
    pattern: /\brule\s+of\s+thumb\b/i,
    canonical: 'rule of thumb',
    meaning: 'Nguyên tắc ngón tay cái / Kinh nghiệm thực tế',
    note: 'Nguyên tắc chỉ dẫn dựa trên kinh nghiệm thực tiễn hơn là lý thuyết.',
  },
  {
    pattern: /\bat\s+the\s+end\s+of\s+the\s+day\b/i,
    canonical: 'at the end of the day',
    meaning: 'Rốt cuộc, suy cho cùng',
    note: 'Điểm cốt lõi nhất sau khi đã xem xét mọi khía cạnh.',
  },
  {
    pattern: /\btouch\s+base\b/i,
    canonical: 'touch base',
    meaning: 'Liên lạc nhanh để cập nhật tình hình',
    note: 'Trao đổi ngắn gọn giữa các đồng nghiệp hoặc đối tác.',
  },
  {
    pattern: /\bon\s+the\s+same\s+page\b/i,
    canonical: 'on the same page',
    meaning: 'Cùng chung nhận thức, đồng thuận',
    note: 'Mọi người đều thấu hiểu và nhất trí về cùng một mục tiêu.',
  },
  {
    pattern: /\braise\s+the\s+bar\b/i,
    canonical: 'raise the bar',
    meaning: 'Nâng cao tiêu chuẩn / Đặt ra chuẩn mực cao hơn',
    note: 'Gia tăng mức độ yêu cầu về chất lượng và hiệu năng.',
  },
  {
    pattern: /\bahead\s+of\s+the\s+curve\b/i,
    canonical: 'ahead of the curve',
    meaning: 'Đi trước đón đầu xu hướng',
    note: 'Nắm bắt lợi thế cạnh tranh trước khi xu thế trở nên phổ biến.',
  },
  {
    pattern: /\bhit\s+the\s+nail\s+on\s+the\s+head\b/i,
    canonical: 'hit the nail on the head',
    meaning: 'Nói trúng tim đen, chính xác hoàn toàn',
    note: 'Mô tả nguyên nhân hoặc giải pháp hoàn toàn chính xác.',
  },
  {
    pattern: /\bbite\s+the\s+bullet\b/i,
    canonical: 'bite the bullet',
    meaning: 'Cắn răng chịu đựng để hoàn thành nhiệm vụ khó',
    note: 'Quyết định đối mặt với điều khó khăn không thể tránh khỏi.',
  },
  {
    pattern: /\bback\s+to\s+the\s+drawing\s+board\b/i,
    canonical: 'back to the drawing board',
    meaning: 'Làm lại từ đầu sau khi thất bại',
    note: 'Bắt đầu lên lại kế hoạch mới khi phương án cũ không hiệu quả.',
  },
  {
    pattern: /\bburn\s+the\s+midnight\s+oil\b/i,
    canonical: 'burn the midnight oil',
    meaning: 'Thức khuya làm việc miệt mài',
    note: 'Làm việc chăm chỉ xuyên đêm để kịp tiến độ.',
  },
];

// Grammar Pattern Detectors (Core 5 Patterns)
interface GrammarRule {
  patternType: string;
  regex: RegExp;
  meaning: string;
  note: string;
}

const GRAMMAR_RULES: GrammarRule[] = [
  // 1. Passive Voice: be + V3/ed
  {
    patternType: 'passive_voice',
    regex: /\b(am|is|are|was|were|be|been|being)\s+([a-zA-Z]+ed|[a-zA-Z]+en|built|made|done|written|given|taken|seen|known|found|thought|kept|held|set|put|cut|hit|spread|read|shut|run|lost|paid|met|led|left|brought|bought|sent|spent|felt|heard|told|sold|caught|taught|understood)\b/gi,
    meaning: 'Thể bị động (Passive Voice)',
    note: 'Cấu trúc bị động: be + V3/ed diễn tả hành động tác động lên chủ ngữ.',
  },
  // 2. Conditional: if / unless / as long as / had + S + V3
  {
    patternType: 'conditional',
    regex: /\b(if|unless|provided\s+that|as\s+long\s+as)\b[^.!?\n,;]{2,50}/gi,
    meaning: 'Mệnh đề điều kiện (Conditional Clause)',
    note: 'Diễn tả giả định hoặc điều kiện cần thiết để hành động khác diễn ra.',
  },
  // 3. Relative Clause: which/who/whom/whose/that + verb
  {
    patternType: 'relative_clause',
    regex: /\b(which|who|whom|whose)\s+(?:(?:is|are|was|were|has|have|had|[a-zA-Z]+s|[a-zA-Z]+ed|[a-zA-Z]+ing)\b|(?:[a-zA-Z]+\s+(?:is|are|was|were|has|have|had|[a-zA-Z]+s|[a-zA-Z]+ed)))\b/gi,
    meaning: 'Mệnh đề quan hệ (Relative Clause)',
    note: 'Mệnh đề bổ nghĩa trực tiếp cho danh từ đứng trước.',
  },
  // 4. Perfect Aspect: have/has/had + V3/ed
  {
    patternType: 'perfect_aspect',
    regex: /\b(have|has|had|having)\s+([a-zA-Z]+ed|[a-zA-Z]+en|been|done|made|seen|gone|written|taken|given|known|found|built|thought|kept|held|run|lost|paid|met|led|left|brought|bought|sent|spent|felt|heard|told|sold)\b/gi,
    meaning: 'Thì hoàn thành (Perfect Aspect)',
    note: 'Diễn tả hành động hoàn tất trước một thời điểm hoặc kéo dài đến hiện tại.',
  },
  // 5. Infinitive / Gerund Patterns: verb + to V / preposition + V-ing
  {
    patternType: 'gerund_infinitive',
    regex: /\b(in\s+order\s+to|so\s+as\s+to|used\s+to|aim\s+to|plan\s+to|manage\s+to|fail\s+to|refuse\s+to|decide\s+to|hope\s+to|agree\s+to|promise\s+to|need\s+to|want\s+to|capable\s+of|responsible\s+for|tend\s+to)\s+([a-zA-Z]+(?:ing)?)\b/gi,
    meaning: 'Cấu trúc nguyên mẫu / Danh động từ (Infinitive / Gerund Pattern)',
    note: 'Cấu trúc đi kèm động từ nguyên mẫu (to V) hoặc danh động từ (V-ing).',
  },
];

// Helper to determine category specificity weight for interval packing
function getCategoryWeight(cat: PhraseCategory): number {
  switch (cat) {
    case 'idiom': return 100;
    case 'phrasal_verb': return 90;
    case 'it_term': return 80;
    case 'academic': return 70;
    case 'grammar_pattern': return 60;
    case 'collocation': return 50;
    default: return 10;
  }
}

/**
 * Tokenize English text while preserving exact char offsets [start, end)
 * and extracting canonical lemma and CEFR level from authoritative dictionary.
 */
export function tokenizeText(sourceText: string): TextToken[] {
  if (!sourceText || typeof sourceText !== 'string') {
    return [];
  }

  const tokens: TextToken[] = [];
  // Token match regex:
  // Matches hyphenated words, words with internal apostrophes (contractions, possessives), or standard words.
  // E.g.: "state-of-the-art", "don't", "user's", "backend", "100"
  const tokenRegex = /[a-zA-Z0-9]+(?:[-'][a-zA-Z0-9]+)*'?/g;

  let match: RegExpExecArray | null;
  let tokenIndex = 0;

  while ((match = tokenRegex.exec(sourceText)) !== null) {
    const raw = match[0];
    const start = match.index;
    const end = start + raw.length;

    // Normalization & cleaning
    let clean = cleanWordToken(raw);
    let lemma = clean;
    let canonicalId: string | undefined;
    let cefr: CEFRLevel | undefined;
    let partOfSpeech: string | undefined;
    let category: string | undefined;

    // Handle possessives: e.g. "user's" -> base "user", "students'" -> base "student"
    if (raw.endsWith("'s") && clean.length > 2) {
      clean = clean.replace(/'s$/, '');
    } else if (raw.endsWith("s'") && clean.length > 2) {
      clean = clean.replace(/s$/, '');
    }

    // Authoritative lookup via dictionary index
    const dictWord = lookupContextWord(clean);
    if (dictWord) {
      lemma = (dictWord.word || clean).toLowerCase();
      canonicalId = dictWord.id;
      const rawCefr = (dictWord.cefr || dictWord.level)?.toUpperCase();
      if (rawCefr && ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].includes(rawCefr)) {
        cefr = rawCefr as CEFRLevel;
      }
      partOfSpeech = dictWord.partOfSpeech || dictWord.pos;
      category = dictWord.category || dictWord.topic;
    } else {
      lemma = clean.toLowerCase();
    }

    const lemmaLower = lemma.toLowerCase();
    const isAcademic = 
      dictWord?.tag === 'Academic' || 
      Boolean(category?.toLowerCase().includes('academic')) || 
      AWL_CORE_WORDS.has(lemmaLower);

    const isIT = 
      dictWord?.tag === 'Tech' || 
      Boolean(category?.toLowerCase().includes('it')) || 
      Boolean(category?.toLowerCase().includes('tech'));

    const isStopWord = STOP_WORDS.has(clean.toLowerCase());

    tokens.push({
      index: tokenIndex++,
      raw,
      clean,
      lemma,
      canonicalId,
      start,
      end,
      cefr,
      partOfSpeech,
      category,
      isAcademic: isAcademic || undefined,
      isIT: isIT || undefined,
      isStopWord: isStopWord || undefined,
    });
  }

  return tokens;
}

/**
 * Extract all candidate multi-word phrases, idioms, phrasal verbs,
 * IT terms, and grammar patterns from text.
 */
export function extractCandidateSpans(sourceText: string, tokens: TextToken[]): AnalyzedSpan[] {
  if (!sourceText) return [];

  const candidates: AnalyzedSpan[] = [];
  let spanCounter = 0;

  // 1. Scan IT Knowledge Terms
  for (const it of IT_KNOWLEDGE_TERMS) {
    const rx = new RegExp(it.pattern.source, 'gi');
    let m: RegExpExecArray | null;
    while ((m = rx.exec(sourceText)) !== null) {
      candidates.push({
        id: `it_${spanCounter++}`,
        surface: m[0],
        canonical: it.canonical,
        start: m.index,
        end: m.index + m[0].length,
        category: 'it_term',
        meaning: it.meaning,
        note: it.note,
      });
    }
  }

  // 2. Scan Phrasal Verbs
  for (const pv of PHRASAL_VERBS_LIST) {
    const rx = new RegExp(pv.pattern.source, 'gi');
    let m: RegExpExecArray | null;
    while ((m = rx.exec(sourceText)) !== null) {
      candidates.push({
        id: `pv_${spanCounter++}`,
        surface: m[0],
        canonical: pv.canonical,
        start: m.index,
        end: m.index + m[0].length,
        category: 'phrasal_verb',
        meaning: pv.meaning,
        note: pv.note,
      });
    }
  }

  // 3. Scan Idioms
  for (const idm of IDIOMS_LIST) {
    const rx = new RegExp(idm.pattern.source, 'gi');
    let m: RegExpExecArray | null;
    while ((m = rx.exec(sourceText)) !== null) {
      candidates.push({
        id: `idm_${spanCounter++}`,
        surface: m[0],
        canonical: idm.canonical,
        start: m.index,
        end: m.index + m[0].length,
        category: 'idiom',
        meaning: idm.meaning,
        note: idm.note,
      });
    }
  }

  // 4. Scan Grammar Patterns
  for (const gr of GRAMMAR_RULES) {
    const rx = new RegExp(gr.regex.source, 'gi');
    let m: RegExpExecArray | null;
    while ((m = rx.exec(sourceText)) !== null) {
      candidates.push({
        id: `gr_${spanCounter++}`,
        surface: m[0].trim(),
        canonical: m[0].trim(),
        start: m.index,
        end: m.index + m[0].trim().length,
        category: 'grammar_pattern',
        patternType: gr.patternType,
        meaning: gr.meaning,
        note: gr.note,
      });
    }
  }

  // 5. Add Academic tokens as candidates
  for (const tok of tokens) {
    if (tok.isAcademic && !tok.isStopWord) {
      candidates.push({
        id: `acad_${spanCounter++}`,
        surface: tok.raw,
        canonical: tok.lemma,
        canonicalId: tok.canonicalId,
        start: tok.start,
        end: tok.end,
        category: 'academic',
        cefr: tok.cefr,
        meaning: 'Thuật ngữ học thuật thuộc Academic Word List',
        note: 'Từ vựng học thuật quan trọng trong bài viết và nghiên cứu.',
      });
    }
  }

  return candidates;
}

/**
 * Greedy interval resolver:
 * Resolves overlapping spans by prioritizing:
 * 1. Span character length (end - start) descending (longer phrases beat sub-words)
 * 2. Specificity weight (idioms > phrasal verbs > IT terms > academic > grammar pattern)
 * 3. Start position ascending
 * Guarantees zero overlapping ranges and preserves valid DOM trees.
 */
export function resolveOverlappingSpans(candidates: AnalyzedSpan[], textLength?: number): AnalyzedSpan[] {
  if (!candidates || candidates.length === 0) return [];

  // Sort candidates by length & weight
  const sorted = [...candidates].sort((a, b) => {
    const lenA = a.end - a.start;
    const lenB = b.end - b.start;
    const scoreA = lenA * 1000 + getCategoryWeight(a.category);
    const scoreB = lenB * 1000 + getCategoryWeight(b.category);

    if (scoreB !== scoreA) {
      return scoreB - scoreA;
    }
    return a.start - b.start;
  });

  const accepted: AnalyzedSpan[] = [];
  const maxEnd = typeof textLength === 'number' && textLength > 0
    ? textLength
    : candidates.reduce((max, c) => Math.max(max, c.end), 0);

  // Fast O(1) interval conflict check via Uint8Array bitmask
  const occupied = new Uint8Array(maxEnd + 1);

  for (const candidate of sorted) {
    const s = Math.max(0, candidate.start);
    const e = Math.min(maxEnd, candidate.end);
    let hasOverlap = false;

    for (let i = s; i < e; i++) {
      if (occupied[i] === 1) {
        hasOverlap = true;
        break;
      }
    }

    if (!hasOverlap) {
      for (let i = s; i < e; i++) {
        occupied[i] = 1;
      }
      accepted.push(candidate);
    }
  }

  // Final sort by start offset for deterministic sequential ordering
  accepted.sort((a, b) => a.start - b.start);
  return accepted;
}

/**
 * Empty safe analysis result fallback
 */
export function getEmptyAnalysisResult(sourceText: string = ''): TextAnalysisResult {
  return {
    sourceText,
    tokens: [],
    spans: [],
    allCandidates: [],
    phrasalVerbs: [],
    idioms: [],
    grammarPatterns: [],
    academicVocabulary: [],
    itVocabulary: [],
    wordCount: 0,
    stats: {
      cefrDistribution: { A1: 0, A2: 0, B1: 0, B2: 0, C1: 0, C2: 0 },
      unratedCount: 0,
    },
  };
}

/**
 * Main Analysis Engine: Deterministically processes English source text
 * Returns comprehensive linguistic structure with zero runtime exceptions.
 */
export function analyzeSourceText(sourceText: string): TextAnalysisResult {
  if (!sourceText || typeof sourceText !== 'string' || !sourceText.trim()) {
    return getEmptyAnalysisResult(sourceText);
  }

  try {
    const tokens = tokenizeText(sourceText);
    const allCandidates = extractCandidateSpans(sourceText, tokens);
    const resolvedSpans = resolveOverlappingSpans(allCandidates, sourceText.length);

    // Grouping by category
    const phrasalVerbs = resolvedSpans.filter((s) => s.category === 'phrasal_verb');
    const idioms = resolvedSpans.filter((s) => s.category === 'idiom');
    const grammarPatterns = resolvedSpans.filter((s) => s.category === 'grammar_pattern');
    const academicVocabulary = resolvedSpans.filter((s) => s.category === 'academic');
    const itVocabulary = resolvedSpans.filter((s) => s.category === 'it_term');

    // CEFR distribution stats
    const cefrDistribution: Record<CEFRLevel, number> = {
      A1: 0, A2: 0, B1: 0, B2: 0, C1: 0, C2: 0,
    };
    let unratedCount = 0;

    for (const token of tokens) {
      if (token.cefr && cefrDistribution[token.cefr] !== undefined) {
        cefrDistribution[token.cefr]++;
      } else {
        unratedCount++;
      }
    }

    return {
      sourceText,
      tokens,
      spans: resolvedSpans,
      allCandidates,
      phrasalVerbs,
      idioms,
      grammarPatterns,
      academicVocabulary,
      itVocabulary,
      wordCount: tokens.length,
      stats: {
        cefrDistribution,
        unratedCount,
      },
    };
  } catch (error) {
    console.warn('[textAnalysisService] Error analyzing source text, using fallback:', error);
    return getEmptyAnalysisResult(sourceText);
  }
}
