import { WritingPrompt } from '../types';

export const b1WritingLessons: WritingPrompt[] = [
  {
    id: 'wp_2',
    title: 'Senior Architecture Review Request: Multi-Currency Billing Engine',
    type: 'Professional Email',
    category: 'Tech / Workplace',
    level: 'B1',
    minWords: 120,
    maxWords: 180,
    wordRange: '120–180 words',
    prompt: 'Viết email trang trọng (120–180 từ) gửi cho Principal Software Architect để xin ý kiến đánh giá tài liệu thiết kế hệ thống (Design Document) cho module thanh toán đa tiền tệ trước khi bắt đầu sprint phát triển: Nêu rõ tài liệu đính kèm, 2 điểm trọng tâm cần xin ý kiến (Webhook retry idempotency & tỷ giá ngoại hối) và đề xuất thời hạn nhận phản hồi trước buổi kickoff thứ Năm.',
    guidelines: [
      'Chào hỏi trang trọng nơi công sở (Dear Alex / Principal Architect,)',
      'Nêu rõ tài liệu đính kèm và mục tiêu thiết kế (RFC: Multi-Currency Payment Engine Architecture)',
      'Nêu cụ thể 2 điểm trọng tâm cần xin ý kiến (Webhook retry idempotency & Foreign exchange rate synchronization)',
      'Đề xuất thời hạn mong muốn nhận feedback một cách nhã nhặn (Prior to Thursday sprint kickoff)'
    ],
    recommendedVocab: [
      { word: 'Design specification', meaning: 'Tài liệu đặc tả thiết kế hệ thống' },
      { word: 'Idempotency key', meaning: 'Khóa bất biến chống lặp giao dịch' },
      { word: 'Constructive feedback', meaning: 'Ý kiến đóng góp mang tính xây dựng' },
      { word: 'Mitigate risk', meaning: 'Giảm thiểu rủi ro vận hành' },
      { word: 'Sprint kickoff', meaning: 'Buổi khởi động chu kỳ phát triển sprint' }
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
    level: 'B1',
    minWords: 120,
    maxWords: 180,
    wordRange: '120–180 words',
    prompt: 'Viết một báo cáo lỗi kỹ thuật chuẩn trên Jira/Linear (120–180 từ): Mô tả lỗi nghiêm trọng khi người dùng đổi mật khẩu có chứa ký tự đặc biệt bị từ chối với lỗi HTTP 422, nêu rõ môi trường sản xuất, mức độ nghiêm trọng, 4 bước tuần tự để tái hiện lỗi, kết quả thực tế vs kết quả mong đợi và đề xuất hướng sửa regex validation.',
    guidelines: [
      'Tiêu đề vé lỗi súc tích, chuyên nghiệp (Bug Ticket: [AUTH-4092] Password Reset Endpoint Rejects Valid Special Characters)',
      'Khai báo môi trường và mức độ ưu tiên (Environment: Production, Severity: High)',
      'Các bước tuần tự để kỹ sư kiểm thử tái hiện lỗi (Steps to Reproduce: 1, 2, 3, 4)',
      'So sánh rõ ràng Actual Result vs Expected Behavior và giải pháp đề xuất (Proposed Fix)'
    ],
    recommendedVocab: [
      { word: 'Steps to reproduce', meaning: 'Các bước tuần tự để tái hiện lỗi' },
      { word: 'Expected behavior', meaning: 'Hành vi mong đợi chuẩn của hệ thống' },
      { word: 'Input sanitization', meaning: 'Làm sạch và kiểm tra dữ liệu đầu vào' },
      { word: 'Regressional defect', meaning: 'Lỗi phát sinh do mã nguồn trước đó' },
      { word: 'Unprocessable entity', meaning: 'Lỗi thực thể không thể xử lý (HTTP 422)' }
    ],
    modelAnswer: `Bug Ticket: [AUTH-4092] Password Reset Endpoint Rejects Valid Special Characters

Environment: Production (Web Client v2.4.1, Node.js API Gateway v3.1.0)
Severity: High (Affects User Account Security & Conversion)

Description:
Users attempting to update their account passwords using valid UTF-8 symbols (such as '#', '&', or '!') receive an unhandled HTTP 422 Unprocessable Entity error.

Steps to Reproduce:
1. Navigate to Account Settings > Security > Change Password.
2. Enter current valid password.
3. Enter new password containing complex special characters (e.g., 'Secret#2026!&').
4. Submit form by clicking "Save Changes".

Actual Result:
API returns HTTP 422 error with message "Invalid characters detected in payload", and the update fails completely.

Expected Behavior:
The authentication middleware should properly sanitize and accept all standard UTF-8 characters in accordance with corporate security guidelines.

Proposed Fix:
Update regex validation pattern in validators/authValidator.ts and add unit tests covering edge-case ASCII symbols.`
  },
  {
    id: 'wp_b1_1',
    title: 'Article for Student Magazine: Overcoming Procrastination While Learning English',
    type: 'Personal Note',
    category: 'Career Development',
    level: 'B1',
    minWords: 120,
    maxWords: 180,
    wordRange: '120–180 words',
    prompt: 'Viết một bài chia sẻ kinh nghiệm (120–180 từ) cho tạp chí sinh viên: Kể về thói quen trì hoãn bạn từng gặp phải khi tự học từ vựng tiếng Anh, phương pháp Pomodoro và bạn cùng tiến bạn đã áp dụng thành công để vượt qua, kết quả tiến bộ đạt được sau 3 tháng và lời khuyên truyền cảm hứng cho các bạn sinh viên khác.',
    guidelines: [
      'Mở đầu bằng vấn đề trì hoãn thực tế bạn từng gặp (struggled with severe procrastination, scrolled social media)',
      'Trình bày bước ngoặt khi áp dụng phương pháp Pomodoro chia nhỏ 25 phút học (divided study sessions, partnered with classmate)',
      'Nêu kết quả cụ thể bằng số liệu định lượng (expanded active vocabulary by 500 words, passed proficiency exam)',
      'Kết luận bằng lời khuyên sâu sắc về tính kỷ luật hàng ngày (daily consistency outperforms irregular bursts)'
    ],
    recommendedVocab: [
      { word: 'Procrastination', meaning: 'Sự trì hoãn, chần chừ' },
      { word: 'Discipline', meaning: 'Tính kỷ luật, quy củ' },
      { word: 'Manageable', meaning: 'Có thể quản lý/chia nhỏ thực hiện được' },
      { word: 'Consistency', meaning: 'Sự kiên trì, nhất quán' },
      { word: 'Breakthrough', meaning: 'Bước đột phá' }
    ],
    modelAnswer: `During my first semester at university, I constantly struggled with severe procrastination whenever I sat down to study English. Although I knew that mastering vocabulary was essential for my future career, I frequently postponed reviewing flashcards and scrolled social media instead.

The real turning point came when I discovered the Pomodoro technique and began using a digital habit tracker. Instead of forcing myself to memorize fifty words in a single exhausting evening, I divided my study sessions into twenty-five-minute focused intervals followed by short breaks. In addition, I partnered with a motivated classmate to test each other on newly learned collocations every morning.

This disciplined routine completely transformed my learning habits. Within three months, I expanded my active vocabulary by over five hundred words and passed my intermediate proficiency exam with confidence. For anyone fighting procrastination, remember that small, daily consistency always outperforms irregular bursts of effort. Start with just twenty minutes today.`
  },
  {
    id: 'wp_b1_2',
    title: 'Opinion Essay: The Benefits and Challenges of Hybrid Work for Junior Employees',
    type: 'Opinion Essay',
    category: 'Tech / Workplace',
    level: 'B1',
    minWords: 120,
    maxWords: 180,
    wordRange: '120–180 words',
    prompt: 'Viết một bài luận ngắn nêu quan điểm (120–180 từ) cho bản tin nội bộ công ty: Thảo luận về mô hình làm việc kết hợp (Hybrid Work) đối với nhân viên mới hoặc sinh viên mới ra trường. Nêu rõ quan điểm của bạn, phân tích một ưu điểm nổi bật (tiết kiệm thời gian đi lại, năng suất hơn), một thách thức cần lưu ý (khó khăn trong giao tiếp trực tiếp, thiếu kèm cặp) và đề xuất giải pháp cho doanh nghiệp.',
    guidelines: [
      'Đưa ra quan điểm rõ ràng ở đoạn mở đầu (hybrid work requires careful consideration for junior professionals)',
      'Phân tích ưu điểm về sự linh hoạt và giảm căng thẳng di chuyển (saves commuting time, eliminates travel fatigue)',
      'Chỉ ra thách thức về rào cản giao tiếp và thiếu mentorship trực tiếp (hesitate to ask questions, missing spontaneous mentorship)',
      'Đề xuất giải pháp ấn định các ngày trực tiếp để cộng tác và review thiết kế (designate specific in-office collaboration days)'
    ],
    recommendedVocab: [
      { word: 'Hybrid work model', meaning: 'Mô hình làm việc kết hợp linh hoạt' },
      { word: 'Onboarding', meaning: 'Quá trình hòa nhập và đào tạo nhân viên mới' },
      { word: 'Direct mentorship', meaning: 'Sự hướng dẫn, kèm cặp trực tiếp' },
      { word: 'Collaboration', meaning: 'Sự cộng tác làm việc nhóm' },
      { word: 'Productive', meaning: 'Năng suất, hiệu quả cao' }
    ],
    modelAnswer: `In recent years, the hybrid work model has become increasingly popular across modern technology companies. While this arrangement provides remarkable flexibility, I believe that its implementation requires careful consideration, particularly for junior professionals who are just beginning their careers.

On the one hand, working from home two days a week saves considerable commuting time and eliminates travel fatigue, allowing junior staff to allocate more energy toward focused technical tasks. Consequently, many young engineers report feeling more productive and satisfied with their overall work-life balance.

On the other hand, fully remote days can present serious communication barriers. Newly hired graduates often hesitate to ask quick questions via messaging apps, missing out on spontaneous desk conversations and direct mentorship that usually happen in physical offices.

To maximize the benefits of hybrid work, companies should designate specific in-office days for team collaboration, interactive design reviews, and pairing sessions. By striking this thoughtful balance, organizations can foster professional development while maintaining workplace flexibility.`
  }
];
