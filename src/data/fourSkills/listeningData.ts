import { ListeningLesson } from './types';

export const LISTENING_LESSONS: ListeningLesson[] = [
  {
    id: 'listen_1',
    title: 'The Rise of Distributed Microservices Architecture',
    category: 'Tech',
    level: 'B2',
    duration: '3:45',
    description: 'Khám phá quá trình chuyển đổi từ khối kiến trúc nguyên khối sang hệ thống vi dịch vụ phân tán, các lợi ích về khả năng mở rộng và thách thức vận hành.',
    audioText: `In contemporary enterprise cloud engineering, microservices architecture has emerged as the preeminent paradigm for building resilient, high-throughput software platforms. Over the past decade, rapid consumer growth and escalating data volumes exposed the inherent limitations of traditional monolithic architectures. In a standard monolith, every functional component—from user authentication and product catalog search to billing and notification pipelines—is packaged into a single codebase and deployed as one rigid binary artifact. Consequently, even a minor code alteration or isolated memory leak in a non-critical module could trigger a catastrophic total system outage.

To resolve these architectural bottlenecks, forward-thinking engineering organizations decomposed complex systems into collections of autonomous, loosely coupled microservices. Each microservice encapsulates a discrete business capability, encapsulates its own independent database schema, and communicates with peer services through lightweight protocols such as RESTful HTTP APIs, gRPC, or asynchronous message streams powered by Apache Kafka and RabbitMQ. This strict encapsulation empowers autonomous feature teams to iterate, test, and deploy software updates multiple times per day without coordinating costly lockstep release windows across the entire organization.

Nevertheless, transitioning to a distributed microservices ecosystem is not without substantial operational hurdles. Decentralized architectures inevitably introduce network latency overhead, complex distributed transaction patterns, and eventual consistency challenges. When a single user interaction spans dozens of downstream remote procedure calls, diagnosing performance regressions demands sophisticated distributed tracing tools like OpenTelemetry and centralized logging aggregators. Furthermore, engineering leaders must enforce rigorous API versioning and robust circuit breaker mechanisms to prevent cascading network failures during sudden traffic spikes.`,
    sentences: [
      {
        en: 'In contemporary enterprise cloud engineering, microservices architecture has emerged as the preeminent paradigm for building resilient, high-throughput software platforms.',
        vi: 'Trong kỹ thuật đám mây doanh nghiệp đương đại, kiến trúc vi dịch vụ đã nổi lên như mô hình xuất sắc hàng đầu để xây dựng các nền tảng phần mềm bền bỉ và thông lượng cao.'
      },
      {
        en: 'Over the past decade, rapid consumer growth and escalating data volumes exposed the inherent limitations of traditional monolithic architectures.',
        vi: 'Trong thập kỷ qua, sự gia tăng nhanh chóng của người dùng và khối lượng dữ liệu leo thang đã làm bộc lộ những giới hạn cố hữu của kiến trúc nguyên khối truyền thống.'
      },
      {
        en: 'In a standard monolith, every functional component—from user authentication and product catalog search to billing and notification pipelines—is packaged into a single codebase and deployed as one rigid binary artifact.',
        vi: 'Trong một khối nguyên khối tiêu chuẩn, mọi thành phần chức năng—từ xác thực người dùng, tìm kiếm danh mục đến thanh toán và thông báo—đều được đóng gói trong một mã nguồn duy nhất và triển khai như một tệp nhị phân cứng nhắc.'
      },
      {
        en: 'Consequently, even a minor code alteration or isolated memory leak in a non-critical module could trigger a catastrophic total system outage.',
        vi: 'Hệ quả là, ngay cả một thay đổi mã nhỏ hoặc sự cố rò rỉ bộ nhớ cục bộ trong một module phụ cũng có thể gây ra sự cố sập toàn bộ hệ thống thảm khốc.'
      },
      {
        en: 'To resolve these architectural bottlenecks, forward-thinking engineering organizations decomposed complex systems into collections of autonomous, loosely coupled microservices.',
        vi: 'Để giải quyết các nút thắt cổ chai kiến trúc này, các tổ chức kỹ thuật có tư duy tiến bộ đã chia nhỏ các hệ thống phức tạp thành các tập hợp vi dịch vụ tự chủ, ghép lỏng.'
      },
      {
        en: 'Each microservice encapsulates a discrete business capability, encapsulates its own independent database schema, and communicates with peer services through lightweight protocols such as RESTful HTTP APIs, gRPC, or asynchronous message streams.',
        vi: 'Mỗi vi dịch vụ gói gọn một năng lực nghiệp vụ riêng biệt, sở hữu lược đồ cơ sở dữ liệu độc lập và giao tiếp với các dịch vụ ngang hàng qua các giao thức nhẹ như RESTful HTTP, gRPC hoặc luồng truyền tin bất đồng bộ.'
      },
      {
        en: 'This strict encapsulation empowers autonomous feature teams to iterate, test, and deploy software updates multiple times per day without coordinating costly lockstep release windows across the entire organization.',
        vi: 'Sự bao đóng nghiêm ngặt này trao quyền cho các nhóm tính năng tự chủ có thể lặp lại, kiểm thử và triển khai các bản cập nhật phần mềm nhiều lần mỗi ngày mà không cần phối hợp các đợt phát hành đồng loạt tốn kém.'
      },
      {
        en: 'Nevertheless, transitioning to a distributed microservices ecosystem is not without substantial operational hurdles.',
        vi: 'Tuy nhiên, việc chuyển đổi sang hệ sinh thái vi dịch vụ phân tán không phải là không có những rào cản vận hành đáng kể.'
      },
      {
        en: 'Decentralized architectures inevitably introduce network latency overhead, complex distributed transaction patterns, and eventual consistency challenges.',
        vi: 'Kiến trúc phi tập trung chắc chắn sẽ mang lại độ trễ mạng phát sinh, các mẫu giao dịch phân tán phức tạp và thách thức về tính nhất quán dữ liệu cuối cùng.'
      },
      {
        en: 'When a single user interaction spans dozens of downstream remote procedure calls, diagnosing performance regressions demands sophisticated distributed tracing tools like OpenTelemetry.',
        vi: 'Khi một tương tác người dùng đơn lẻ trải dài qua hàng chục lệnh gọi thủ tục từ xa phía dưới, việc chẩn đoán suy giảm hiệu năng đòi hỏi các công cụ truy vết phân tán tinh vi như OpenTelemetry.'
      },
      {
        en: 'Furthermore, engineering leaders must enforce rigorous API versioning and robust circuit breaker mechanisms to prevent cascading network failures during sudden traffic spikes.',
        vi: 'Hơn nữa, các nhà lãnh đạo kỹ thuật phải thực thi việc đánh phiên bản API nghiêm ngặt và cơ chế ngắt mạch (circuit breaker) mạnh mẽ để ngăn ngừa lỗi mạng dây chuyền khi lưu lượng tăng đột biến.'
      }
    ],
    questions: [
      {
        id: 'lq1_1',
        type: 'main_idea',
        question: 'What is the primary theme of the entire audio passage?',
        options: [
          'The historical evolution, architectural benefits, and operational complexities of transitioning from monolithic systems to microservices',
          'Why software engineers should write all programs in raw machine code rather than high-level languages',
          'A tutorial on how to install OpenTelemetry on personal desktop computers',
          'The economic costs of purchasing physical servers for data warehouses'
        ],
        correctIndex: 0,
        explanation: 'Bài nghe bao quát toàn diện sự phát triển lịch sử từ Monolith sang Microservices, các ưu điểm về tính tự chủ và khả năng mở rộng, cùng các thách thức vận hành.'
      },
      {
        id: 'lq1_2',
        type: 'vocab_context',
        question: 'In the first paragraph, the word "preeminent" is closest in meaning to:',
        options: ['Obsolete and discarded', 'Foremost and superior', 'Fragile and unstable', 'Temporary and experimental'],
        correctIndex: 1,
        explanation: '"Preeminent" có nghĩa là xuất sắc hàng đầu, vượt trội ("foremost and superior").'
      },
      {
        id: 'lq1_3',
        type: 'detail',
        question: 'According to paragraph 2, how do microservices manage their data storage?',
        options: [
          'All services must write to a single centralized text document',
          'Each microservice maintains its own independent database schema to preserve domain autonomy',
          'Databases are completely banned in microservices architecture',
          'Data is stored exclusively in physical flash memory cards'
        ],
        correctIndex: 1,
        explanation: 'Đoạn 2 nêu rõ: "encapsulates its own independent database schema" (mỗi vi dịch vụ quản lý lược đồ database độc lập).'
      },
      {
        id: 'lq1_4',
        type: 'negative_fact',
        question: 'Which of the following is NOT mentioned in the audio as a communication mechanism between microservices?',
        options: [
          'gRPC protocol',
          'RESTful HTTP APIs',
          'Asynchronous streams via Apache Kafka or RabbitMQ',
          'Physical optical disc mailing'
        ],
        correctIndex: 3,
        explanation: 'Giao tiếp được đề cập gồm RESTful APIs, gRPC, và message streams (Kafka/RabbitMQ). Việc gửi đĩa quang vật lý không hề có.'
      },
      {
        id: 'lq1_5',
        type: 'detail',
        question: 'What tool is explicitly cited for diagnosing performance regressions across distributed remote procedure calls?',
        options: ['OpenTelemetry', 'Microsoft Word', 'Windows Media Player', 'Adobe Photoshop'],
        correctIndex: 0,
        explanation: 'Đoạn cuối nêu rõ công cụ truy vết phân tán là "OpenTelemetry".'
      },
      {
        id: 'lq1_6',
        type: 'inference',
        question: 'What can be inferred about the failure of a single module in a traditional monolithic system?',
        options: [
          'It only affects the developer who wrote the line of code',
          'Because all components are bundled into one binary artifact, an isolated bug can bring down the entire application',
          'Monolithic systems fix bugs automatically without human intervention',
          'Monoliths never experience downtime under any circumstance'
        ],
        correctIndex: 1,
        explanation: 'Đoạn 1 nêu: do tất cả gói trong 1 binary artifact, lỗi cục bộ có thể dẫn đến "catastrophic total system outage" (sập toàn bộ hệ thống).'
      },
      {
        id: 'lq1_7',
        type: 'vocab_context',
        question: 'In the third paragraph, the term "cascading network failures" refers to:',
        options: [
          'Failures that cause beautiful waterfalls on screen',
          'A chain reaction where one failing service causes consecutive failures in dependent downstream services',
          'Scheduled server maintenance during national holidays',
          'Upgrading computer cables to fiber optic lines'
        ],
        correctIndex: 1,
        explanation: '"Cascading network failures" là hiện tượng lỗi dây chuyền liên hoàn (domino effect) từ dịch vụ này sang các dịch vụ phụ thuộc khác.'
      }
    ]
  },
  {
    id: 'listen_2',
    title: 'Sprint Planning & Scope Negotiation in Agile Teams',
    category: 'Workplace',
    level: 'B1',
    duration: '3:30',
    description: 'Cuộc đàm phán chiến lược giữa Tech Lead và Product Manager về việc quản lý nợ kỹ thuật, phạm vi tính năng và bảo mật hệ thống.',
    audioText: `Good morning everyone, and welcome to our sprint planning meeting for the Q3 checkout modernization epic. Over the past two weeks, the product management team conducted extensive market research and proposed an ambitious roadmap for the upcoming sprint. Specifically, the product proposal includes launching three major features: direct international credit card processing, native cryptocurrency wallet connectivity, and split-payment installment options. While these feature enhancements undoubtedly offer compelling value to our end customers, our senior engineering leads have performed a thorough capacity assessment and risk analysis.

Our technical evaluation revealed significant engineering constraints that cannot be overlooked. Integrating three separate third-party financial gateways simultaneously requires extensive security hardening, rigorous PCI-DSS compliance audits, and end-to-end sandbox stress testing. Furthermore, our current database connection pool in staging is already nearing eighty percent utilization during peak simulation runs. If we attempt to deliver all three integrations within a compressed two-week iteration, we risk introducing severe regression vulnerabilities and failing our mandatory banking compliance benchmarks.

Therefore, engineering strongly recommends a phased, risk-mitigated rollout strategy. For this upcoming sprint, we propose scoping down the release to focus exclusively on standard credit card transactions, webhook idempotency, and automated unit test coverage. By concentrating our resources on a single payment pipeline, we can ensure flawless execution, zero transaction failure rates, and robust error telemetry. Once this foundation is proven stable in our staging environment, we will seamlessly schedule cryptocurrency and installment integrations into subsequent sprints without jeopardizing platform availability.`,
    sentences: [
      {
        en: 'Good morning everyone, and welcome to our sprint planning meeting for the Q3 checkout modernization epic.',
        vi: 'Chào buổi sáng mọi người, và chào mừng các bạn đến với buổi họp lập kế hoạch sprint cho dự án hiện đại hóa quy trình thanh toán quý 3.'
      },
      {
        en: 'Over the past two weeks, the product management team conducted extensive market research and proposed an ambitious roadmap for the upcoming sprint.',
        vi: 'Trong hai tuần qua, nhóm quản lý sản phẩm đã thực hiện nghiên cứu thị trường sâu rộng và đề xuất một lộ trình đầy tham vọng cho sprint tới.'
      },
      {
        en: 'Specifically, the product proposal includes launching three major features: direct international credit card processing, native cryptocurrency wallet connectivity, and split-payment installment options.',
        vi: 'Cụ thể, đề xuất sản phẩm bao gồm việc ra mắt 3 tính năng lớn: xử lý thẻ tín dụng quốc tế trực tiếp, kết nối ví tiền điện tử và tùy chọn trả góp chia nhỏ thanh toán.'
      },
      {
        en: 'While these feature enhancements undoubtedly offer compelling value to our end customers, our senior engineering leads have performed a thorough capacity assessment and risk analysis.',
        vi: 'Mặc dù những cải tiến tính năng này chắc chắn mang lại giá trị hấp dẫn cho khách hàng, các kỹ sư trưởng của chúng tôi đã thực hiện đánh giá năng lực và phân tích rủi ro kỹ lưỡng.'
      },
      {
        en: 'Our technical evaluation revealed significant engineering constraints that cannot be overlooked.',
        vi: 'Đánh giá kỹ thuật của chúng tôi đã chỉ ra những hạn chế kỹ thuật đáng kể không thể bỏ qua.'
      },
      {
        en: 'Integrating three separate third-party financial gateways simultaneously requires extensive security hardening, rigorous PCI-DSS compliance audits, and end-to-end sandbox stress testing.',
        vi: 'Việc tích hợp cùng lúc ba cổng tài chính của bên thứ ba đòi hỏi củng cố bảo mật chuyên sâu, kiểm định tuân thủ PCI-DSS nghiêm ngặt và kiểm thử chịu tải toàn diện trên sandbox.'
      },
      {
        en: 'Furthermore, our current database connection pool in staging is already nearing eighty percent utilization during peak simulation runs.',
        vi: 'Hơn nữa, vùng kết nối cơ sở dữ liệu (connection pool) hiện tại của chúng ta trên staging đã đạt gần 80% mức sử dụng trong các đợt chạy mô phỏng cao điểm.'
      },
      {
        en: 'If we attempt to deliver all three integrations within a compressed two-week iteration, we risk introducing severe regression vulnerabilities and failing our mandatory banking compliance benchmarks.',
        vi: 'Nếu chúng ta cố gắng bàn giao cả ba tích hợp trong một chu kỳ hai tuần bị nén ngắn, chúng ta có nguy cơ gây ra các lỗ hổng hồi quy nghiêm trọng và không vượt qua các tiêu chuẩn tuân thủ ngân hàng bắt buộc.'
      },
      {
        en: 'Therefore, engineering strongly recommends a phased, risk-mitigated rollout strategy.',
        vi: 'Do đó, phía kỹ thuật đặc biệt khuyến nghị chiến lược triển khai theo từng giai đoạn để giảm thiểu rủi ro.'
      },
      {
        en: 'For this upcoming sprint, we propose scoping down the release to focus exclusively on standard credit card transactions, webhook idempotency, and automated unit test coverage.',
        vi: 'Đối với sprint sắp tới này, chúng tôi đề xuất thu hẹp phạm vi phát hành để tập trung hoàn toàn vào giao dịch thẻ tín dụng tiêu chuẩn, tính bất biến của webhook và độ bao phủ kiểm thử tự động.'
      },
      {
        en: 'By concentrating our resources on a single payment pipeline, we can ensure flawless execution, zero transaction failure rates, and robust error telemetry.',
        vi: 'Bằng cách tập trung nguồn lực vào một luồng thanh toán duy nhất, chúng ta có thể đảm bảo thực thi hoàn hảo, tỷ lệ giao dịch thất bại bằng 0 và đo đạc giám sát lỗi mạnh mẽ.'
      },
      {
        en: 'Once this foundation is proven stable in our staging environment, we will seamlessly schedule cryptocurrency and installment integrations into subsequent sprints without jeopardizing platform availability.',
        vi: 'Một khi nền tảng này được chứng minh ổn định trong môi trường staging, chúng ta sẽ lên lịch tích hợp tiền điện tử và trả góp vào các sprint tiếp theo mà không làm ảnh hưởng đến tính sẵn sàng của nền tảng.'
      }
    ],
    questions: [
      {
        id: 'lq2_1',
        type: 'main_idea',
        question: 'What is the core conflict and resolution presented in the sprint planning meeting?',
        options: [
          'The product team wanted to cancel the project, but engineers insisted on continuing',
          'Product proposed three major payment features, but engineering recommended a phased rollout focusing on credit cards first to prevent reliability and security risks',
          'The entire company decided to abandon web development and transition to hardware sales',
          'Developers demanded a two-month vacation before writing any new code'
        ],
        correctIndex: 1,
        explanation: 'Xung đột là Product muốn làm 3 tính năng cùng lúc trong 2 tuần, Kỹ thuật đề xuất thu hẹp phạm vi làm credit card trước để đảm bảo an toàn.'
      },
      {
        id: 'lq2_2',
        type: 'detail',
        question: 'What technical bottleneck was discovered regarding the staging database?',
        options: [
          'The database was accidentally deleted by an intern',
          'The database connection pool reached nearly 80% utilization during peak simulation runs',
          'The database only supported text files smaller than 10 kilobytes',
          'The database was disconnected from the internet permanently'
        ],
        correctIndex: 1,
        explanation: 'Đoạn 2 chỉ ra: database connection pool trên staging đã đạt gần 80% dung lượng trong các đợt chạy mô phỏng tải cao.'
      },
      {
        id: 'lq2_3',
        type: 'negative_fact',
        question: 'Which of the following was NOT part of the initial three features proposed by product management?',
        options: [
          'International credit card processing',
          'Native cryptocurrency wallet connectivity',
          'Split-payment installment options',
          'Biometric eye-retina scanning payments'
        ],
        correctIndex: 3,
        explanation: '3 tính năng ban đầu là thẻ tín dụng, ví crypto và trả góp. Quét võng mạc (eye-retina) không hề được nhắc đến.'
      },
      {
        id: 'lq2_4',
        type: 'vocab_context',
        question: 'In paragraph 3, the phrase "scoping down" most nearly means:',
        options: [
          'Expanding the project to hire more personnel',
          'Reducing or narrowing the features included in the immediate release',
          'Canceling the company operations entirely',
          'Purchasing larger computer monitors for developers'
        ],
        correctIndex: 1,
        explanation: '"Scoping down" nghĩa là thu hẹp hoặc giảm bớt phạm vi các tính năng trong đợt phát hành trước mắt.'
      },
      {
        id: 'lq2_5',
        type: 'inference',
        question: 'Why is PCI-DSS compliance audit essential for payment integration?',
        options: [
          'It is a mandatory financial security standard required to handle credit card transactions safely',
          'It allows developers to play video games during work hours legally',
          'It reduces the electricity bill of cloud data centers',
          'It automatically translates code into foreign languages'
        ],
        correctIndex: 0,
        explanation: 'PCI-DSS là tiêu chuẩn an ninh bắt buộc trong ngành tài chính khi xử lý và lưu trữ dữ liệu thẻ tín dụng.'
      },
      {
        id: 'lq2_6',
        type: 'detail',
        question: 'What three technical aspects will the engineering team focus on during the upcoming sprint?',
        options: [
          'Social media marketing, flyer printing, and customer support calling',
          'Standard credit card transactions, webhook idempotency, and automated unit test coverage',
          'Building video streaming servers, audio podcasts, and online games',
          'Changing company logos and redecorating office walls'
        ],
        correctIndex: 1,
        explanation: 'Kỹ sư sẽ tập trung vào: standard credit card transactions, webhook idempotency, và automated unit test coverage.'
      }
    ]
  },
  {
    id: 'listen_3',
    title: 'Cracking the Senior System Design Interview',
    category: 'Interview',
    level: 'C1',
    duration: '4:00',
    description: 'Chiến lược trả lời phỏng vấn thiết kế hệ thống chịu tải cao (High-Concurrency Architecture), phân tích đánh đổi và phục hồi thảm họa.',
    audioText: `In the upper tiers of technical recruitment, the system design interview serves as the ultimate benchmark for evaluating a candidate architectural maturity, technical breadth, and capacity for structured reasoning. Unlike coding rounds that test algorithmic precision in sandbox environments, system design evaluates how an engineer navigates ambiguous, open-ended business problems. Novice candidates frequently stumble by jumping impulsively into database table definitions or drawing premature architectural diagrams. In contrast, experienced staff engineers approach the problem methodically, establishing clear functional scope and transforming vague user requirements into quantified operational boundaries.

The first critical phase of a successful design interview is requirement clarification and back-of-the-envelope estimation. The candidate must determine the target scale: estimating daily active users, read-to-write ratios, peak queries per second, and long-term storage requirements. These calculations dictate fundamental architectural choices: whether the system requires an in-memory caching tier with Redis, horizontal database sharding, or asynchronous message buffering. Furthermore, candidates must explicitly define non-functional requirements such as availability targets, data durability guarantees, and acceptable latency percentiles at the ninety-ninth tier.

Once the high-level architecture is established, the interviewer will typically stress-test the design by introducing failure scenarios and traffic bottlenecks. This is where distinguished candidates excel by articulating pragmatic trade-offs rather than claiming an unrealistic perfect solution. They delve into data consistency models, explaining when to favor eventual consistency over strong ACID transactions according to the CAP theorem. They demonstrate mastery over load balancing algorithms, database replication lag mitigation, and circuit breaker patterns. Most importantly, they proactively address single points of failure, outlining disaster recovery protocols and multi-region failover strategies.`,
    sentences: [
      {
        en: 'In the upper tiers of technical recruitment, the system design interview serves as the ultimate benchmark for evaluating a candidate architectural maturity, technical breadth, and capacity for structured reasoning.',
        vi: 'Ở các cấp bậc tuyển dụng kỹ thuật cao cấp, buổi phỏng vấn thiết kế hệ thống đóng vai trò là thước đo tối thượng để đánh giá độ chín muồi về kiến trúc, bề rộng kỹ thuật và năng lực suy luận có cấu trúc của ứng viên.'
      },
      {
        en: 'Unlike coding rounds that test algorithmic precision in sandbox environments, system design evaluates how an engineer navigates ambiguous, open-ended business problems.',
        vi: 'Khác với các vòng viết code kiểm tra độ chính xác thuật toán trong môi trường hộp cát, thiết kế hệ thống đánh giá cách kỹ sư điều hướng qua các bài toán nghiệp vụ mở và mơ hồ.'
      },
      {
        en: 'Novice candidates frequently stumble by jumping impulsively into database table definitions or drawing premature architectural diagrams.',
        vi: 'Các ứng viên chưa có nhiều kinh nghiệm thường vấp ngã do hấp tấp nhảy ngay vào định nghĩa bảng cơ sở dữ liệu hoặc vẽ sơ đồ kiến trúc quá sớm.'
      },
      {
        en: 'In contrast, experienced staff engineers approach the problem methodically, establishing clear functional scope and transforming vague user requirements into quantified operational boundaries.',
        vi: 'Ngược lại, các kỹ sư giàu kinh nghiệm tiếp cận vấn đề một cách có phương pháp, thiết lập phạm vi chức năng rõ ràng và chuyển đổi các yêu cầu mơ hồ thành các ranh giới vận hành đã được định lượng.'
      },
      {
        en: 'The first critical phase of a successful design interview is requirement clarification and back-of-the-envelope estimation.',
        vi: 'Giai đoạn then chốt đầu tiên của một buổi phỏng vấn thiết kế thành công là làm rõ yêu cầu và ước tính nhanh trên giấy (back-of-the-envelope estimation).'
      },
      {
        en: 'The candidate must determine the target scale: estimating daily active users, read-to-write ratios, peak queries per second, and long-term storage requirements.',
        vi: 'Ứng viên phải xác định quy mô mục tiêu: ước tính người dùng hoạt động hàng ngày, tỷ lệ đọc/ghi, số truy vấn đỉnh mỗi giây và yêu cầu lưu trữ dài hạn.'
      },
      {
        en: 'These calculations dictate fundamental architectural choices: whether the system requires an in-memory caching tier with Redis, horizontal database sharding, or asynchronous message buffering.',
        vi: 'Những tính toán này quyết định các lựa chọn kiến trúc cốt lõi: liệu hệ thống có cần tầng bộ nhớ đệm trong RAM với Redis, phân mảnh cơ sở dữ liệu theo chiều ngang hay bộ đệm tin nhắn bất đồng bộ.'
      },
      {
        en: 'Furthermore, candidates must explicitly define non-functional requirements such as availability targets, data durability guarantees, and acceptable latency percentiles at the ninety-ninth tier.',
        vi: 'Hơn nữa, ứng viên phải định nghĩa rõ ràng các yêu cầu phi chức năng như mục tiêu tính sẵn sàng, đảm bảo độ bền dữ liệu và các phân vị độ trễ chấp nhận được ở mức 99% (P99).'
      },
      {
        en: 'Once the high-level architecture is established, the interviewer will typically stress-test the design by introducing failure scenarios and traffic bottlenecks.',
        vi: 'Một khi kiến trúc cấp cao đã được thiết lập, người phỏng vấn thường sẽ kiểm tra độ chịu tải của thiết kế bằng cách đưa ra các kịch bản sự cố và các nút thắt cổ chai về lưu lượng.'
      },
      {
        en: 'This is where distinguished candidates excel by articulating pragmatic trade-offs rather than claiming an unrealistic perfect solution.',
        vi: 'Đây là lúc các ứng viên xuất sắc tỏa sáng bằng cách trình bày các đánh đổi thực tế thay vì khẳng định một giải pháp hoàn hảo thiếu thực tế.'
      },
      {
        en: 'They delve into data consistency models, explaining when to favor eventual consistency over strong ACID transactions according to the CAP theorem.',
        vi: 'Họ đi sâu vào các mô hình nhất quán dữ liệu, giải thích khi nào nên ưu tiên tính nhất quán cuối cùng hơn các giao dịch ACID mạnh mẽ theo định lý CAP.'
      },
      {
        en: 'Most importantly, they proactively address single points of failure, outlining disaster recovery protocols and multi-region failover strategies.',
        vi: 'Quan trọng nhất, họ chủ động xử lý các điểm chết đơn lẻ (SPOF), vạch ra các quy trình phục hồi thảm họa và chiến lược chuyển vùng dự phòng đa khu vực.'
      }
    ],
    questions: [
      {
        id: 'lq3_1',
        type: 'main_idea',
        question: 'What is the core focus of the system design interview according to the passage?',
        options: [
          'Testing whether a candidate can memorize raw syntax without using an IDE',
          'Evaluating how an engineer methodically clarifies scope, quantifies non-functional metrics, and analyzes architectural trade-offs under scale',
          'Checking if a candidate knows how to assemble physical desktop computer motherboards',
          'Determining whether a candidate prefers dark mode or light mode in code editors'
        ],
        correctIndex: 1,
        explanation: 'Phỏng vấn thiết kế hệ thống đánh giá khả năng làm rõ phạm vi, định lượng chỉ số phi chức năng và phân tích các đánh đổi kiến trúc thực tế.'
      },
      {
        id: 'lq3_2',
        type: 'detail',
        question: 'What is a common mistake made by novice candidates mentioned in paragraph 1?',
        options: [
          'Asking too many clarifying questions about the business domain',
          'Jumping impulsively into database table schemas or drawing premature diagrams without establishing requirements',
          'Refusing to speak in English during the interview',
          'Demanding stock options before answering questions'
        ],
        correctIndex: 1,
        explanation: 'Ứng viên non kinh nghiệm thường nhảy vội vào định nghĩa bảng DB hoặc vẽ sơ đồ trước khi làm rõ yêu cầu.'
      },
      {
        id: 'lq3_3',
        type: 'vocab_context',
        question: 'The term "back-of-the-envelope estimation" refers to:',
        options: [
          'Sending handwritten letters to the hiring committee',
          'Rough, rapid mathematical calculations of system scale, storage, and throughput on scratch paper',
          'Printing architecture blueprints on mailing envelopes',
          'Calculating post office delivery postage fees'
        ],
        correctIndex: 1,
        explanation: '"Back-of-the-envelope estimation" là phép tính toán ước tính nhanh quy mô, RAM, ổ cứng và QPS trên giấy nháp.'
      },
      {
        id: 'lq3_4',
        type: 'negative_fact',
        question: 'Which of the following is NOT listed as a metric to calculate during the estimation phase?',
        options: [
          'Daily active users (DAU)',
          'Read-to-write ratios and peak QPS',
          'Long-term storage volume',
          'The physical height and shoe size of database administrators'
        ],
        correctIndex: 3,
        explanation: 'Các chỉ số cần tính gồm DAU, tỷ lệ đọc/ghi, QPS đỉnh và dung lượng lưu trữ. Chiều cao của DBA là phương án phi lý.'
      },
      {
        id: 'lq3_5',
        type: 'inference',
        question: 'According to the speaker, why should candidates avoid claiming their design is "flawless"?',
        options: [
          'Because interviewers dislike confident engineers',
          'Because in real-world distributed systems, every architecture involves trade-offs between consistency, availability, latency, and operational cost',
          'Because flawed designs are cheaper to build in cloud environments',
          'Because software engineering does not use computers in production'
        ],
        correctIndex: 1,
        explanation: 'Trong hệ thống phân tán thực tế, mọi kiến trúc đều là sự đánh đổi (trade-offs) giữa CAP theorem, chi phí và độ trễ.'
      },
      {
        id: 'lq3_6',
        type: 'detail',
        question: 'What theorem is cited when discussing eventual consistency versus strong ACID transactions?',
        options: ['Pythagorean Theorem', 'CAP Theorem', 'Newtonian Gravity Law', 'Heisenberg Uncertainty Principle'],
        correctIndex: 1,
        explanation: 'Đoạn cuối nhắc đến Định lý CAP ("according to the CAP theorem").'
      }
    ]
  },
  {
    id: 'listen_4',
    title: 'Clean Code Principles & Pragmatic Refactoring Patterns',
    category: 'Tech',
    level: 'B1',
    duration: '3:20',
    description: 'Nghệ thuật viết mã sạch, quy tắc Single Responsibility, đặt tên biến tự giải thích và cách tái cấu trúc an toàn với kiểm thử tự động.',
    audioText: `Writing clean code is fundamentally an act of professional empathy toward the future engineers who will maintain, debug, and expand your software. In fast-moving technology companies, developers spend far more time reading, comprehending, and navigating existing codebases than writing brand new implementations from scratch. When source code is cluttered with cryptic single-letter variable names, convoluted nested conditionals, and monolithic functions exceeding hundreds of lines, developer productivity plummets while bug discovery cycles multiply dramatically.

To combat technical entropy, software craftsmanship emphasizes core principles such as the Single Responsibility Principle. Every function, module, and class should have one clear reason to change and perform a single well-defined task with utmost clarity. Furthermore, engineers should choose self-describing identifiers that communicate domain intent rather than algorithmic implementation quirks. For instance, naming a variable \`activeSubscriptionExpirationDate\` immediately communicates business context, whereas naming it \`d2\` forces future engineers to decipher its purpose by scanning surrounding execution contexts.

When undertaking refactoring on legacy systems, developers must establish an automated testing harness before modifying any production code. Writing comprehensive unit and regression tests ensures that the existing system behaviors are codified and safeguarded. Once this safety net is in place, developers can fearlessly decompose bloated functions, eliminate code duplication, and replace hardcoded literals with clean abstractions. Continuous, small-scale refactoring prevents technical debt from accumulating, keeping the codebase evergreen, readable, and adaptable to evolving business requirements.`,
    sentences: [
      {
        en: 'Writing clean code is fundamentally an act of professional empathy toward the future engineers who will maintain, debug, and expand your software.',
        vi: 'Viết mã sạch về cơ bản là một hành động thấu cảm chuyên nghiệp đối với những kỹ sư tương lai, những người sẽ bảo trì, sửa lỗi và mở rộng phần mềm của bạn.'
      },
      {
        en: 'In fast-moving technology companies, developers spend far more time reading, comprehending, and navigating existing codebases than writing brand new implementations from scratch.',
        vi: 'Tại các công ty công nghệ phát triển nhanh, các lập trình viên dành nhiều thời gian hơn để đọc, hiểu và điều hướng mã nguồn hiện có so với việc viết các triển khai hoàn toàn mới từ đầu.'
      },
      {
        en: 'When source code is cluttered with cryptic single-letter variable names, convoluted nested conditionals, and monolithic functions exceeding hundreds of lines, developer productivity plummets while bug discovery cycles multiply dramatically.',
        vi: 'Khi mã nguồn bị bừa bộn với các tên biến một chữ cái khó hiểu, các điều kiện lồng nhau phức tạp và các hàm nguyên khối dài hàng trăm dòng, năng suất của lập trình viên giảm mạnh trong khi chu kỳ phát hiện lỗi tăng lên đáng kể.'
      },
      {
        en: 'To combat technical entropy, software craftsmanship emphasizes core principles such as the Single Responsibility Principle.',
        vi: 'Để chống lại sự hỗn loạn kỹ thuật (technical entropy), nghệ thuật lập trình nhấn mạnh các nguyên lý cốt lõi như Nguyên lý Đơn nhiệm (Single Responsibility Principle).'
      },
      {
        en: 'Every function, module, and class should have one clear reason to change and perform a single well-defined task with utmost clarity.',
        vi: 'Mỗi hàm, module và lớp phải có một lý do duy nhất rõ ràng để thay đổi và thực hiện một nhiệm vụ đơn lẻ được xác định rõ ràng với sự minh bạch tuyệt đối.'
      },
      {
        en: 'Furthermore, engineers should choose self-describing identifiers that communicate domain intent rather than algorithmic implementation quirks.',
        vi: 'Hơn nữa, các kỹ sư nên chọn các định danh tự mô tả truyền tải ý định nghiệp vụ thay vì các mẹo vặt triển khai thuật toán.'
      },
      {
        en: 'For instance, naming a variable activeSubscriptionExpirationDate immediately communicates business context, whereas naming it d2 forces future engineers to decipher its purpose by scanning surrounding execution contexts.',
        vi: 'Ví dụ, việc đặt tên biến là activeSubscriptionExpirationDate ngay lập tức truyền tải ngữ cảnh kinh doanh, trong khi đặt tên là d2 buộc các kỹ sư tương lai phải giải mã mục đích của nó bằng cách quét các ngữ cảnh thực thi xung quanh.'
      },
      {
        en: 'When undertaking refactoring on legacy systems, developers must establish an automated testing harness before modifying any production code.',
        vi: 'Khi thực hiện tái cấu trúc trên các hệ thống cũ, các lập trình viên phải thiết lập một bộ khung kiểm thử tự động trước khi sửa đổi bất kỳ mã nguồn chính thức nào.'
      },
      {
        en: 'Writing comprehensive unit and regression tests ensures that the existing system behaviors are codified and safeguarded.',
        vi: 'Việc viết các bài kiểm thử đơn vị và kiểm thử hồi quy toàn diện đảm bảo rằng các hành vi hiện tại của hệ thống được mã hóa và bảo vệ an toàn.'
      },
      {
        en: 'Once this safety net is in place, developers can fearlessly decompose bloated functions, eliminate code duplication, and replace hardcoded literals with clean abstractions.',
        vi: 'Một khi tấm lưới an toàn này đã sẵn sàng, các lập trình viên có thể tự tin chia nhỏ các hàm phình to, loại bỏ sự trùng lặp mã và thay thế các giá trị cố định bằng các trừu tượng hóa sạch sẽ.'
      },
      {
        en: 'Continuous, small-scale refactoring prevents technical debt from accumulating, keeping the codebase evergreen, readable, and adaptable to evolving business requirements.',
        vi: 'Việc tái cấu trúc liên tục ở quy mô nhỏ giúp ngăn ngừa nợ kỹ thuật tích tụ, giữ cho codebase luôn tươi mới, dễ đọc và dễ thích ứng với các yêu cầu nghiệp vụ ngày càng phát triển.'
      }
    ],
    questions: [
      {
        id: 'lq4_1',
        type: 'main_idea',
        question: 'What is the main argument regarding clean code in this passage?',
        options: [
          'Clean code is purely aesthetic and has no impact on business performance',
          'Clean code is an act of empathy that enhances readability, prevents technical debt, and requires automated tests for safe refactoring',
          'Developers should rewrite entire systems every month rather than refactoring',
          'Single-letter variable names are faster to execute in modern processors'
        ],
        correctIndex: 1,
        explanation: 'Ý chính: Viết mã sạch là hành động thấu cảm giúp nâng cao khả năng đọc hiểu, ngăn ngừa nợ kỹ thuật và cần kiểm thử tự động để refactor an toàn.'
      },
      {
        id: 'lq4_2',
        type: 'detail',
        question: 'According to paragraph 1, how do developers spend the majority of their time in technology companies?',
        options: [
          'Playing computer games in the cafeteria',
          'Reading, comprehending, and navigating existing code rather than writing new code from scratch',
          'Attending administrative non-technical meetings exclusively',
          'Designing graphic marketing posters for the sales team'
        ],
        correctIndex: 1,
        explanation: 'Đoạn 1 nêu: lập trình viên dành phần lớn thời gian đọc, hiểu và duyệt mã hiện có hơn là viết mới từ đầu.'
      },
      {
        id: 'lq4_3',
        type: 'vocab_context',
        question: 'In paragraph 2, the word "self-describing" is used to describe variable names that:',
        options: [
          'Change their names automatically when the program runs',
          'Clearly express their business purpose and intent without requiring extra explanation',
          'Are written in ancient Greek characters',
          'Contain exactly three syllables'
        ],
        correctIndex: 1,
        explanation: '"Self-describing" có nghĩa là tự giải thích, thể hiện rõ mục đích nghiệp vụ của biến mà không cần tra cứu thêm.'
      },
      {
        id: 'lq4_4',
        type: 'negative_fact',
        question: 'Which of the following is NOT described as a symptom of poorly written code?',
        options: [
          'Cryptic single-letter variable names',
          'Convoluted nested conditional statements',
          'Monolithic functions exceeding hundreds of lines',
          'Having comprehensive automated unit test coverage'
        ],
        correctIndex: 3,
        explanation: 'Có kiểm thử tự động toàn diện là dấu hiệu của mã chất lượng tốt, không phải triệu chứng của mã bẩn.'
      },
      {
        id: 'lq4_5',
        type: 'inference',
        question: 'Why does the author advocate establishing an automated test harness before refactoring legacy code?',
        options: [
          'To prove to management that the computer is turned on',
          'To serve as a safety net that guarantees existing functionality is not broken by structural changes',
          'Because compilers refuse to run refactored code without tests',
          'To increase the file size of the project repository'
        ],
        correctIndex: 1,
        explanation: 'Kiểm thử đóng vai trò như tấm lưới an toàn (safety net) đảm bảo việc sửa cấu trúc không làm hỏng tính năng đang chạy.'
      },
      {
        id: 'lq4_6',
        type: 'detail',
        question: 'What is the core definition of the Single Responsibility Principle given in the text?',
        options: [
          'Every developer must work on only one computer',
          'Every function, module, and class should have one clear reason to change and do a single well-defined task',
          'A company should have only one manager',
          'Every application must run on a single server CPU'
        ],
        correctIndex: 1,
        explanation: 'Nguyên lý Single Responsibility quy định: mỗi hàm/lớp chỉ có 1 lý do duy nhất để thay đổi và làm 1 nhiệm vụ rõ ràng.'
      }
    ]
  }
];
