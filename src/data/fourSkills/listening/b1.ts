import { ListeningLesson } from '../types';

export const b1ListeningLessons: ListeningLesson[] = [
  {
    id: 'listen_2',
    title: 'Sprint Planning & Scope Negotiation in Agile Teams',
    category: 'Workplace',
    format: 'Presentation',
    level: 'B1',
    duration: '3:45',
    description: 'Cuộc đàm phán chiến lược giữa Tech Lead và Product Manager về việc quản lý nợ kỹ thuật, phạm vi tính năng và bảo mật hệ thống.',
    audioText: `Good morning everyone, and welcome to our sprint planning meeting for the Q3 checkout modernization epic. Over the past two weeks, the product management team conducted extensive market research and proposed an ambitious roadmap for the upcoming sprint. Specifically, the product proposal includes launching three major features: direct international credit card processing, native cryptocurrency wallet connectivity, and split-payment installment options. While these feature enhancements undoubtedly offer compelling value to our end customers, our senior engineering leads have performed a thorough capacity assessment and risk analysis.

Our technical evaluation revealed significant engineering constraints that cannot be overlooked. Integrating three separate third-party financial gateways simultaneously requires extensive security hardening, rigorous PCI-DSS compliance audits, and end-to-end sandbox stress testing. Furthermore, our current database connection pool in staging is already nearing eighty percent utilization during peak simulation runs. If we attempt to deliver all three integrations within a compressed two-week iteration, we risk introducing severe regression vulnerabilities and failing our mandatory banking compliance benchmarks.

Therefore, engineering strongly recommends a phased, risk-mitigated rollout strategy. For this upcoming sprint, we propose scoping down the release to focus exclusively on standard credit card transactions, webhook idempotency, and automated unit test coverage. By concentrating our resources on a single payment pipeline, we can ensure flawless execution, zero transaction failure rates, and robust error telemetry. Once this foundation is proven stable in our staging environment, we will seamlessly schedule cryptocurrency and installment integrations into subsequent sprints without jeopardizing platform availability.

In response, the product manager acknowledged the infrastructure risks and requested clarification on the expected timeline. The tech lead explained that dedicating the first sprint to core card checkout allows the QA team to establish end-to-end regression pipelines without rushing. Once the primary card gateway processes real payments with sub-second response times, the engineering team can introduce cryptocurrency wallets in sprint four and installment payments in sprint five. Both departments agreed that preserving platform stability and customer trust is vastly more important than prematurely delivering unverified payment methods. Additionally, the team scheduled daily fifteen-minute standup syncs with the security compliance officer to review code merge requests in real time, ensuring a sustainable balance between commercial velocity and architectural integrity.`,
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
      },
      {
        en: 'In response, the product manager acknowledged the infrastructure risks and requested clarification on the expected timeline.',
        vi: 'Đáp lại, giám đốc sản phẩm ghi nhận các rủi ro hạ tầng và yêu cầu làm rõ thêm về mốc thời gian kỳ vọng.'
      },
      {
        en: 'The tech lead explained that dedicating the first sprint to core card checkout allows the QA team to establish end-to-end regression pipelines without rushing.',
        vi: 'Trưởng nhóm kỹ thuật giải thích rằng việc dành trọn sprint đầu cho thanh toán thẻ cốt lõi giúp đội ngũ kiểm thử thiết lập luồng kiểm thử hồi quy toàn diện mà không bị gấp gáp.'
      },
      {
        en: 'Once the primary card gateway processes real payments with sub-second response times, the engineering team can introduce cryptocurrency wallets in sprint four and installment payments in sprint five.',
        vi: 'Khi cổng thẻ chính xử lý giao dịch thực tế với thời gian phản hồi dưới một giây, đội ngũ kỹ thuật có thể tích hợp ví tiền điện tử ở sprint 4 và thanh toán trả góp ở sprint 5.'
      },
      {
        en: 'Both departments agreed that preserving platform stability and customer trust is vastly more important than prematurely delivering unverified payment methods.',
        vi: 'Cả hai phòng ban đều nhất trí rằng việc bảo vệ sự ổn định của nền tảng và niềm tin của khách hàng quan trọng hơn nhiều so với việc vội vã tung ra các phương thức thanh toán chưa được kiểm chứng.'
      },
      {
        en: 'Additionally, the team scheduled daily fifteen-minute standup syncs with the security compliance officer to review code merge requests in real time, ensuring a sustainable balance between commercial velocity and architectural integrity.',
        vi: 'Ngoài ra, nhóm đã lên lịch các buổi họp nhanh 15 phút hàng ngày với cán bộ phụ trách tuân thủ an ninh để rà soát các yêu cầu gộp mã theo thời gian thực, đảm bảo cân bằng bền vững giữa tốc độ thương mại và tính toàn vẹn kiến trúc.'
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
    id: 'listen_4',
    title: 'Clean Code Principles & Pragmatic Refactoring Patterns',
    category: 'Tech',
    format: 'Presentation',
    level: 'B1',
    duration: '3:45',
    description: 'Nghệ thuật viết mã sạch, quy tắc Single Responsibility, đặt tên biến tự giải thích và cách tái cấu trúc an toàn với kiểm thử tự động.',
    audioText: `Writing clean code is fundamentally an act of professional empathy toward the future engineers who will maintain, debug, and expand your software. In fast-moving technology companies, developers spend far more time reading, comprehending, and navigating existing codebases than writing brand new implementations from scratch. When source code is cluttered with cryptic single-letter variable names, convoluted nested conditionals, and monolithic functions exceeding hundreds of lines, developer productivity plummets while bug discovery cycles multiply dramatically.

To combat technical entropy, software craftsmanship emphasizes core principles such as the Single Responsibility Principle. Every function, module, and class should have one clear reason to change and perform a single well-defined task with utmost clarity. Furthermore, engineers should choose self-describing identifiers that communicate domain intent rather than algorithmic implementation quirks. For instance, naming a variable activeSubscriptionExpirationDate immediately communicates business context, whereas naming it d2 forces future engineers to decipher its purpose by scanning surrounding execution contexts.

When undertaking refactoring on legacy systems, developers must establish an automated testing harness before modifying any production code. Writing comprehensive unit and regression tests ensures that the existing system behaviors are codified and safeguarded. Once this safety net is in place, developers can fearlessly decompose bloated functions, eliminate code duplication, and replace hardcoded literals with clean abstractions. Continuous, small-scale refactoring prevents technical debt from accumulating, keeping the codebase evergreen, readable, and adaptable to evolving business requirements.

Beyond automated testing and naming conventions, clean code relies heavily on the principle of keeping functions small and focused on a single level of abstraction. When high-level business orchestration logic is mixed with low-level string manipulation or raw database queries, understanding the code becomes unnecessarily burdensome. Seasoned architects recommend separating domain rules from infrastructure concerns through well-defined interface contracts. This architectural discipline not only simplifies unit testing through dependency injection, but also allows developers to replace database drivers or external notification providers without altering business rules.

Finally, clean code is cultivated through constructive peer code reviews. When team members review pull requests with an emphasis on clarity and maintainability rather than personal styling preferences, knowledge is shared organically across the entire engineering organization. Over time, this collective dedication to code hygiene establishes a sustainable development pace, enabling technology teams to ship features rapidly without accumulating unmanageable technical debt.`,
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
      },
      {
        en: 'Beyond automated testing and naming conventions, clean code relies heavily on the principle of keeping functions small and focused on a single level of abstraction.',
        vi: 'Bên cạnh kiểm thử tự động và quy ước đặt tên, mã sạch dựa rất nhiều vào nguyên tắc giữ cho các hàm nhỏ gọn và tập trung vào một mức trừu tượng duy nhất.'
      },
      {
        en: 'When high-level business orchestration logic is mixed with low-level string manipulation or raw database queries, understanding the code becomes unnecessarily burdensome.',
        vi: 'Khi logic điều phối nghiệp vụ cấp cao bị trộn lẫn với thao tác chuỗi cấp thấp hoặc truy vấn cơ sở dữ liệu thô, việc hiểu mã nguồn sẽ trở nên vô cùng nặng nề.'
      },
      {
        en: 'Seasoned architects recommend separating domain rules from infrastructure concerns through well-defined interface contracts.',
        vi: 'Các kiến trúc sư kỳ cựu khuyên nên tách biệt các quy tắc nghiệp vụ khỏi các mối bận tâm về hạ tầng thông qua các hợp đồng giao diện được xác định rõ ràng.'
      },
      {
        en: 'This architectural discipline not only simplifies unit testing through dependency injection, but also allows developers to replace database drivers or external notification providers without altering business rules.',
        vi: 'Kỷ luật kiến trúc này không chỉ đơn giản hóa kiểm thử đơn vị thông qua tiêm phụ thuộc (dependency injection), mà còn cho phép các nhà phát triển thay thế trình điều khiển cơ sở dữ liệu hoặc nhà cung cấp thông báo bên ngoài mà không làm thay đổi các quy tắc nghiệp vụ.'
      },
      {
        en: 'Finally, clean code is cultivated through constructive peer code reviews.',
        vi: 'Cuối cùng, mã sạch được bồi đắp thông qua các buổi đánh giá chéo mã nguồn mang tính xây dựng.'
      },
      {
        en: 'When team members review pull requests with an emphasis on clarity and maintainability rather than personal styling preferences, knowledge is shared organically across the entire engineering organization.',
        vi: 'Khi các thành viên trong nhóm đánh giá yêu cầu gộp mã với trọng tâm là sự rõ ràng và khả năng bảo trì thay vì sở thích định dạng cá nhân, tri thức sẽ được chia sẻ một cách tự nhiên trong toàn bộ tổ chức kỹ thuật.'
      },
      {
        en: 'Over time, this collective dedication to code hygiene establishes a sustainable development pace, enabling technology teams to ship features rapidly without accumulating unmanageable technical debt.',
        vi: 'Theo thời gian, sự cống hiến tập thể này cho việc giữ gìn mã sạch sẽ thiết lập một tốc độ phát triển bền vững, cho phép các nhóm công nghệ bàn giao tính năng nhanh chóng mà không tích tụ nợ kỹ thuật không thể kiểm soát.'
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
  },
  {
    id: 'listen_b1_1',
    title: 'Academic Advising: Study Abroad and Degree Credit Transfer',
    category: 'Education',
    format: 'Dialogue',
    level: 'B1',
    duration: '3:45',
    description: 'Buổi tư vấn học thuật giữa cố vấn khoa và sinh viên năm ba về chương trình trao đổi quốc tế, chuyển đổi tín chỉ và chuẩn bị hồ sơ.',
    audioText: `Dr. Harrison: Welcome Maya, please take a seat. I received your email regarding the proposed semester abroad program at Melbourne University for your upcoming junior year. How can I help you plan this transition?
Maya: Thank you Dr. Harrison. I am really enthusiastic about studying environmental science overseas, but I am quite anxious about whether the academic credits will transfer back toward my core graduation requirements here.
Dr. Harrison: That is a very reasonable concern. Many students assume that all international courses automatically count toward their degree, but that is not always the case. To guarantee full credit equivalency, you must submit detailed course syllabi for academic pre-approval at least three months prior to departure. Our departmental curriculum committee evaluates the learning outcomes, textbook selections, and lecture hours of each host university subject.
Maya: I see. What happens if an overseas syllabus does not completely match our curriculum here?
Dr. Harrison: If a course only partially aligns, it might be classified as a general elective credit rather than fulfilling a mandatory core requirement. For instance, the Marine Conservation seminar in Melbourne looks exceptional, but you still need to ensure you fulfill all prerequisite introductory courses in statistics before they admit you into their laboratory sessions.
Maya: Fortunately, I have already completed Advanced Biostatistics with an A minus last term. Another factor I wanted to ask about is language and accommodation. Will the international office assist exchange students with finding student housing on campus?
Dr. Harrison: Yes, Melbourne provides dedicated dormitories for international cohorts, provided you submit your housing deposit before the June deadline. Additionally, you will participate in a mandatory one-week cultural orientation before regular academic lectures begin. My key recommendation today is to balance your study load wisely—do not register for more than four intensive modules, because adapting to a foreign educational culture and independent lifestyle takes considerable energy during the first month.
Maya: Thank you so much for the clear advice, Dr. Harrison. I will gather the official syllabi this weekend and book a follow-up appointment with you next Tuesday.
Dr. Harrison: You are very welcome, Maya. Best of luck with your preparations!`,
    sentences: [
      {
        speaker: 'Dr. Harrison',
        en: 'Welcome Maya, please take a seat.',
        vi: 'Chào mừng Maya, mời em ngồi.'
      },
      {
        speaker: 'Dr. Harrison',
        en: 'I received your email regarding the proposed semester abroad program at Melbourne University for your upcoming junior year.',
        vi: 'Thầy đã nhận được email của em về đề xuất chương trình học kỳ trao đổi tại Đại học Melbourne cho năm thứ ba sắp tới.'
      },
      {
        speaker: 'Dr. Harrison',
        en: 'How can I help you plan this transition?',
        vi: 'Thầy có thể hỗ trợ em lên kế hoạch cho quá trình chuyển đổi này như thế nào?'
      },
      {
        speaker: 'Maya',
        en: 'Thank you Dr. Harrison. I am really enthusiastic about studying environmental science overseas, but I am quite anxious about whether the academic credits will transfer back toward my core graduation requirements here.',
        vi: 'Em cảm ơn thầy Harrison. Em rất hào hứng với việc học ngành khoa học môi trường ở nước ngoài, nhưng em khá lo lắng về việc liệu các tín chỉ học thuật có được chuyển đổi về để tính vào các môn tốt nghiệp cốt lõi ở trường mình hay không.'
      },
      {
        speaker: 'Dr. Harrison',
        en: 'That is a very reasonable concern. Many students assume that all international courses automatically count toward their degree, but that is not always the case.',
        vi: 'Đó là một mối bận tâm rất hợp lý. Nhiều sinh viên cho rằng mọi môn học quốc tế đều tự động được tính vào bằng cấp, nhưng không phải lúc nào cũng như vậy.'
      },
      {
        speaker: 'Dr. Harrison',
        en: 'To guarantee full credit equivalency, you must submit detailed course syllabi for academic pre-approval at least three months prior to departure.',
        vi: 'Để đảm bảo việc quy đổi tín chỉ đầy đủ tương đương, em phải nộp đề cương chi tiết môn học để phê duyệt trước ít nhất ba tháng trước khi khởi hành.'
      },
      {
        speaker: 'Dr. Harrison',
        en: 'Our departmental curriculum committee evaluates the learning outcomes, textbook selections, and lecture hours of each host university subject.',
        vi: 'Hội đồng chương trình giảng dạy của khoa chúng ta sẽ đánh giá chuẩn đầu ra, sách giáo trình được lựa chọn và số giờ giảng dạy của từng môn học tại trường tiếp nhận.'
      },
      {
        speaker: 'Maya',
        en: 'I see. What happens if an overseas syllabus does not completely match our curriculum here?',
        vi: 'Em hiểu rồi ạ. Vậy điều gì sẽ xảy ra nếu một đề cương môn học ở nước ngoài không hoàn toàn khớp với khung chương trình ở đây ạ?'
      },
      {
        speaker: 'Dr. Harrison',
        en: 'If a course only partially aligns, it might be classified as a general elective credit rather than fulfilling a mandatory core requirement.',
        vi: 'Nếu một môn học chỉ tương thích một phần, nó có thể được xếp vào diện tín chỉ tự chọn đại cương thay vì đáp ứng một môn bắt buộc cốt lõi.'
      },
      {
        speaker: 'Dr. Harrison',
        en: 'For instance, the Marine Conservation seminar in Melbourne looks exceptional, but you still need to ensure you fulfill all prerequisite introductory courses in statistics before they admit you into their laboratory sessions.',
        vi: 'Ví dụ, chuyên đề Bảo tồn Biển ở Melbourne trông rất xuất sắc, nhưng em vẫn cần đảm bảo mình đã hoàn thành đầy đủ các môn tiên quyết về xác suất thống kê trước khi họ nhận em vào các buổi thí nghiệm.'
      },
      {
        speaker: 'Maya',
        en: 'Fortunately, I have already completed Advanced Biostatistics with an A minus last term.',
        vi: 'May mắn là em đã hoàn thành môn Thống kê Sinh học Nâng cao với điểm A trừ vào học kỳ trước rồi ạ.'
      },
      {
        speaker: 'Maya',
        en: 'Another factor I wanted to ask about is language and accommodation. Will the international office assist exchange students with finding student housing on campus?',
        vi: 'Một yếu tố khác em muốn hỏi là ngôn ngữ và chỗ ở. Liệu văn phòng hợp tác quốc tế có hỗ trợ sinh viên trao đổi tìm ký túc xá trong khuôn viên trường không ạ?'
      },
      {
        speaker: 'Dr. Harrison',
        en: 'Yes, Melbourne provides dedicated dormitories for international cohorts, provided you submit your housing deposit before the June deadline.',
        vi: 'Có chứ, Melbourne cung cấp các khu ký túc xá riêng cho sinh viên quốc tế, miễn là em nộp tiền đặt cọc nhà ở trước hạn chót tháng Sáu.'
      },
      {
        speaker: 'Dr. Harrison',
        en: 'Additionally, you will participate in a mandatory one-week cultural orientation before regular academic lectures begin.',
        vi: 'Ngoài ra, em sẽ tham gia một tuần định hướng văn hóa bắt buộc trước khi các bài giảng chính thức bắt đầu.'
      },
      {
        speaker: 'Dr. Harrison',
        en: 'My key recommendation today is to balance your study load wisely—do not register for more than four intensive modules, because adapting to a foreign educational culture and independent lifestyle takes considerable energy during the first month.',
        vi: 'Lời khuyên quan trọng nhất của thầy hôm nay là hãy cân đối khối lượng học tập thật khôn ngoan—đừng đăng ký quá bốn học phần chuyên sâu, vì việc thích nghi với văn hóa giáo dục ngoại quốc và lối sống tự lập sẽ tốn rất nhiều năng lượng trong tháng đầu tiên.'
      },
      {
        speaker: 'Maya',
        en: 'Thank you so much for the clear advice, Dr. Harrison. I will gather the official syllabi this weekend and book a follow-up appointment with you next Tuesday.',
        vi: 'Em cảm ơn thầy Harrison rất nhiều vì lời khuyên rõ ràng. Em sẽ thu thập đề cương chính thức vào cuối tuần này và đặt lịch hẹn tiếp theo với thầy vào thứ Ba tuần tới ạ.'
      },
      {
        speaker: 'Dr. Harrison',
        en: 'You are very welcome, Maya. Best of luck with your preparations!',
        vi: 'Không có gì đâu Maya. Chúc em mọi điều may mắn với các bước chuẩn bị nhé!'
      }
    ],
    questions: [
      {
        id: 'q_b1_1_1',
        type: 'main_idea',
        question: 'What is the primary purpose of Maya\'s meeting with Dr. Harrison?',
        options: [
          'To seek academic guidance on credit transfers and practical preparation for a semester abroad',
          'To submit a formal complaint about her Advanced Biostatistics grade',
          'To request a full tuition scholarship for graduate school in London',
          'To apply for a teaching assistant position in the environmental science department'
        ],
        correctIndex: 0,
        explanation: 'Mục đích chính của buổi gặp là nhận hướng dẫn học thuật về việc chuyển đổi tín chỉ và sự chuẩn bị thực tế cho học kỳ trao đổi tại Melbourne.'
      },
      {
        id: 'q_b1_1_2',
        type: 'detail',
        question: 'According to Dr. Harrison, what must students submit at least three months prior to departure to secure credit equivalency?',
        options: [
          'Detailed course syllabi for evaluation by the departmental curriculum committee',
          'A certified copy of their high school graduation diploma',
          'A personal financial bank statement proving living funds',
          'A written recommendation letter from the university president'
        ],
        correctIndex: 0,
        explanation: 'Thầy Harrison nêu rõ: "you must submit detailed course syllabi for academic pre-approval at least three months prior to departure".'
      },
      {
        id: 'q_b1_1_3',
        type: 'vocab_context',
        question: 'In Dr. Harrison\'s advice, what does the word "prerequisite" mean regarding introductory statistics courses?',
        options: [
          'A course that must be completed and passed before enrolling in a more advanced subject',
          'An optional sports club activity offered on weekends',
          'A graduation certificate awarded upon completing university',
          'A discount voucher for buying university textbooks'
        ],
        correctIndex: 0,
        explanation: '"Prerequisite" có nghĩa là điều kiện tiên quyết / môn học tiên quyết phải hoàn thành trước khi được học một môn nâng cao hơn.'
      },
      {
        id: 'q_b1_1_4',
        type: 'cause_effect',
        question: 'Why does Dr. Harrison caution Maya against registering for more than four intensive modules?',
        options: [
          'Because adapting to a foreign educational culture and independent lifestyle requires significant energy during the initial month',
          'Because Melbourne University prohibits international students from taking more than two classes',
          'Because textbook prices in Australia are too expensive for exchange students',
          'Because laboratory computers are shut down every afternoon for maintenance'
        ],
        correctIndex: 0,
        explanation: 'Thầy Harrison giải thích lý do: thích nghi với văn hóa giáo dục mới và lối sống tự lập lấy đi rất nhiều năng lượng trong tháng đầu tiên.'
      },
      {
        id: 'q_b1_1_5',
        type: 'inference',
        question: 'What can be inferred about an overseas course that only partially matches the home university curriculum?',
        options: [
          'It will likely count as a general elective rather than satisfying a mandatory core requirement',
          'It will automatically cause the student to fail the entire academic year',
          'The student will be forced to retake high school mathematics',
          'The credit will be completely erased from the student\'s permanent academic transcript'
        ],
        correctIndex: 0,
        explanation: 'Đoạn hội thoại chỉ ra: nếu môn học chỉ khớp một phần, nó sẽ được xếp vào diện tín chỉ tự chọn đại cương (general elective) thay vì môn cốt lõi bắt buộc.'
      }
    ]
  },
  {
    id: 'listen_b1_2',
    title: 'Preserving Cultural Heritage: An Interview with an Indigenous Textile Curator',
    category: 'Culture',
    format: 'Interview',
    level: 'B1',
    duration: '4:00',
    description: 'Cuộc trò chuyện giữa người dẫn chương trình và chuyên gia bảo tồn về kỹ thuật dệt truyền thống, thuốc nhuộm tự nhiên và du lịch bền vững.',
    audioText: `Liam: Good afternoon listeners, and welcome back to Cultural Horizons. Today, we are delighted to be joined by Elena Morales, lead curator at the Andean Heritage Foundation. Elena, your recent exhibition on handwoven ancestral textiles has attracted visitors from all across the globe. Could you explain why these traditional fabrics are so culturally significant?
Elena: Thank you for inviting me, Liam. In Andean communities, weaving is not merely a decorative craft; it serves as a profound visual language that has preserved communal history and cosmological beliefs across centuries. Each geometric pattern and woven stripe encodes specific information about the weaver's home village, social standing, and kinship connections.
Liam: That is fascinating. In your exhibition, you highlighted the historical shift from natural plant dyes to synthetic chemical coloring during the late twentieth century. What impact did that transition have on local artisan cooperatives?
Elena: That transition was a double-edged sword. Synthetic dyes were significantly cheaper and faster to prepare, which initially allowed weavers to increase commercial output for mass tourism. However, as chemical powders replaced ancestral knowledge, communities gradually forgot how to identify native botanical plants, mineral mordants, and insect dyes like cochineal. Furthermore, the synthetic colors faded rapidly under direct sunlight, undermining the renowned longevity of indigenous textiles.
Liam: And that is why your foundation established the revival workshops, correct?
Elena: Precisely. We partner directly with elder master weavers to document ancient extraction recipes and establish communal botanical gardens. Younger generations are now learning how boiling wild lichen and walnut bark produces vibrant, colorfast earthy tones that last for generations without contaminating local freshwater streams.
Liam: How can international travelers support these artisan communities without disrupting their traditional way of life?
Elena: Responsible tourism is essential. Travelers should purchase directly from verified artisan cooperatives rather than commercial middlemen, and be willing to pay fair prices that reflect the weeks of labor required to hand-weave a single ceremonial shawl. Authentic cultural appreciation means valuing the human craftsmanship behind the art. Furthermore, when travelers engage with authentic curiosity and respect for ancestral heritage, it inspires younger community members to take immense pride in their textile traditions and pursue cultural preservation as a dignified vocation.
Liam: A truly inspiring perspective. Thank you so much for sharing your insights with us today, Elena.`,
    sentences: [
      {
        speaker: 'Liam',
        en: 'Good afternoon listeners, and welcome back to Cultural Horizons.',
        vi: 'Chào buổi chiều quý thính giả, và chào mừng quý vị quay trở lại với chương trình Chân trời Văn hóa.'
      },
      {
        speaker: 'Liam',
        en: 'Today, we are delighted to be joined by Elena Morales, lead curator at the Andean Heritage Foundation.',
        vi: 'Hôm nay, chúng tôi rất vui mừng được đón tiếp Elena Morales, giám tuyển trưởng tại Quỹ Di sản Andean.'
      },
      {
        speaker: 'Liam',
        en: 'Elena, your recent exhibition on handwoven ancestral textiles has attracted visitors from all across the globe. Could you explain why these traditional fabrics are so culturally significant?',
        vi: 'Elena, triển lãm gần đây của cô về vải dệt thủ công cổ truyền đã thu hút khách tham quan từ khắp nơi trên thế giới. Cô có thể giải thích tại sao những tấm vải truyền thống này lại có ý nghĩa văn hóa sâu sắc đến vậy không?'
      },
      {
        speaker: 'Elena',
        en: 'Thank you for inviting me, Liam. In Andean communities, weaving is not merely a decorative craft; it serves as a profound visual language that has preserved communal history and cosmological beliefs across centuries.',
        vi: 'Cảm ơn Liam đã mời tôi. Trong các cộng đồng vùng Andes, dệt vải không đơn thuần là nghề thủ công trang trí; nó đóng vai trò như một ngôn ngữ thị giác sâu sắc gìn giữ lịch sử cộng đồng và vũ trụ quan qua nhiều thế kỷ.'
      },
      {
        speaker: 'Elena',
        en: 'Each geometric pattern and woven stripe encodes specific information about the weaver\'s home village, social standing, and kinship connections.',
        vi: 'Mỗi hoa văn hình học và đường sọc dệt đều mã hóa thông tin cụ thể về ngôi làng quê hương, địa vị xã hội và mối quan hệ dòng tộc của người thợ dệt.'
      },
      {
        speaker: 'Liam',
        en: 'That is fascinating. In your exhibition, you highlighted the historical shift from natural plant dyes to synthetic chemical coloring during the late twentieth century. What impact did that transition have on local artisan cooperatives?',
        vi: 'Thật thú vị. Trong triển lãm của mình, cô đã nhấn mạnh sự chuyển dịch lịch sử từ thuốc nhuộm thực vật tự nhiên sang phẩm màu hóa học nhân tạo vào cuối thế kỷ 20. Sự chuyển dịch đó đã gây ra tác động gì đối với các hợp tác xã nghệ nhân địa phương?'
      },
      {
        speaker: 'Elena',
        en: 'That transition was a double-edged sword. Synthetic dyes were significantly cheaper and faster to prepare, which initially allowed weavers to increase commercial output for mass tourism.',
        vi: 'Sự chuyển dịch đó là con dao hai lưỡi. Thuốc nhuộm hóa học rẻ hơn đáng kể và pha chế nhanh hơn, ban đầu cho phép thợ dệt tăng sản lượng thương mại để phục vụ du lịch đại trà.'
      },
      {
        speaker: 'Elena',
        en: 'However, as chemical powders replaced ancestral knowledge, communities gradually forgot how to identify native botanical plants, mineral mordants, and insect dyes like cochineal.',
        vi: 'Tuy nhiên, khi bột hóa chất thay thế tri thức tổ tiên, các cộng đồng dần dần quên cách nhận biết các loài thực vật bản địa, chất cầm màu khoáng chất và thuốc nhuộm côn trùng như bọ son (cochineal).'
      },
      {
        speaker: 'Elena',
        en: 'Furthermore, the synthetic colors faded rapidly under direct sunlight, undermining the renowned longevity of indigenous textiles.',
        vi: 'Hơn nữa, các màu nhuộm hóa học bị phai màu nhanh chóng dưới ánh nắng trực tiếp, làm suy giảm độ bền bỉ trứ danh của vải dệt bản địa.'
      },
      {
        speaker: 'Liam',
        en: 'And that is why your foundation established the revival workshops, correct?',
        vi: 'Và đó là lý do tại sao quỹ của cô đã thành lập các xưởng hồi sinh làng nghề, đúng không?'
      },
      {
        speaker: 'Elena',
        en: 'Precisely. We partner directly with elder master weavers to document ancient extraction recipes and establish communal botanical gardens.',
        vi: 'Chính xác là vậy. Chúng tôi hợp tác trực tiếp với các nghệ nhân dệt bậc thầy cao niên để ghi chép lại các công thức chiết xuất cổ xưa và thành lập các vườn bách thảo cộng đồng.'
      },
      {
        speaker: 'Elena',
        en: 'Younger generations are now learning how boiling wild lichen and walnut bark produces vibrant, colorfast earthy tones that last for generations without contaminating local freshwater streams.',
        vi: 'Các thế hệ trẻ hiện đang học cách đun sôi địa y tự nhiên và vỏ quả óc chó để tạo ra các tông màu đất rực rỡ, bền màu kéo dài qua nhiều thế hệ mà không gây ô nhiễm các dòng suối nước ngọt địa phương.'
      },
      {
        speaker: 'Liam',
        en: 'How can international travelers support these artisan communities without disrupting their traditional way of life?',
        vi: 'Du khách quốc tế có thể hỗ trợ các cộng đồng nghệ nhân này như thế nào mà không làm xáo trộn nếp sống truyền thống của họ?'
      },
      {
        speaker: 'Elena',
        en: 'Responsible tourism is essential. Travelers should purchase directly from verified artisan cooperatives rather than commercial middlemen, and be willing to pay fair prices that reflect the weeks of labor required to hand-weave a single ceremonial shawl.',
        vi: 'Du lịch có trách nhiệm là điều thiết yếu. Du khách nên mua sản phẩm trực tiếp từ các hợp tác xã nghệ nhân đã được chứng thực thay vì các thương lái trung gian, và sẵn sàng trả mức giá công bằng phản ánh hàng tuần lao động cần thiết để dệt thủ công một chiếc khăn choàng nghi lễ.'
      },
      {
        en: 'Authentic cultural appreciation means valuing the human craftsmanship behind the art.',
        vi: 'Sự trân trọng văn hóa đích thực có nghĩa là đánh giá cao sự khéo léo thủ công của con người đằng sau tác phẩm nghệ thuật.',
        speaker: 'Elena'
      },
      {
        speaker: 'Elena',
        en: 'Furthermore, when travelers engage with authentic curiosity and respect for ancestral heritage, it inspires younger community members to take immense pride in their textile traditions and pursue cultural preservation as a dignified vocation.',
        vi: 'Hơn nữa, khi du khách tiếp cận với sự tò mò và tôn trọng chân thành đối với di sản của tổ tiên, điều đó sẽ truyền cảm hứng cho các thành viên trẻ trong cộng đồng tự hào về truyền thống dệt vải và theo đuổi việc bảo tồn văn hóa như một thiên chức đáng trân trọng.'
      },
      {
        speaker: 'Liam',
        en: 'A truly inspiring perspective. Thank you so much for sharing your insights with us today, Elena.',
        vi: 'Một góc nhìn thực sự truyền cảm hứng. Cảm ơn cô rất nhiều vì đã chia sẻ những hiểu biết sâu sắc với chúng tôi ngày hôm nay, Elena.'
      }
    ],
    questions: [
      {
        id: 'q_b1_2_1',
        type: 'main_idea',
        question: 'What is the main topic of the interview between Liam and Elena Morales?',
        options: [
          'The cultural significance, historical challenges, and preservation of traditional Andean handweaving and natural dyes',
          'A commercial advertisement for an international airline ticket to South America',
          'A technical guide on how to build modern robotic textile factories in urban centers',
          'A financial investment seminar on corporate fashion stocks'
        ],
        correctIndex: 0,
        explanation: 'Chủ đề chính xuyên suốt bài phỏng vấn là ý nghĩa văn hóa, các thách thức lịch sử và nỗ lực bảo tồn nghề dệt thủ công truyền thống và thuốc nhuộm tự nhiên.'
      },
      {
        id: 'q_b1_2_2',
        type: 'detail',
        question: 'What specific information is encoded in the geometric patterns of Andean ancestral textiles?',
        options: [
          'The weaver\'s home village, social standing, and kinship connections',
          'The modern retail price of sheep wool in international supermarkets',
          'The train departure timetable between capital cities',
          'The scientific names of synthetic chemical powders'
        ],
        correctIndex: 0,
        explanation: 'Elena khẳng định: "Each geometric pattern and woven stripe encodes specific information about the weaver\'s home village, social standing, and kinship connections".'
      },
      {
        id: 'q_b1_2_3',
        type: 'vocab_context',
        question: 'In Elena\'s explanation of dye extraction, what does the word "botanical" refer to?',
        options: [
          'Relating to plants, vegetation, and flora used for natural resources',
          'Relating to motorized underwater submarines',
          'Relating to computer microchips and digital processors',
          'Relating to space exploration satellites'
        ],
        correctIndex: 0,
        explanation: '"Botanical" có nghĩa là thuộc về thực vật / thảo mộc học ("relating to plants or plant biology").'
      },
      {
        id: 'q_b1_2_4',
        type: 'speaker_intention',
        question: 'Why does Elena describe the historical transition to synthetic dyes as a "double-edged sword"?',
        options: [
          'Because while it temporarily increased commercial output, it caused communities to lose ancestral botanical knowledge and produced fabrics that faded quickly',
          'Because metal swords were used to cut the synthetic yarn into equal lengths',
          'Because chemical dyes caused violent physical battles among artisan villages',
          'Because tourists refused to touch any fabric colored with synthetic powder'
        ],
        correctIndex: 0,
        explanation: 'Elena dùng ẩn dụ "con dao hai lưỡi" vì thuốc nhuộm nhân tạo tuy rẻ và nhanh tăng sản lượng, nhưng làm mai một tri thức tổ tiên và độ bền màu kém.'
      },
      {
        id: 'q_b1_2_5',
        type: 'cause_effect',
        question: 'According to Elena, why should responsible tourists buy directly from artisan cooperatives rather than commercial middlemen?',
        options: [
          'To ensure that the artisans receive fair compensation that reflects weeks of dedicated manual craftsmanship',
          'To receive free hotel accommodation during their stay in the Andes',
          'Because commercial middlemen refuse to accept paper currency',
          'Because cooperatives provide free international air cargo delivery'
        ],
        correctIndex: 0,
        explanation: 'Elena giải thích: mua trực tiếp từ hợp tác xã giúp người nghệ nhân nhận được mức thù lao xứng đáng và công bằng cho hàng tuần lao động dệt tay.'
      }
    ]
  }
];
