import { WritingPrompt } from './types';

export const WRITING_PROMPTS: WritingPrompt[] = [
  {
    id: 'wp_1',
    title: 'Pull Request Description & Technical Verification Report',
    type: 'Technical Report',
    category: 'Tech / Workplace',
    level: 'B1-B2',
    minWords: 80,
    prompt: 'Viết mô tả kỹ thuật chi tiết cho một Pull Request trên GitHub/GitLab: Giải thích tóm tắt tính năng thêm bộ nhớ đệm Redis, nguyên nhân tối ưu hóa, các bước kiểm thử tự động (Unit / Integration tests) và cam kết không gây lỗi hồi quy (No breaking changes).',
    guidelines: [
      'Tiêu đề PR rõ ràng (PR Title: [Feature] Implement Redis In-Memory Caching for User API)',
      'Tóm tắt mục tiêu thay đổi (Summary of Changes: Add 15-minute TTL caching layer)',
      'Động lực kỹ thuật (Motivation: Reduce database query latency and prevent connection exhaustion)',
      'Các bước kiểm thử cục bộ (Testing Steps: Docker Redis startup, integration test commands)',
      'Đánh giá rủi ro (Risk Assessment: Verified backward compatibility and schema idempotency)'
    ],
    recommendedVocab: [
      { word: 'Throughput', meaning: 'Thông lượng xử lý của hệ thống' },
      { word: 'Time-to-live (TTL)', meaning: 'Thời gian tồn tại của bản ghi trong bộ đệm' },
      { word: 'Idempotency', meaning: 'Tính bất biến / thực thi nhiều lần không đổi kết quả' },
      { word: 'Regression testing', meaning: 'Kiểm thử hồi quy ngăn ngừa lỗi cũ' },
      { word: 'Backward compatibility', meaning: 'Tính tương thích ngược với phiên bản trước' }
    ],
    modelAnswer: `PR Description: Implement Distributed Redis Caching for High-Frequency User Profile Endpoint

Summary of Changes:
This pull request introduces an in-memory Redis caching layer to the \`/api/v1/users/profile\` endpoint with a fifteen-minute Time-To-Live (TTL) configuration. By intercepting read-heavy requests before querying the primary PostgreSQL cluster, this optimization mitigates connection pool exhaustion and improves API throughput by approximately sixty-five percent during peak simulation runs.

Technical Implementation:
1. Configured Redis connection pooling with automated retry policies and exponential backoff.
2. Implemented cache invalidation hooks triggered upon user profile update mutations to eliminate stale data.
3. Added structured distributed tracing headers to capture cache hit and miss telemetry.

Testing & Verification:
1. Bootstrapped local Redis instance via \`docker-compose up -d redis\`.
2. Executed end-to-end integration test suite via \`npm run test:integration\`.
3. Verified zero regression impact on legacy authentication middleware.

No breaking schema changes or database migration locks introduced.`
  },
  {
    id: 'wp_2',
    title: 'Senior Architecture Review Request: Multi-Currency Billing Engine',
    type: 'Professional Email',
    category: 'Tech / Workplace',
    level: 'B1-B2',
    minWords: 75,
    prompt: 'Viết email trang trọng gửi cho Principal Software Architect để xin ý kiến đánh giá tài liệu thiết kế hệ thống (Design Document) cho module thanh toán đa tiền tệ trước khi bắt đầu sprint phát triển.',
    guidelines: [
      'Chào hỏi trang trọng (Dear Alex / Principal Architect,)',
      'Nêu rõ tài liệu đính kèm và mục tiêu thiết kế (RFC: Multi-Currency Payment Engine Architecture)',
      'Nêu cụ thể 2 điểm trọng tâm cần xin ý kiến (Webhook retry idempotency & Foreign exchange rate synchronization)',
      'Đề xuất thời hạn mong muốn nhận feedback (Prior to Thursday sprint kickoff)'
    ],
    recommendedVocab: [
      { word: 'Design specification', meaning: 'Tài liệu đặc tả thiết kế hệ thống' },
      { word: 'Idempotency key', meaning: 'Khóa bất biến chống lặp giao dịch' },
      { word: 'Constructive feedback', meaning: 'Ý kiến đóng góp mang tính xây dựng' },
      { word: 'Mitigate risk', meaning: 'Giảm thiểu rủi ro vận hành' },
      { word: 'Sprint kickoff', meaning: 'Buổi khởi động chu kỳ phát triển' }
    ],
    modelAnswer: `Dear Alex,

I hope your week is proceeding smoothly. I have finalized the initial architecture design specification for our upcoming multi-currency billing integration, scheduled for development in Sprint 24.

The design document outlines our strategy for handling asynchronous webhook retries from international payment providers and introduces Redis-backed idempotency keys to prevent duplicate customer charges. Specifically, I would greatly appreciate your architectural insights regarding our foreign exchange rate caching strategy and database dead-letter queue routing.

Whenever your schedule permits, could you please review the attached design doc and provide your constructive feedback prior to our sprint kickoff meeting this Thursday afternoon? Your guidance will ensure we mitigate technical risks before writing production code.

Thank you very much for your time and continuous mentorship.

Best regards,
Minh Hoang
Senior Software Engineer`
  },
  {
    id: 'wp_3',
    title: 'Jira Critical Bug Report: Password Reset API Sanitization',
    type: 'Technical Report',
    category: 'Tech / Workplace',
    level: 'B1-B2',
    minWords: 80,
    prompt: 'Viết một báo cáo lỗi chuẩn kỹ thuật trên Jira/Linear: Mô tả lỗi nghiêm trọng khi người dùng đổi mật khẩu có ký tự đặc biệt bị lỗi 422 Unprocessable Entity, kèm môi trường, các bước tái hiện và hành vi mong đợi.',
    guidelines: [
      'Tiêu đề lỗi súc tích (Bug Summary: Password Reset Endpoint Fails When Using UTF-8 Special Symbols)',
      'Môi trường xảy ra lỗi (Environment: Production / Chrome v124 / API v2.4.1)',
      'Mức độ nghiêm trọng (Severity: High / Priority: Blocker)',
      'Các bước tái hiện (Steps to Reproduce: 1, 2, 3, 4)',
      'Kết quả thực tế vs Kết quả mong đợi (Actual Result vs Expected Result)'
    ],
    recommendedVocab: [
      { word: 'Steps to reproduce', meaning: 'Các bước tuần tự để tái hiện lỗi' },
      { word: 'Expected behavior', meaning: 'Hành vi mong đợi chuẩn của hệ thống' },
      { word: 'Input sanitization', meaning: 'Làm sạch và kiểm tra dữ liệu đầu vào' },
      { word: 'Regressional defect', meaning: 'Lỗi phát sinh do thay đổi mã nguồn trước đó' },
      { word: 'Unprocessable entity', meaning: 'Lỗi thực thể không thể xử lý (HTTP 422)' }
    ],
    modelAnswer: `Bug Ticket: [AUTH-4092] Password Reset Endpoint Rejects Valid Special Characters

Environment: Production (Web Client v2.4.1, Node.js API Gateway v3.1.0)
Severity: High (Affects User Account Security & Conversion)

Description:
Users attempting to update their account passwords using valid UTF-8 symbols (such as \`#\`, \`&\`, or \`!\`) receive an unhandled HTTP 422 Unprocessable Entity error.

Steps to Reproduce:
1. Navigate to Account Settings > Security > Change Password.
2. Enter current valid password.
3. Enter new password containing complex special characters (e.g., \`Secret#2026!&\`).
4. Submit form by clicking "Save Changes".

Actual Result:
API returns HTTP 422 error with message "Invalid characters detected in payload", and the update fails completely.

Expected Behavior:
The authentication middleware should properly sanitize and accept all standard UTF-8 characters in accordance with corporate security guidelines.

Proposed Fix:
Update regex validation pattern in \`validators/authValidator.ts\` and add unit test test-cases covering edge-case ASCII symbols.`
  },
  {
    id: 'wp_4',
    title: 'Software Engineer Cover Letter: High-Scale Systems Role',
    type: 'Professional Email',
    category: 'Career Development',
    level: 'B2-C1',
    minWords: 90,
    prompt: 'Viết một lá thư ứng tuyển (Cover Letter) chuyên nghiệp gửi cho Giám đốc Kỹ thuật (VP of Engineering): Làm nổi bật kinh nghiệm 4 năm xây dựng hệ thống phân tán, thành tích tối ưu hóa hiệu năng 40% và sự hào hứng cống hiến cho công ty.',
    guidelines: [
      'Chào hỏi trang trọng (Dear VP of Engineering / Hiring Committee,)',
      'Khẳng định vị trí ứng tuyển và lý do hào hứng với sứ mệnh công ty',
      'Nêu thành tích định lượng nổi bật (Led refactoring reducing latency by 40% and cutting cloud costs)',
      'Khẳng định năng lực làm việc nhóm Agile và cố vấn kỹ thuật',
      'Đề xuất cơ hội trao đổi trong buổi phỏng vấn trực tiếp'
    ],
    recommendedVocab: [
      { word: 'Demonstrated track record', meaning: 'Thành tích đã được chứng minh qua thực tế' },
      { word: 'High-throughput architecture', meaning: 'Kiến trúc xử lý thông lượng dữ liệu cao' },
      { word: 'Cross-functional collaboration', meaning: 'Hợp tác hiệu quả giữa các phòng ban' },
      { word: 'Drive impactful solutions', meaning: 'Thúc đẩy các giải pháp mang lại giá trị lớn' },
      { word: 'Spearheaded', meaning: 'Dẫn dắt, tiên phong khởi xướng' }
    ],
    modelAnswer: `Dear Hiring Committee,

I am writing to express my strong enthusiasm for the Senior Software Engineer position at your organization. With over four years of hands-on experience designing resilient, high-throughput cloud architectures using TypeScript, React, Node.js, and PostgreSQL, I have consistently driven technical solutions that enhance platform scalability and elevate end-user experiences.

In my previous role at a fast-growing fintech startup, I spearheaded the refactoring of our core payment ingestion pipeline. By implementing Redis caching and asynchronous Kafka event streaming, our engineering team reduced API latency by forty percent while cutting cloud infrastructure costs by twenty-five percent during peak global shopping campaigns. Furthermore, I take immense pride in fostering an inclusive engineering culture through rigorous peer code reviews and mentoring junior developers.

I am deeply inspired by your platform mission to democratize cloud infrastructure for developers worldwide. I look forward to the opportunity to discuss how my technical expertise, problem-solving mindset, and dedication to clean architecture can contribute to your engineering milestones.

Sincerely,
Minh Hoang`
  },
  {
    id: 'wp_5',
    title: 'Architecture Evaluation Essay: Monolith vs Microservices',
    type: 'Opinion Essay',
    category: 'Academic / IELTS',
    level: 'B2-C1',
    minWords: 95,
    prompt: 'Viết bài luận nghị luận kỹ thuật: Đánh giá quan điểm "Mọi công ty khởi nghiệp công nghệ nên bắt đầu với kiến trúc Monolith thay vì Microservices ngay từ ngày đầu". Nêu luận điểm về chi phí vận hành, tính linh hoạt và ngưỡng chuyển đổi.',
    guidelines: [
      'Mở bài: Đưa ra luận điểm rõ ràng (Embarking prematurely on microservices is a costly optimization)',
      'Thân bài 1: Lợi ích của Monolith (Rapid prototyping, unified database transactions, single-deployment simplicity)',
      'Thân bài 2: Chi phí tiềm ẩn của Microservices (Distributed tracing, network latency, DevOps overhead)',
      'Kết luận: Chỉ nên chuyển đổi khi quy mô nhóm và ranh giới nghiệp vụ đã rõ ràng'
    ],
    recommendedVocab: [
      { word: 'Premature optimization', meaning: 'Tối ưu hóa quá sớm gây lãng phí nguồn lực' },
      { word: 'Operational overhead', meaning: 'Chi phí vận hành và quản lý hạ tầng' },
      { word: 'Domain boundaries', meaning: 'Ranh giới phân định nghiệp vụ chuyên biệt' },
      { word: 'Decoupled architecture', meaning: 'Kiến trúc được tách rời độc lập' },
      { word: 'Tangible dividends', meaning: 'Những lợi ích hữu hình, thiết thực' }
    ],
    modelAnswer: `For early-stage technology startups, embarking directly on a distributed microservices architecture is frequently a costly exercise in premature optimization. In the nascent phases of product development, engineering teams face substantial market uncertainty, requiring rapid prototyping, frequent pivot iterations, and frictionless refactoring.

A modular monolithic architecture offers unparalleled operational advantages for lean teams. It provides single-binary deployments, straightforward local debugging, and ACID database transactions without the distributed networking complexities of service meshes, RPC serialization, and eventual data consistency. Deploying dozens of microservices prematurely introduces massive operational overhead, forcing small teams to manage complex Kubernetes clusters and distributed tracing tools rather than delivering customer-facing features.

Only when organizational headcount expands substantially—such that multiple independent feature teams begin stepping on each other's toes within a shared codebase—does decomposing into microservices yield tangible organizational dividends. Until those clear domain boundaries are firmly established, maintaining a well-architected modular monolith remains the most pragmatic and resilient engineering strategy.`
  }
];
