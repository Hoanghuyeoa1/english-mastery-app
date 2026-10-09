import { WritingPrompt } from '../types';

export const b2WritingLessons: WritingPrompt[] = [
  {
    id: 'wp_1',
    title: 'Pull Request Description & Technical Verification Report',
    type: 'Technical Report',
    category: 'Tech / Workplace',
    level: 'B2',
    minWords: 180,
    maxWords: 260,
    wordRange: '180–260 words',
    prompt: 'Viết mô tả kỹ thuật chi tiết cho một Pull Request trên GitHub/GitLab (180–260 từ): Tóm tắt tính năng thêm bộ nhớ đệm Redis phân tán cho endpoint hồ sơ người dùng, nguyên nhân tối ưu hóa thông lượng và giảm tải database, chi tiết triển khai kỹ thuật, các bước kiểm thử tự động, kết quả load testing và chiến lược triển khai an toàn không gây lỗi hồi quy.',
    guidelines: [
      'Tiêu đề PR rõ ràng, chuẩn mực kỹ thuật (PR Description: Implement Distributed Redis Caching...)',
      'Tóm tắt mục tiêu và động lực kỹ thuật (mitigate connection pool exhaustion, improve throughput by 65%)',
      'Chi tiết triển khai kỹ thuật (connection pooling, retry policies, cache invalidation hooks, distributed tracing)',
      'Quy trình kiểm thử và xác nhận an toàn (docker-compose, integration tests, load testing, backward compatibility)'
    ],
    recommendedVocab: [
      { word: 'Throughput', meaning: 'Thông lượng xử lý dữ liệu của hệ thống' },
      { word: 'Time-to-live (TTL)', meaning: 'Thời gian tồn tại của bản ghi trong bộ đệm' },
      { word: 'Idempotency', meaning: 'Tính bất biến của thao tác khi thực thi nhiều lần' },
      { word: 'Regression testing', meaning: 'Kiểm thử hồi quy ngăn ngừa phát sinh lỗi cũ' },
      { word: 'Backward compatibility', meaning: 'Tính tương thích ngược với các phiên bản trước' }
    ],
    modelAnswer: `PR Description: Implement Distributed Redis Caching for High-Frequency User Profile Endpoint

Summary of Changes:
This pull request introduces an in-memory Redis caching layer to the \`/api/v1/users/profile\` endpoint with a fifteen-minute Time-To-Live (TTL) configuration. By intercepting read-heavy requests prior to querying the primary PostgreSQL cluster, this optimization mitigates connection pool exhaustion and improves API throughput by approximately sixty-five percent during peak load simulation runs.

Technical Implementation:
1. Configured Redis connection pooling with automated retry policies and exponential backoff.
2. Implemented event-driven cache invalidation hooks triggered upon user profile mutations to eliminate stale data.
3. Added structured distributed tracing headers to capture cache hit and miss telemetry for observability dashboards.

Testing & Verification:
1. Bootstrapped local Redis instance via \`docker-compose up -d redis\`.
2. Executed end-to-end integration test suite via \`npm run test:integration\`, verifying all edge cases.
3. Conducted synthetic load testing using k6 with five hundred concurrent virtual users, confirming zero memory leaks.

Rollout & Safety Strategy:
The caching layer is wrapped in a dynamic feature flag, enabling instantaneous rollback without redeploying code. Verified backward compatibility with existing mobile clients. No breaking database migrations or schema alterations introduced.`
  },
  {
    id: 'wp_4',
    title: 'Software Engineer Cover Letter: High-Scale Systems Role',
    type: 'Professional Email',
    category: 'Career Development',
    level: 'B2',
    minWords: 180,
    maxWords: 260,
    wordRange: '180–260 words',
    prompt: 'Viết một lá thư ứng tuyển (Cover Letter) chuyên nghiệp gửi cho Giám đốc Kỹ thuật hoặc Hội đồng Tuyển dụng (180–260 từ): Khẳng định vị trí ứng tuyển Kỹ sư Phần mềm Cấp cao, nêu bật 4 năm kinh nghiệm xây dựng hệ thống phân tán, các thành tích định lượng nổi bật (tối ưu hóa hiệu năng 40%, cắt giảm chi phí hạ tầng), văn hóa làm việc nhóm Agile và đề xuất cơ hội phỏng vấn trực tiếp.',
    guidelines: [
      'Chào hỏi trang trọng theo chuẩn công sở (Dear Hiring Committee / VP of Engineering,)',
      'Khẳng định vị trí ứng tuyển và kỹ năng cốt lõi (TypeScript, React, Node.js, PostgreSQL)',
      'Nêu bật thành tích định lượng cụ thể (reduced API latency by 40%, cut cloud costs by 25%)',
      'Nhấn mạnh tinh thần hợp tác liên phòng ban, văn hóa review code và kèm cặp kỹ sư trẻ'
    ],
    recommendedVocab: [
      { word: 'Demonstrated track record', meaning: 'Thành tích đã được chứng minh qua thực tế' },
      { word: 'High-throughput architecture', meaning: 'Kiến trúc xử lý thông lượng cao' },
      { word: 'Cross-functional collaboration', meaning: 'Hợp tác hiệu quả giữa các phòng ban' },
      { word: 'Drive impactful solutions', meaning: 'Thúc đẩy các giải pháp mang lại giá trị lớn' },
      { word: 'Scalability bottleneck', meaning: 'Nghẽn cổ chai về khả năng mở rộng quy mô' }
    ],
    modelAnswer: `Dear Hiring Committee,

I am writing to express my strong enthusiasm for the Senior Software Engineer position at your organization. With over four years of hands-on experience designing resilient, high-throughput cloud architectures using TypeScript, React, Node.js, and PostgreSQL, I have consistently driven technical solutions that enhance platform scalability and elevate end-user experiences.

In my previous role at a fast-growing fintech startup, I spearheaded the refactoring of our core payment ingestion pipeline. By implementing Redis caching and asynchronous Kafka event streaming, our engineering team reduced API latency by forty percent while cutting cloud infrastructure costs by twenty-five percent during peak global shopping campaigns. Furthermore, I resolved critical scalability bottlenecks in our transaction database, enabling our platform to sustain three times higher transaction volumes without degradation.

Beyond technical execution, I take immense pride in fostering an inclusive engineering culture through rigorous peer code reviews and mentoring junior developers in clean code practices. I am deeply inspired by your platform mission to democratize cloud infrastructure for developers worldwide. I look forward to the opportunity to discuss how my technical expertise, problem-solving mindset, and dedication to software craftsmanship can contribute to your engineering milestones.

Sincerely,
Minh Hoang`
  },
  {
    id: 'wp_b2_1',
    title: 'Urban Planning Proposal: Integrating Green Public Spaces into High-Density Commercial Districts',
    type: 'Analytical Report',
    category: 'Science & Environment',
    level: 'B2',
    minWords: 180,
    maxWords: 260,
    wordRange: '180–260 words',
    prompt: 'Với tư cách là chuyên viên tư vấn phát triển bền vững, hãy viết một bản báo cáo phân tích và đề xuất gửi Hội đồng Thành phố (180–260 từ): Phân tích tác động tiêu cực của hiệu ứng đảo nhiệt đô thị tại các quận thương mại đông đúc, lợi ích môi trường và sức khỏe của công viên mini, đánh giá sự đánh đổi kinh tế với quỹ đất thương mại và đề xuất giải pháp chính sách kết hợp công bằng.',
    guidelines: [
      'Nêu bối cảnh suy giảm diện tích xanh và hiệu ứng đảo nhiệt đô thị (urban heat island effect)',
      'Phân tích lợi ích thực tế về chất lượng không khí, nhiệt độ và sức khỏe cộng đồng',
      'Phản biện quan điểm lo ngại mất nguồn thu thuế thương mại bằng số liệu thực tiễn',
      'Đưa ra 3 khuyến nghị chính sách cụ thể (vườn trên mái, ưu đãi thuế, tuyến phố đi bộ)'
    ],
    recommendedVocab: [
      { word: 'Urban heat island effect', meaning: 'Hiệu ứng đảo nhiệt đô thị' },
      { word: 'Public amenity', meaning: 'Tiện ích, công trình phục vụ cộng đồng' },
      { word: 'Commercial viability', meaning: 'Tính khả thi về mặt kinh tế, thương mại' },
      { word: 'Sustainable urbanization', meaning: 'Quá trình đô thị hóa bền vững' },
      { word: 'Mitigate environmental impact', meaning: 'Giảm thiểu tác động tiêu cực tới môi trường' }
    ],
    modelAnswer: `Report on Sustainable Urban Renewal: Integrating Green Spaces into Commercial Centers

Executive Context:
Rapid commercial expansion in our metropolitan core has dramatically intensified the urban heat island effect while diminishing communal recreational amenities. Asphalt surfaces and high-rise concrete structures now occupy ninety percent of downtown land, contributing to degraded air quality and elevated resident stress levels.

Environmental and Social Dividends:
Investing in accessible municipal green spaces yields quantifiable ecological and public health dividends. Pocket parks and community botanical corridors absorb particulate air pollution, lower ambient summer temperatures by up to three degrees Celsius, and provide essential gathering places that promote physical exercise and community cohesion.

Economic Trade-offs and Pragmatic Synthesis:
Critics frequently argue that allocating prime municipal land to public greenery deprives local government of lucrative commercial property taxes and retail revenues. However, international case studies demonstrate that commercial districts adjacent to well-maintained parks experience fifteen percent higher foot traffic and elevated residential property values.

Strategic Recommendations:
To harmonize economic vitality with ecological sustainability, the City Council should adopt a three-pronged policy:
1. Mandate that new commercial high-rise developments allocate at least twenty percent of roof areas to accessible green gardens.
2. Offer municipal tax credits to developers who incorporate public pedestrian courtyards.
3. Convert neglected public alleyways into interconnected pedestrian greenways.`
  },
  {
    id: 'wp_b2_2',
    title: 'Opinion Essay: Re-evaluating Standardized Testing versus Continuous Portfolio Assessment in Higher Education',
    type: 'Opinion Essay',
    category: 'Culture & Society',
    level: 'B2',
    minWords: 180,
    maxWords: 260,
    wordRange: '180–260 words',
    prompt: 'Viết bài luận nghị luận học thuật (180–260 từ) cho tạp chí giáo dục đại học: Thảo luận về cuộc tranh luận giữa phương pháp thi cử chuẩn hóa truyền thống và đánh giá năng lực liên tục qua hồ sơ học tập (portfolio). Nêu rõ quan điểm của bạn, phân tích hạn chế của việc học vẹt đối phó thi cử, lợi ích của việc đánh giá dự án thực tế và đề xuất mô hình đánh giá kết hợp toàn diện.',
    guidelines: [
      'Đưa ra luận điểm rõ ràng (standardized tests have utility but encourage superficial rote memorization)',
      'Phân tích hạn chế của các bài thi tính giờ dưới áp lực tâm lý cao đối với tư duy đổi mới',
      'Chứng minh ưu thế của portfolio dự án trong việc đo lường năng lực nghiên cứu và hợp tác',
      'Đưa ra kết luận đề xuất khung đánh giá kết hợp (blended assessment framework)'
    ],
    recommendedVocab: [
      { word: 'Standardized testing', meaning: 'Thi cử và đánh giá chuẩn hóa' },
      { word: 'Rote memorization', meaning: 'Học vẹt, ghi nhớ máy móc' },
      { word: 'Holistic evaluation', meaning: 'Đánh giá toàn diện, đa chiều' },
      { word: 'Pedagogical framework', meaning: 'Khung lý thuyết sư phạm' },
      { word: 'Critical inquiry', meaning: 'Tư duy phản biện và tinh thần truy vấn' }
    ],
    modelAnswer: `For decades, standardized written examinations have served as the predominant benchmark for measuring academic competence in higher education institutions. While proponents emphasize their administrative efficiency and objectivity, heavy reliance on timed tests often encourages superficial rote memorization rather than fostering authentic critical inquiry and problem-solving skills.

Traditional examinations measure a student's capacity to recall factual information under acute psychological stress. Unfortunately, this format fails to capture essential modern competencies such as sustained research, collaborative teamwork, iterative design, and creative synthesis. Furthermore, standardized assessments frequently disadvantage students from marginalized backgrounds who may experience test anxiety or lack access to expensive preparatory courses.

Conversely, continuous portfolio-based assessment offers a more holistic and authentic reflection of intellectual growth. By compiling capstone projects, critical essays, laboratory notebooks, and reflective self-evaluations over an entire academic term, students demonstrate practical mastery and cumulative progress. This method encourages learners to engage deeply with complex subject matter and cultivate self-directed learning habits that directly translate into workplace success.

In conclusion, rather than completely abandoning written examinations, universities should adopt a blended assessment framework. Weighting continuous project portfolios alongside concise analytical evaluations ensures rigorous academic standards while nurturing well-rounded, innovative graduates prepared for real-world complexity.`
  }
];
