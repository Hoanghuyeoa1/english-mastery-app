import { ListeningLesson } from '../types';

export const b2ListeningLessons: ListeningLesson[] = [
  {
    id: 'listen_1',
    title: 'The Rise of Distributed Microservices Architecture',
    category: 'Tech',
    format: 'Presentation',
    level: 'B2',
    duration: '4:45',
    description: 'Khám phá quá trình chuyển đổi từ khối kiến trúc nguyên khối sang hệ thống vi dịch vụ phân tán, các lợi ích về khả năng mở rộng và thách thức vận hành.',
    audioText: `In contemporary enterprise cloud engineering, microservices architecture has emerged as the preeminent paradigm for building resilient, high-throughput software platforms. Over the past decade, rapid consumer growth and escalating data volumes exposed the inherent limitations of traditional monolithic architectures. In a standard monolith, every functional component—from user authentication and product catalog search to billing and notification pipelines—is packaged into a single codebase and deployed as one rigid binary artifact. Consequently, even a minor code alteration or isolated memory leak in a non-critical module could trigger a catastrophic total system outage.

To resolve these architectural bottlenecks, forward-thinking engineering organizations decomposed complex systems into collections of autonomous, loosely coupled microservices. Each microservice encapsulates a discrete business capability, encapsulates its own independent database schema, and communicates with peer services through lightweight protocols such as RESTful HTTP APIs, gRPC, or asynchronous message streams powered by Apache Kafka and RabbitMQ. This strict encapsulation empowers autonomous feature teams to iterate, test, and deploy software updates multiple times per day without coordinating costly lockstep release windows across the entire organization.

Nevertheless, transitioning to a distributed microservices ecosystem is not without substantial operational hurdles. Decentralized architectures inevitably introduce network latency overhead, complex distributed transaction patterns, and eventual consistency challenges. When a single user interaction spans dozens of downstream remote procedure calls, diagnosing performance regressions demands sophisticated distributed tracing tools like OpenTelemetry and centralized logging aggregators. Furthermore, engineering leaders must enforce rigorous API versioning and robust circuit breaker mechanisms to prevent cascading network failures during sudden traffic spikes.

To govern this sprawling network of independent microservices, modern platform teams have increasingly embraced service mesh infrastructure such as Istio and Envoy. A service mesh injects sidecar proxies alongside every application container, offloading mutual TLS encryption, telemetry gathering, and dynamic load balancing away from individual service codebases into a dedicated platform infrastructure layer. This separation of concerns allows developers to focus purely on business logic while infrastructure engineers enforce cluster-wide security policies, rate limits, and blue-green deployment strategies across diverse cloud regions.

At the organizational level, successful microservices adoption demands deep alignment with Conway's Law, which observes that software architectures tend to mirror the communication patterns of the teams creating them. Rather than maintaining centralized, siloed departments of frontend developers, database administrators, and QA testers, high-performing enterprises restructure into cross-functional pods aligned with bounded contexts. Each pod possesses end-to-end ownership of its domain, adhering to the principle of you build it, you run it. While microservices undoubtedly introduce cognitive overhead and require mature automated delivery pipelines, their ability to provide fault isolation and unprecedented organizational scalability makes them an indispensable cornerstone of modern cloud-native engineering.

Crucially, validating the resilience of microservices architectures has fostered the discipline of chaos engineering. Pioneered by large-scale internet platforms, chaos engineering intentionally introduces simulated infrastructure faults into production clusters—such as terminating random container instances, injecting synthetic network latency, or simulating regional datacenter blackouts. By proactively uncovering hidden failure modes under controlled conditions, software engineers verify that automated self-healing mechanisms and fallback degradation routines operate as intended, guaranteeing uninterrupted user service even amid severe cloud provider outages.`,
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
        en: 'Each microservice encapsulates a discrete business capability, encapsulates its own independent database schema, and communicates with peer services through lightweight protocols such as RESTful HTTP APIs, gRPC, or asynchronous message streams powered by Apache Kafka and RabbitMQ.',
        vi: 'Mỗi vi dịch vụ gói gọn một năng lực nghiệp vụ riêng biệt, sở hữu lược đồ cơ sở dữ liệu độc lập và giao tiếp với các dịch vụ ngang hàng qua các giao thức nhẹ như RESTful HTTP, gRPC hoặc luồng truyền tin bất đồng bộ sử dụng Apache Kafka và RabbitMQ.'
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
        en: 'When a single user interaction spans dozens of downstream remote procedure calls, diagnosing performance regressions demands sophisticated distributed tracing tools like OpenTelemetry and centralized logging aggregators.',
        vi: 'Khi một tương tác người dùng đơn lẻ trải dài qua hàng chục lệnh gọi thủ tục từ xa phía dưới, việc chẩn đoán suy giảm hiệu năng đòi hỏi các công cụ truy vết phân tán tinh vi như OpenTelemetry và các hệ thống tập hợp nhật ký tập trung.'
      },
      {
        en: 'Furthermore, engineering leaders must enforce rigorous API versioning and robust circuit breaker mechanisms to prevent cascading network failures during sudden traffic spikes.',
        vi: 'Hơn nữa, các nhà lãnh đạo kỹ thuật phải thực thi việc đánh phiên bản API nghiêm ngặt và cơ chế ngắt mạch (circuit breaker) mạnh mẽ để ngăn ngừa lỗi mạng dây chuyền khi lưu lượng tăng đột biến.'
      },
      {
        en: 'To govern this sprawling network of independent microservices, modern platform teams have increasingly embraced service mesh infrastructure such as Istio and Envoy.',
        vi: 'Để quản lý mạng lưới vi dịch vụ độc lập rộng lớn này, các nhóm nền tảng hiện đại ngày càng áp dụng hạ tầng lưới dịch vụ (service mesh) như Istio và Envoy.'
      },
      {
        en: 'A service mesh injects sidecar proxies alongside every application container, offloading mutual TLS encryption, telemetry gathering, and dynamic load balancing away from individual service codebases into a dedicated platform infrastructure layer.',
        vi: 'Một lưới dịch vụ sẽ chèn các proxy sidecar bên cạnh mỗi vùng chứa ứng dụng, giải phóng việc mã hóa mTLS, thu thập dữ liệu đo từ xa và cân bằng tải động khỏi mã nguồn của từng dịch vụ vào một lớp hạ tầng nền tảng chuyên dụng.'
      },
      {
        en: 'This separation of concerns allows developers to focus purely on business logic while infrastructure engineers enforce cluster-wide security policies, rate limits, and blue-green deployment strategies across diverse cloud regions.',
        vi: 'Sự phân tách các mối quan tâm này cho phép các lập trình viên tập trung hoàn toàn vào logic nghiệp vụ trong khi các kỹ sư hạ tầng thực thi các chính sách bảo mật toàn cụm, giới hạn tốc độ và chiến lược triển khai xanh-lam (blue-green) trên khắp các khu vực đám mây đa dạng.'
      },
      {
        en: 'At the organizational level, successful microservices adoption demands deep alignment with Conway\'s Law, which observes that software architectures tend to mirror the communication patterns of the teams creating them.',
        vi: 'Ở cấp độ tổ chức, việc áp dụng thành công vi dịch vụ đòi hỏi sự tương thích sâu sắc với Định luật Conway, định luật quan sát thấy rằng các kiến trúc phần mềm có xu hướng phản ánh các mô hình giao tiếp của các nhóm tạo ra chúng.'
      },
      {
        en: 'Rather than maintaining centralized, siloed departments of frontend developers, database administrators, and QA testers, high-performing enterprises restructure into cross-functional pods aligned with bounded contexts.',
        vi: 'Thay vì duy trì các phòng ban tập trung, biệt lập gồm lập trình viên giao diện, quản trị viên cơ sở dữ liệu và kiểm thử viên, các doanh nghiệp hiệu suất cao tái cấu trúc thành các nhóm chức năng chéo liên kết với các ngữ cảnh giới hạn (bounded contexts).'
      },
      {
        en: 'Each pod possesses end-to-end ownership of its domain, adhering to the principle of you build it, you run it.',
        vi: 'Mỗi nhóm sở hữu toàn quyền từ đầu đến cuối đối với miền nghiệp vụ của mình, tuân thủ nguyên tắc bạn xây dựng nó, bạn vận hành nó.'
      },
      {
        en: 'While microservices undoubtedly introduce cognitive overhead and require mature automated delivery pipelines, their ability to provide fault isolation and unprecedented organizational scalability makes them an indispensable cornerstone of modern cloud-native engineering.',
        vi: 'Mặc dù vi dịch vụ chắc chắn mang lại gánh nặng nhận thức và đòi hỏi các đường ống phân phối tự động hóa trưởng thành, khả năng cô lập lỗi và khả năng mở rộng tổ chức chưa từng có của chúng khiến chúng trở thành nền tảng không thể thiếu của kỹ thuật đám mây hiện đại.'
      },
      {
        en: 'Crucially, validating the resilience of microservices architectures has fostered the discipline of chaos engineering.',
        vi: 'Điều quan trọng là việc xác thực tính bền bỉ của kiến trúc vi dịch vụ đã thúc đẩy kỷ luật kỹ thuật hỗn loạn (chaos engineering).'
      },
      {
        en: 'Pioneered by large-scale internet platforms, chaos engineering intentionally introduces simulated infrastructure faults into production clusters—such as terminating random container instances, injecting synthetic network latency, or simulating regional datacenter blackouts.',
        vi: 'Được tiên phong bởi các nền tảng internet quy mô lớn, kỹ thuật hỗn loạn chủ động tạo ra các sự cố hạ tầng mô phỏng vào các cụm máy chủ chính thức—chẳng hạn như tắt ngẫu nhiên các phiên bản vùng chứa, bơm độ trễ mạng giả lập hoặc mô phỏng sự cố sập trung tâm dữ liệu khu vực.'
      },
      {
        en: 'By proactively uncovering hidden failure modes under controlled conditions, software engineers verify that automated self-healing mechanisms and fallback degradation routines operate as intended, guaranteeing uninterrupted user service even amid severe cloud provider outages.',
        vi: 'Bằng cách chủ động phát hiện các chế độ lỗi tiềm ẩn trong điều kiện được kiểm soát, các kỹ sư phần mềm xác minh rằng các cơ chế tự phục hồi tự động và các quy trình dự phòng hoạt động đúng như dự kiến, đảm bảo dịch vụ người dùng không bị gián đoạn ngay cả khi nhà cung cấp đám mây gặp sự cố nghiêm trọng.'
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
    id: 'listen_b2_1',
    title: 'Modernizing Offshore Wind Grids and Coastal Ecosystems',
    category: 'Environment',
    format: 'Documentary',
    level: 'B2',
    duration: '5:30',
    description: 'Báo cáo chuyên sâu về quá trình chuyển dịch năng lượng gió ngoài khơi, bài toán ổn định lưới điện quốc gia và các giải pháp bảo vệ sinh thái bờ biển.',
    audioText: `Over the past decade, offshore wind power has advanced from a localized experimental clean technology into a cornerstone of international decarbonization strategies. Coastal nations with extensive maritime territories are constructing massive multi-gigawatt wind farms situated dozens of kilometers out at sea, where unobstructed maritime winds blow with substantially greater force and velocity than onshore breezes. However, scaling offshore wind capacity is not merely an engineering triumph of erecting towering aerodynamic turbine towers; it represents a comprehensive structural transformation that fundamentally alters national transmission grids, port logistics, and delicate marine ecosystems.

The primary engineering dilemma confronting offshore infrastructure developers revolves around transmission stability and distance. Generating thousands of megawatts in turbulent open waters requires subterranean subsea cables engineered to endure immense hydrostatic pressure, saline corrosion, and underwater seismic shifts. Furthermore, transmitting alternating current over long distances incurs devastating electrical transmission losses. Consequently, energy consortia are increasingly investing in high-voltage direct current converter platforms. These colossal offshore substations gather variable alternating voltage generated by hundreds of individual turbines, convert it into direct current, and funnel electricity onshore through ultra-insulated undersea conduits with minimal line degradation.

Yet, technical connectivity constitutes only one facet of the transition. Energy planners must also grapple with dispatch intermittency. Because wind speeds vary unpredictably across seasonal weather patterns, wind generation is inherently intermittent, requiring national grid operators to couple offshore arrays with utility-scale pumped hydroelectric reservoirs and chemical battery installations. Without responsive storage capacity, sudden surges in stormy wind output can destabilize grid frequency or trigger curtailment protocols where clean energy is wastefully disconnected.

Equally pressing is the ecological dilemma posed by coastal construction. The installation of massive monopile foundations involves hydraulic hammer driving that generates deafening acoustic shockwaves underwater. Marine biologists have demonstrated that these sound pulses can disorient cetacean navigation systems and disrupt fish spawning migrations across continental shelves. In response, maritime regulators now mandate acoustic mitigation systems, such as dual bubble curtains that encircle construction barges and dampen acoustic resonance by up to ninety percent. Interestingly, long-term benthic surveys indicate that once operational phase begins, turbine substructures frequently act as de facto artificial reefs, fostering thriving biomes of mussels, kelp, and juvenile flatfish where commercial industrial bottom-trawling is legally prohibited. Thus, modernizing coastal renewable grids demands a rigorous balance between aggressive climate mitigation and marine conservation.

Beyond offshore electrical generation and transmission, national industrial strategies must address port infrastructure and specialized maritime supply chains. Installing fifteen-megawatt wind turbines featuring rotor diameters that exceed two hundred meters necessitates deep-water harbor berths equipped with colossal heavy-lift cranes and dedicated jack-up installation vessels. Because only a handful of international shipyards can manufacture these specialized vessels, maritime logistics bottlenecks frequently trigger construction delays and escalating project expenditures. Furthermore, the decommissioning of early-generation offshore installations highlights the emerging imperative of circular material lifecycles. Forward-looking manufacturers are now pioneering chemical solvolysis technologies to recover virgin-grade carbon fibers and developing biodegradable epoxy resins that dissolve cleanly at the end of their operational lifespans, ensuring that renewable infrastructure harmonizes with enduring planetary stewardship.`,
    sentences: [
      {
        en: 'Over the past decade, offshore wind power has advanced from a localized experimental clean technology into a cornerstone of international decarbonization strategies.',
        vi: 'Trong thập kỷ qua, năng lượng gió ngoài khơi đã phát triển từ một công nghệ sạch mang tính thử nghiệm cục bộ thành nền tảng cốt lõi trong các chiến lược khử cacbon quốc tế.'
      },
      {
        en: 'Coastal nations with extensive maritime territories are constructing massive multi-gigawatt wind farms situated dozens of kilometers out at sea, where unobstructed maritime winds blow with substantially greater force and velocity than onshore breezes.',
        vi: 'Các quốc gia ven biển với lãnh hải rộng lớn đang xây dựng các trang trại gió khổng lồ công suất nhiều gigawatt cách đất liền hàng chục km, nơi gió biển không bị cản trở thổi với sức mạnh và vận tốc vượt trội hơn nhiều so với gió trên bờ.'
      },
      {
        en: 'However, scaling offshore wind capacity is not merely an engineering triumph of erecting towering aerodynamic turbine towers; it represents a comprehensive structural transformation that fundamentally alters national transmission grids, port logistics, and delicate marine ecosystems.',
        vi: 'Tuy nhiên, việc mở rộng quy mô điện gió ngoài khơi không chỉ đơn thuần là kỳ tích kỹ thuật dựng lên các tháp tua-bin khí động học cao chọc trời; nó đại diện cho một cuộc chuyển đổi cấu trúc toàn diện làm thay đổi căn bản lưới điện quốc gia, hậu cần cảng biển và các hệ sinh thái biển mong manh.'
      },
      {
        en: 'The primary engineering dilemma confronting offshore infrastructure developers revolves around transmission stability and distance.',
        vi: 'Thách thức kỹ thuật hàng đầu mà các nhà phát triển cơ sở hạ tầng ngoài khơi phải đối mặt xoay quanh tính ổn định của đường truyền và khoảng cách địa lý.'
      },
      {
        en: 'Generating thousands of megawatts in turbulent open waters requires subterranean subsea cables engineered to endure immense hydrostatic pressure, saline corrosion, and underwater seismic shifts.',
        vi: 'Việc tạo ra hàng nghìn megawatt giữa vùng biển động đòi hỏi các tuyến cáp ngầm dưới đáy biển được chế tạo để chịu được áp suất thủy tĩnh khổng lồ, sự ăn mòn của muối biển và các chấn động địa chấn dưới nước.'
      },
      {
        en: 'Furthermore, transmitting alternating current over long distances incurs devastating electrical transmission losses.',
        vi: 'Hơn nữa, việc truyền tải dòng điện xoay chiều qua khoảng cách xa gây ra tổn thất điện năng truyền tải vô cùng nghiêm trọng.'
      },
      {
        en: 'Consequently, energy consortia are increasingly investing in high-voltage direct current converter platforms.',
        vi: 'Do đó, các liên minh năng lượng đang ngày càng đầu tư mạnh mẽ vào các trạm biến áp dòng điện một chiều điện áp cao (HVDC).'
      },
      {
        en: 'These colossal offshore substations gather variable alternating voltage generated by hundreds of individual turbines, convert it into direct current, and funnel electricity onshore through ultra-insulated undersea conduits with minimal line degradation.',
        vi: 'Những trạm biến áp ngoài khơi khổng lồ này thu thập điện áp xoay chiều biến thiên do hàng trăm tua-bin riêng lẻ tạo ra, chuyển đổi thành dòng điện một chiều và dẫn điện vào đất liền qua các ống dẫn bọc cách điện siêu bền dưới đáy biển với mức hao hụt đường truyền tối thiểu.'
      },
      {
        en: 'Yet, technical connectivity constitutes only one facet of the transition.',
        vi: 'Tuy nhiên, khả năng kết nối kỹ thuật chỉ là một khía cạnh của quá trình chuyển dịch này.'
      },
      {
        en: 'Energy planners must also grapple with dispatch intermittency.',
        vi: 'Các nhà quy hoạch năng lượng còn phải vật lộn với tính gián đoạn trong việc điều độ điện năng.'
      },
      {
        en: 'Because wind speeds vary unpredictably across seasonal weather patterns, wind generation is inherently intermittent, requiring national grid operators to couple offshore arrays with utility-scale pumped hydroelectric reservoirs and chemical battery installations.',
        vi: 'Vì tốc độ gió biến động khó lường theo các hình thái thời tiết theo mùa, việc phát điện từ gió mang tính chất gián đoạn vốn có, đòi hỏi các đơn vị vận hành lưới điện quốc gia phải kết hợp các cụm ngoài khơi với các hồ thủy điện tích năng quy mô lớn và các hệ thống pin lưu trữ hóa học.'
      },
      {
        en: 'Without responsive storage capacity, sudden surges in stormy wind output can destabilize grid frequency or trigger curtailment protocols where clean energy is wastefully disconnected.',
        vi: 'Nếu không có dung lượng lưu trữ phản ứng nhanh, sản lượng điện gió tăng đột biến khi có bão có thể làm mất ổn định tần số lưới điện hoặc kích hoạt các quy trình cắt giảm tải, nơi năng lượng sạch bị ngắt kết nối một cách lãng phí.'
      },
      {
        en: 'Equally pressing is the ecological dilemma posed by coastal construction.',
        vi: 'Một thách thức cấp bách không kém là bài toán sinh thái do hoạt động xây dựng ven biển đặt ra.'
      },
      {
        en: 'The installation of massive monopile foundations involves hydraulic hammer driving that generates deafening acoustic shockwaves underwater.',
        vi: 'Việc lắp đặt các móng cọc đơn khổng lồ liên quan đến việc đóng búa thủy lực tạo ra các sóng xung kích âm thanh đinh tai nhức óc dưới nước.'
      },
      {
        en: 'Marine biologists have demonstrated that these sound pulses can disorient cetacean navigation systems and disrupt fish spawning migrations across continental shelves.',
        vi: 'Các nhà sinh học biển đã chứng minh rằng những xung âm thanh này có thể làm mất phương hướng hệ thống định vị của động vật biển có vú (cá voi, cá heo) và làm gián đoạn các luồng di cư sinh sản của cá dọc thềm lục địa.'
      },
      {
        en: 'In response, maritime regulators now mandate acoustic mitigation systems, such as dual bubble curtains that encircle construction barges and dampen acoustic resonance by up to ninety percent.',
        vi: 'Để ứng phó, các cơ quan quản lý hàng hải hiện bắt buộc phải có các hệ thống giảm thiểu âm thanh, chẳng hạn như màn chắn bọt khí kép bao quanh sà lan thi công và làm giảm cộng hưởng âm thanh lên đến chín mươi phần trăm.'
      },
      {
        en: 'Interestingly, long-term benthic surveys indicate that once operational phase begins, turbine substructures frequently act as de facto artificial reefs, fostering thriving biomes of mussels, kelp, and juvenile flatfish where commercial industrial bottom-trawling is legally prohibited.',
        vi: 'Điều thú vị là các khảo sát đáy biển dài hạn chỉ ra rằng một khi giai đoạn vận hành bắt đầu, các cấu trúc móng tua-bin thường hoạt động như những rạn san hô nhân tạo trên thực tế, nuôi dưỡng các quần xã sinh vật phát triển mạnh của vẹm, tảo bẹ và cá non ở những nơi mà hoạt động đánh bắt giã cào đáy công nghiệp bị cấm theo luật.'
      },
      {
        en: 'Thus, modernizing coastal renewable grids demands a rigorous balance between aggressive climate mitigation and marine conservation.',
        vi: 'Vì vậy, việc hiện đại hóa lưới điện tái tạo ven biển đòi hỏi sự cân bằng nghiêm ngặt giữa nỗ lực giảm thiểu biến đổi khí hậu quyết liệt và công tác bảo tồn biển.'
      },
      {
        en: 'Beyond offshore electrical generation and transmission, national industrial strategies must address port infrastructure and specialized maritime supply chains.',
        vi: 'Bên cạnh việc phát và truyền tải điện ngoài khơi, các chiến lược công nghiệp quốc gia phải giải quyết bài toán cơ sở hạ tầng cảng biển và chuỗi cung ứng hàng hải chuyên dụng.'
      },
      {
        en: 'Installing fifteen-megawatt wind turbines featuring rotor diameters that exceed two hundred meters necessitates deep-water harbor berths equipped with colossal heavy-lift cranes and dedicated jack-up installation vessels.',
        vi: 'Việc lắp đặt các tua-bin gió mười lăm megawatt có đường kính cánh quạt vượt quá hai trăm mét đòi hỏi các cầu cảng nước sâu được trang bị cần cẩu siêu trường siêu trọng và các tàu cẩu tự nâng chuyên dụng.'
      },
      {
        en: 'Because only a handful of international shipyards can manufacture these specialized vessels, maritime logistics bottlenecks frequently trigger construction delays and escalating project expenditures.',
        vi: 'Vì chỉ có một số ít xưởng đóng tàu quốc tế có thể chế tạo những con tàu chuyên dụng này, các nút thắt cổ chai về hậu cần hàng hải thường xuyên gây ra sự chậm trễ trong xây dựng và làm leo thang chi phí dự án.'
      },
      {
        en: 'Furthermore, the decommissioning of early-generation offshore installations highlights the emerging imperative of circular material lifecycles.',
        vi: 'Hơn nữa, việc tháo dỡ các công trình ngoài khơi thế hệ đầu làm nổi bật tính cấp thiết mới nổi của vòng đời vật liệu tuần hoàn.'
      },
      {
        en: 'Forward-looking manufacturers are now pioneering chemical solvolysis technologies to recover virgin-grade carbon fibers and developing biodegradable epoxy resins that dissolve cleanly at the end of their operational lifespans, ensuring that renewable infrastructure harmonizes with enduring planetary stewardship.',
        vi: 'Các nhà sản xuất có tầm nhìn xa hiện đang tiên phong trong các công nghệ hòa tan hóa học để thu hồi các sợi carbon nguyên sinh và phát triển các loại nhựa epoxy phân hủy sinh học có thể hòa tan sạch vào cuối vòng đời hoạt động, đảm bảo rằng cơ sở hạ tầng tái tạo hài hòa với sự bảo vệ hành tinh lâu dài.'
      }
    ],
    questions: [
      {
        id: 'q_b2_1_1',
        type: 'main_idea',
        question: 'What is the primary thesis of the report regarding offshore wind development?',
        options: [
          'Expanding offshore wind requires resolving complex technical grid transmission, dispatch intermittency, and coastal marine ecological impacts',
          'Offshore wind turbines should be completely replaced by land-based coal combustion plants',
          'Constructing wind farms has no measurable effect on marine biology or electricity grids',
          'Subsea cables are too dangerous to install under modern safety standards'
        ],
        correctIndex: 0,
        explanation: 'Luận điểm bao trùm của bài là mở rộng điện gió ngoài khơi không chỉ là dựng tua-bin mà phải giải quyết bài toán truyền tải HVDC, tính gián đoạn nguồn phát và tác động sinh thái biển.'
      },
      {
        id: 'q_b2_1_2',
        type: 'detail',
        question: 'Why do energy consortia deploy high-voltage direct current (HVDC) converter platforms instead of standard alternating current?',
        options: [
          'To convert alternating current into direct current, significantly reducing power degradation over long subsea transmission distances',
          'Because direct current makes turbine blades spin ten times faster in stormy weather',
          'To generate artificial lighting for commercial cruise ships navigating nearby waters',
          'Because international maritime laws prohibit alternating current in salt water'
        ],
        correctIndex: 0,
        explanation: 'Đoạn 2 chỉ ra: truyền điện xoay chiều đi xa gây tổn thất lớn, nên HVDC converter platforms chuyển sang điện một chiều để giảm thiểu hao hụt qua đường cáp ngầm biển.'
      },
      {
        id: 'q_b2_1_3',
        type: 'vocab_context',
        question: 'In paragraph 3, what does the word "intermittent" mean regarding offshore wind generation?',
        options: [
          'Occurring at irregular intervals rather than being continuous and steady',
          'Operating at extremely high temperatures that boil seawater',
          'Producing zero carbon dioxide emissions under any condition',
          'Completely free of financial costs for residential consumers'
        ],
        correctIndex: 0,
        explanation: '"Intermittent" có nghĩa là gián đoạn, ngắt quãng, không liên tục ("occurring at irregular, unpredictable intervals").'
      },
      {
        id: 'q_b2_1_4',
        type: 'cause_effect',
        question: 'What ecological hazard prompted regulators to mandate acoustic bubble curtains during foundation construction?',
        options: [
          'Deafening hydraulic hammer pulses that disorient cetaceans and disrupt fish spawning migrations',
          'Chemical leaks from paint dissolving into coastal drinking water supplies',
          'Overheating of ocean surface water causing localized algal blooms',
          'Attracting predatory sharks to harbor shipping lanes'
        ],
        correctIndex: 0,
        explanation: 'Đoạn 4 nêu: xung âm thanh từ búa đóng cọc thủy lực làm mất phương hướng động vật có vú biển và cản trở luồng cá di cư đẻ trứng, buộc phải dùng màn bọt khí để giảm chấn động âm.'
      },
      {
        id: 'q_b2_1_5',
        type: 'attitude',
        question: 'What is the author\'s tone regarding the environmental duality of operational offshore wind farms?',
        options: [
          'Nuanced and objective, recognizing both initial acoustic construction hazards and subsequent artificial reef ecological benefits',
          'Entirely hostile, rejecting all forms of renewable wind technology unconditionally',
          'Indifferent and bored, dismissing the subject as trivial academic curiosity',
          'Overly romanticized, claiming that wind farms instantly solve all ocean problems'
        ],
        correctIndex: 0,
        explanation: 'Tác giả giữ góc nhìn đa chiều, khách quan (nuanced & objective): vừa chỉ ra hiểm họa tiếng ồn khi thi công vừa ghi nhận lợi ích sinh thái như rạn san hô nhân tạo khi vận hành.'
      },
      {
        id: 'q_b2_1_6',
        type: 'inference',
        question: 'What can be inferred about the operational areas surrounding offshore wind foundations?',
        options: [
          'They offer unexpected sanctuary for benthic organisms because commercial bottom-trawling is legally prohibited there',
          'They become barren underwater deserts devoid of all plant and animal life',
          'They are regularly bombed by military training exercises',
          'They cause all passing seabirds to lose their navigational instincts'
        ],
        correctIndex: 0,
        explanation: 'Đoạn cuối suy luận: do cấm tàu đánh bắt giã cào đáy, khu vực quanh chân tua-bin trở thành vùng trú ẩn an toàn, tạo điều kiện cho vẹm, tảo bẹ và cá non sinh sôi.'
      }
    ]
  },
  {
    id: 'listen_b2_2',
    title: 'Algorithmic Recommender Systems and Adolescent Cognition',
    category: 'Science',
    format: 'Podcast',
    level: 'B2',
    duration: '5:30',
    description: 'Cuộc tọa đàm khoa học giữa hai chuyên gia tâm lý học hành vi về tác động của thuật toán đề xuất nội dung ngắn đối với sự chú ý và sức khỏe tâm thần thanh thiếu niên.',
    audioText: `Dr. Vance: Good morning listeners. Welcome to Mind & Society, our weekly seminar dissecting contemporary behavioral science. I am Dr. Julian Vance, and joining me today is Professor Claire Lin, director of the Cognitive Neuromapping Laboratory. Claire, our focus today is the algorithmic architecture of contemporary social media feeds, specifically short-form video algorithms, and their neurological footprint on the developing adolescent brain.
Prof. Lin: Thank you Julian. It is vital to recognize that these recommendation engines are not benign content catalogs; they are sophisticated predictive systems optimized around behavioral retention. By analyzing millisecond-level telemetry—such as how many fractions of a second a user lingers on a thumbnail or whether they rewatch a three-second loop—the algorithm dynamically calibrates user dopamine pathways using variable reward schedules, fundamentally identical to slot machines in casinos.
Dr. Vance: That casino analogy is particularly striking. In classic Skinnerian conditioning, an organism demonstrates the highest compulsion to pull a lever when the reward is unpredictable. In digital feeds, users swipe upward repeatedly because nine mediocre videos might be followed by one hyper-engaging viral clip. How does this continuous stimulation affect prefrontal cortex executive functions?
Prof. Lin: That is where clinical findings become deeply alarming. The prefrontal cortex, responsible for impulse control, critical reasoning, and delayed gratification, undergoes profound structural remodeling during adolescence and does not fully mature until approximately age twenty-five. When teenagers spend four to six hours daily immersed in rapid, unpredictable micro-stimuli, it rewires their baseline neural expectations. Specifically, these hyper-stimulating micro-rewards steadily attenuate adolescents' tolerance for mundane, low-stimulation activities such as reading academic textbooks, writing analytical essays, or engaging in sustained classroom discussions.
Dr. Vance: Beyond attention span degradation, there is also the severe disruption of circadian architecture. Blue light emissions coupled with emotionally charged content late at night inhibit melatonin secretion, pushing sleep onset well past midnight. Chronic sleep deprivation in adolescents directly amplifies affective volatility, depressive symptoms, and social anxiety.
Prof. Lin: Exactly. And unfortunately, corporate self-regulation mechanisms—such as passive on-screen reminders warning users they have spent two hours scrolling—are thoroughly ineffective. Behavioral nudges cannot compete against predictive machine learning algorithms that continuously refine their emotional hooks against a vulnerable, underdeveloped executive control center.
Dr. Vance: Which brings us to policy interventions. Many developmental psychologists now argue that society must treat algorithmic feed design through the lens of public health, similar to regulations governing tobacco, alcohol, and gambling products aimed at minors.
Prof. Lin: I wholeheartedly agree. Until regulatory frameworks hold platforms accountable for predatory engagement architectures, the cognitive burden will continue to fall disproportionately on parents and vulnerable young minds.
Dr. Vance: What about educational environments? Several forward-thinking school districts in Europe and North America have recently enacted total bans on smartphones during instructional hours, reporting marked recoveries in student social interaction and academic focus.
Prof. Lin: The empirical data emerging from those institutional policies is remarkably positive. When school environments eliminate continuous micro-notifications, students' working memory capacity rebounds within just a few weeks. However, school-based restrictions alone cannot solve a societal predicament. We urgently need digital literacy curricula that empower adolescents to understand algorithmic persuasion, alongside platform defaults that enforce strict chronological feeds and eliminate infinite scroll mechanics for underage users.
Dr. Vance: Empowering youth through transparency and accountability. Professor Lin, thank you for sharing your indispensable expertise on this defining psychological challenge of our digital era.`,
    sentences: [
      {
        speaker: 'Dr. Vance',
        en: 'Good morning listeners. Welcome to Mind & Society, our weekly seminar dissecting contemporary behavioral science.',
        vi: 'Chào buổi sáng quý thính giả. Chào mừng quý vị đến với Tâm trí & Xã hội, buổi hội thảo hàng tuần mổ xẻ khoa học hành vi đương đại.'
      },
      {
        speaker: 'Dr. Vance',
        en: 'I am Dr. Julian Vance, and joining me today is Professor Claire Lin, director of the Cognitive Neuromapping Laboratory.',
        vi: 'Tôi là Tiến sĩ Julian Vance, và cùng tham gia với tôi hôm nay là Giáo sư Claire Lin, giám đốc Phòng thí nghiệm Lập bản đồ Thần kinh Nhận thức.'
      },
      {
        speaker: 'Dr. Vance',
        en: 'Claire, our focus today is the algorithmic architecture of contemporary social media feeds, specifically short-form video algorithms, and their neurological footprint on the developing adolescent brain.',
        vi: 'Thưa Claire, trọng tâm của chúng ta hôm nay là kiến trúc thuật toán của các luồng cấp tin mạng xã hội đương đại, cụ thể là thuật toán video ngắn, và dấu ấn thần kinh của chúng đối với bộ não đang phát triển của thanh thiếu niên.'
      },
      {
        speaker: 'Prof. Lin',
        en: 'Thank you Julian. It is vital to recognize that these recommendation engines are not benign content catalogs; they are sophisticated predictive systems optimized around behavioral retention.',
        vi: 'Cảm ơn Julian. Điều quan trọng là phải nhận ra rằng các cỗ máy đề xuất này không phải là những danh mục nội dung vô hại; chúng là các hệ thống dự đoán tinh vi được tối ưu hóa xoay quanh việc giữ chân hành vi người dùng.'
      },
      {
        speaker: 'Prof. Lin',
        en: 'By analyzing millisecond-level telemetry—such as how many fractions of a second a user lingers on a thumbnail or whether they rewatch a three-second loop—the algorithm dynamically calibrates user dopamine pathways using variable reward schedules, fundamentally identical to slot machines in casinos.',
        vi: 'Bằng cách phân tích dữ liệu đo đạc ở cấp độ mili giây—chẳng hạn như một phần nhỏ của giây người dùng dừng lại trên một ảnh bìa hoặc liệu họ có xem lại một đoạn video lặp 3 giây hay không—thuật toán chủ động điều chỉnh các đường dẫn dopamine của người dùng bằng lịch trình khen thưởng biến đổi, về cơ bản hoàn toàn giống với máy đánh bạc trong sòng bạc.'
      },
      {
        speaker: 'Dr. Vance',
        en: 'That casino analogy is particularly striking. In classic Skinnerian conditioning, an organism demonstrates the highest compulsion to pull a lever when the reward is unpredictable.',
        vi: 'Phép so sánh với sòng bạc đó đặc biệt ấn tượng. Trong điều kiện hóa cổ điển của Skinner, một sinh vật thể hiện sự thôi thúc kéo cần gạt cao nhất khi phần thưởng là không thể đoán trước.'
      },
      {
        speaker: 'Dr. Vance',
        en: 'In digital feeds, users swipe upward repeatedly because nine mediocre videos might be followed by one hyper-engaging viral clip.',
        vi: 'Trên các luồng cấp tin kỹ thuật số, người dùng lướt lên liên tục vì sau chín video bình thường có thể là một đoạn clip viral cực kỳ lôi cuốn.'
      },
      {
        speaker: 'Dr. Vance',
        en: 'How does this continuous stimulation affect prefrontal cortex executive functions?',
        vi: 'Sự kích thích liên tục này ảnh hưởng như thế nào đến các chức năng điều hành của vỏ não trước trán?'
      },
      {
        speaker: 'Prof. Lin',
        en: 'That is where clinical findings become deeply alarming.',
        vi: 'Đó chính là nơi các phát hiện lâm sàng trở nên vô cùng đáng báo động.'
      },
      {
        speaker: 'Prof. Lin',
        en: 'The prefrontal cortex, responsible for impulse control, critical reasoning, and delayed gratification, undergoes profound structural remodeling during adolescence and does not fully mature until approximately age twenty-five.',
        vi: 'Vỏ não trước trán, chịu trách nhiệm kiểm soát xung động, tư duy phản biện và trì hoãn sự thỏa mãn, trải qua quá trình tái cấu trúc sâu sắc trong thời kỳ thanh thiếu niên và không trưởng thành hoàn toàn cho đến khoảng hai mươi lăm tuổi.'
      },
      {
        speaker: 'Prof. Lin',
        en: 'When teenagers spend four to six hours daily immersed in rapid, unpredictable micro-stimuli, it rewires their baseline neural expectations.',
        vi: 'Khi thanh thiếu niên dành bốn đến sáu giờ mỗi ngày đắm chìm trong các vi kích thích nhanh chóng, khó lường, nó sẽ tái lập trình lại những kỳ vọng thần kinh cơ bản của họ.'
      },
      {
        speaker: 'Prof. Lin',
        en: 'Specifically, these hyper-stimulating micro-rewards steadily attenuate adolescents\' tolerance for mundane, low-stimulation activities such as reading academic textbooks, writing analytical essays, or engaging in sustained classroom discussions.',
        vi: 'Cụ thể, những phần thưởng vi mô siêu kích thích này dần dần làm suy giảm (attenuate) khả năng chịu đựng của thanh thiếu niên đối với các hoạt động đơn điệu, ít kích thích như đọc sách giáo khoa, viết bài luận phân tích hoặc tham gia vào các cuộc thảo luận kéo dài trong lớp học.'
      },
      {
        speaker: 'Dr. Vance',
        en: 'Beyond attention span degradation, there is also the severe disruption of circadian architecture.',
        vi: 'Vượt ra ngoài sự suy giảm về khoảng chú ý, còn có sự gián đoạn nghiêm trọng đối với cấu trúc nhịp sinh học.'
      },
      {
        speaker: 'Dr. Vance',
        en: 'Blue light emissions coupled with emotionally charged content late at night inhibit melatonin secretion, pushing sleep onset well past midnight.',
        vi: 'Ánh sáng xanh phát ra kết hợp với nội dung kích động cảm xúc vào đêm muộn sẽ ức chế tiết melatonin, đẩy thời điểm bắt đầu giấc ngủ lùi xa qua nửa đêm.'
      },
      {
        speaker: 'Dr. Vance',
        en: 'Chronic sleep deprivation in adolescents directly amplifies affective volatility, depressive symptoms, and social anxiety.',
        vi: 'Thiếu ngủ mãn tính ở thanh thiếu niên trực tiếp làm khuếch đại sự bất ổn cảm xúc, các triệu chứng trầm cảm và sự lo âu xã hội.'
      },
      {
        speaker: 'Prof. Lin',
        en: 'Exactly. And unfortunately, corporate self-regulation mechanisms—such as passive on-screen reminders warning users they have spent two hours scrolling—are thoroughly ineffective.',
        vi: 'Chính xác. Và thật không may, các cơ chế tự điều chỉnh của doanh nghiệp—chẳng hạn như các lời nhắc thụ động trên màn hình cảnh báo người dùng đã lướt hai tiếng—hoàn toàn không hiệu quả.'
      },
      {
        speaker: 'Prof. Lin',
        en: 'Behavioral nudges cannot compete against predictive machine learning algorithms that continuously refine their emotional hooks against a vulnerable, underdeveloped executive control center.',
        vi: 'Những cú huých hành vi không thể cạnh tranh lại với các thuật toán học máy dự đoán liên tục tinh chỉnh các mồi câu cảm xúc chống lại một trung tâm kiểm soát điều hành còn non nớt và dễ bị tổn thương.'
      },
      {
        speaker: 'Dr. Vance',
        en: 'Which brings us to policy interventions. Many developmental psychologists now argue that society must treat algorithmic feed design through the lens of public health, similar to regulations governing tobacco, alcohol, and gambling products aimed at minors.',
        vi: 'Điều này đưa chúng ta đến các can thiệp chính sách. Nhiều nhà tâm lý học phát triển hiện lập luận rằng xã hội phải nhìn nhận thiết kế cấp tin thuật toán qua lăng kính y tế công cộng, tương tự như các quy định quản lý thuốc lá, rượu bia và các sản phẩm cờ bạc nhắm vào trẻ vị thành niên.'
      },
      {
        speaker: 'Prof. Lin',
        en: 'I wholeheartedly agree. Until regulatory frameworks hold platforms accountable for predatory engagement architectures, the cognitive burden will continue to fall disproportionately on parents and vulnerable young minds.',
        vi: 'Tôi hoàn toàn đồng ý. Chừng nào các khung pháp lý chưa quy trách nhiệm cho các nền tảng về những kiến trúc tương tác mang tính trục lợi này, gánh nặng nhận thức sẽ tiếp tục đè nặng một cách bất công lên các bậc cha mẹ và những tâm hồn non nớt dễ bị tổn thương.'
      },
      {
        speaker: 'Dr. Vance',
        en: 'What about educational environments? Several forward-thinking school districts in Europe and North America have recently enacted total bans on smartphones during instructional hours, reporting marked recoveries in student social interaction and academic focus.',
        vi: 'Thế còn các môi trường giáo dục thì sao? Một số học khu có tư duy tiến bộ ở châu Âu và Bắc Mỹ gần đây đã ban hành lệnh cấm hoàn toàn điện thoại thông minh trong giờ học, báo cáo sự phục hồi rõ rệt trong tương tác xã hội và sự tập trung học tập của học sinh.'
      },
      {
        speaker: 'Prof. Lin',
        en: 'The empirical data emerging from those institutional policies is remarkably positive. When school environments eliminate continuous micro-notifications, students\' working memory capacity rebounds within just a few weeks.',
        vi: 'Dữ liệu thực nghiệm thu được từ các chính sách thể chế đó là vô cùng tích cực. Khi môi trường học đường loại bỏ các thông báo vi mô liên tục, dung lượng bộ nhớ làm việc của học sinh phục hồi chỉ sau vài tuần.'
      },
      {
        speaker: 'Prof. Lin',
        en: 'However, school-based restrictions alone cannot solve a societal predicament. We urgently need digital literacy curricula that empower adolescents to understand algorithmic persuasion, alongside platform defaults that enforce strict chronological feeds and eliminate infinite scroll mechanics for underage users.',
        vi: 'Tuy nhiên, các hạn chế trong trường học đơn thuần không thể giải quyết một vấn đề nan giải của xã hội. Chúng ta khẩn thiết cần các chương trình giảng dạy về hiểu biết số trao quyền cho thanh thiếu niên hiểu được sự thuyết phục bằng thuật toán, cùng với các cài đặt mặc định của nền tảng thực thi nguồn cấp dữ liệu theo trình tự thời gian nghiêm ngặt và loại bỏ cơ chế cuộn vô tận cho người dùng chưa đủ tuổi.'
      },
      {
        speaker: 'Dr. Vance',
        en: 'Empowering youth through transparency and accountability. Professor Lin, thank you for sharing your indispensable expertise on this defining psychological challenge of our digital era.',
        vi: 'Trao quyền cho giới trẻ thông qua tính minh bạch và trách nhiệm giải trình. Thưa Giáo sư Lin, cảm ơn cô đã chia sẻ kiến thức chuyên môn vô giá về thách thức tâm lý mang tính định hình này của kỷ nguyên số.'
      }
    ],
    questions: [
      {
        id: 'q_b2_2_1',
        type: 'main_idea',
        question: 'What is the primary topic explored in the conversation between Dr. Vance and Professor Lin?',
        options: [
          'How short-form algorithmic recommendation systems exploit variable rewards and compromise adolescent cognitive development and sleep',
          'How to program machine learning neural networks using Python and cloud servers',
          'The historical development of mechanical slot machines in nineteenth-century casinos',
          'Strategies for students to pass standardized university entrance examinations'
        ],
        correctIndex: 0,
        explanation: 'Nội dung bao trùm của cuộc tọa đàm là cách các thuật toán video ngắn khai thác cơ chế phần thưởng biến đổi để giữ chân người dùng, gây ảnh hưởng tiêu cực đến sự phát triển nhận thức và giấc ngủ của thanh thiếu niên.'
      },
      {
        id: 'q_b2_2_2',
        type: 'detail',
        question: 'According to Professor Lin, how do short-form video feeds mirror the psychology of casino slot machines?',
        options: [
          'By employing variable reward schedules where unpredictable high-stimulation content compels repetitive swiping',
          'By charging users coins every time they refresh the screen',
          'By requiring users to pull a mechanical lever attached to their smartphones',
          'By rewarding players with physical gold bars sent through the mail'
        ],
        correctIndex: 0,
        explanation: 'Giáo sư Lin giải thích: thuật toán sử dụng "variable reward schedules" (lịch trình thưởng biến đổi), nơi các video hấp dẫn xuất hiện ngẫu nhiên kích thích người dùng liên tục vuốt màn hình giống hệt máy đánh bạc.'
      },
      {
        id: 'q_b2_2_3',
        type: 'vocab_context',
        question: 'In Professor Lin\'s statement, what does the word "attenuate" mean regarding adolescents\' patience for academic tasks?',
        options: [
          'To weaken, reduce, or diminish the strength or value of something',
          'To dramatically increase and strengthen over time',
          'To color or decorate with bright artistic patterns',
          'To translate into a foreign language'
        ],
        correctIndex: 0,
        explanation: '"Attenuate" có nghĩa là làm suy yếu, làm giảm bớt độ mạnh hoặc mức độ chịu đựng ("to weaken or reduce the intensity/value").'
      },
      {
        id: 'q_b2_2_4',
        type: 'speaker_intention',
        question: 'Why does Dr. Vance emphasize the disruption of circadian rhythms and late-night melatonin inhibition?',
        options: [
          'To demonstrate that screen exposure causes physiological sleep deprivation, which amplifies emotional instability and anxiety',
          'To encourage listeners to buy expensive blue-light blocking sunglasses',
          'To argue that teenagers should wake up at four in the morning to exercise',
          'To suggest that electricity should be turned off in all residential neighborhoods at night'
        ],
        correctIndex: 0,
        explanation: 'Tiến sĩ Vance nêu dẫn chứng ánh sáng xanh ức chế melatonin để chỉ ra tác hại sinh lý: thiếu ngủ mãn tính làm trầm trọng thêm sự bất ổn cảm xúc và trầm cảm ở thanh thiếu niên.'
      },
      {
        id: 'q_b2_2_5',
        type: 'cause_effect',
        question: 'Why do both researchers consider corporate passive screen-time warnings completely ineffective?',
        options: [
          'Because mild behavioral nudges cannot override predictive algorithms that prey upon an underdeveloped prefrontal cortex',
          'Because smartphones automatically turn off when users read the warning',
          'Because screen-time warnings are written in ancient Latin that teenagers cannot understand',
          'Because parents disable all notification features on children\'s phones'
        ],
        correctIndex: 0,
        explanation: 'Cả hai chuyên gia khẳng định các thông báo nhắc nhở thụ động hoàn toàn bất lực trước các thuật toán dự đoán liên tục nhắm vào vùng vỏ não trước trán chưa trưởng thành.'
      },
      {
        id: 'q_b2_2_6',
        type: 'attitude',
        question: 'What attitude do the speakers share regarding the regulation of algorithmic social media architectures?',
        options: [
          'Strongly advocating for public health regulatory oversight, comparing predatory engagement designs to vices like tobacco and gambling',
          'Firmly believing that free market corporations should be left entirely unregulated',
          'Skeptical that algorithms have any measurable cognitive influence on human beings',
          'Enthusiastically praising tech companies for helping adolescents focus on long lectures'
        ],
        correctIndex: 0,
        explanation: 'Cả hai diễn giả đều có thái độ ủng hộ mạnh mẽ sự can thiệp của luật pháp và y tế công cộng (advocating public health regulation), ví thiết kế tương tác trục lợi như thuốc lá hay cờ bạc.'
      }
    ]
  },
  {
    id: 'listen_b2_3',
    title: 'Ocean Acidification and Coral Symbiosis Resilience',
    category: 'Science',
    format: 'Lecture',
    level: 'B2',
    duration: '5:30',
    description: 'Bài phân tích sinh học hải dương về tác động của lượng khí thải carbon hòa tan đối với quá trình vôi hóa rạn san hô và sự thích ứng di truyền của tảo cộng sinh.',
    audioText: `Coral reefs occupy less than one percent of the ocean floor, yet they harbor more than twenty-five percent of all documented marine life. Often celebrated as the underwater rainforests of our biosphere, these vibrant limestone architectures are fundamentally biogenic, constructed over millennia through the calcification activities of millions of tiny colonial polyps. However, contemporary anthropogenic carbon emissions are driving two simultaneous geochemical crises across the world's oceans: atmospheric thermal warming and pervasive ocean acidification.

To comprehend the severity of ocean acidification, one must examine seawater carbonate chemistry. As global industrial activities release billions of tons of carbon dioxide into the atmosphere, approximately thirty percent of that gas dissolves directly into surface oceanic waters. Dissolved carbon dioxide reacts with water molecules to form carbonic acid, which subsequently dissociates into bicarbonate ions and free hydrogen ions. These free hydrogen ions rapidly bond with available carbonate ions, depleting the ambient carbonate pool. Because scleractinian corals and calcifying mollusks rely on abundant carbonate ions to precipitate aragonite—the sturdy crystalline form of calcium carbonate required for building skeletal matrices—acidified water drastically impedes skeleton accretion and can literally corrode existing reef foundations.

Simultaneously, elevated sea surface temperatures disrupt the delicate metabolic partnership between coral polyps and their intracellular dinoflagellate algae, commonly known as zooxanthellae. Under normal conditions, these photosynthetic endosymbionts provide up to ninety percent of the coral's daily nutritional energy through glucose synthesis in exchange for shelter and inorganic nutrients. However, under prolonged thermal heatwave stress, the microalgal symbiont produces toxic reactive oxygen molecules that damage host tissue. In a desperate physiological defense mechanism, the coral polyp expels its algal partners, causing the colony to bleach bone-white. Without its symbionts, the coral enters a state of acute starvation, rendering it exceedingly susceptible to opportunistic pathogenic infections and mortality.

Despite these grim projections, marine geneticists have observed remarkable islands of physiological resilience. In localized thermal refugia—such as shallow lagoons in the Persian Gulf and geothermal volcanic seeps in the South Pacific—certain resilient coral strains host heat-tolerant clade D Symbiodiniaceae capable of photosynthesizing efficiently even at thirty-four degrees Celsius. Marine biologists are pioneering assisted evolution projects, selectively breeding thermally tolerant microalgae and micro-fragmenting coral colonies to accelerate reef regeneration. However, scientists caution that biological restoration alone is merely a temporary triage strategy. Without radical reductions in global fossil fuel emissions, accelerating chemical acidification will inevitably overwhelm the adaptive physiological thresholds of marine calcifiers.

In tandem with biological and genetic interventions, oceanographers are deploying localized geochemical remediation experiments directly onto degraded reef sectors. By dispersing finely ground alkaline minerals—such as calcium hydroxide and olivine—into shallow coastal currents, researchers can induce artificial ocean alkalinization. This intervention locally neutralizes free hydrogen ions, effectively raising the saturation state of aragonite and creating temporary calcification sanctuaries where fragile juvenile corals can deposit their carbonate skeletons unhindered.

Moreover, indigenous ecological knowledge and community-managed marine protected areas have proven instrumental in preserving reef vitality. When artisanal fishing communities actively patrol and protect coastal waters from destructive dynamite blasting and land-based agricultural runoff, reefs exhibit significantly faster post-bleaching recovery rates than unmanaged marine corridors. Ultimately, safeguarding coral reefs demands an integrated socio-ecological approach combining global carbon abatement, cutting-edge marine biotechnology, and rigorous local environmental governance to ensure these magnificent biogenic structures endure for future generations.`,
    sentences: [
      {
        en: 'Coral reefs occupy less than one percent of the ocean floor, yet they harbor more than twenty-five percent of all documented marine life.',
        vi: 'Các rạn san hô chiếm chưa đến một phần trăm diện tích đáy đại dương, nhưng lại là nơi sinh sống của hơn hai mươi lăm phần trăm sinh vật biển đã được ghi nhận.'
      },
      {
        en: 'Often celebrated as the underwater rainforests of our biosphere, these vibrant limestone architectures are fundamentally biogenic, constructed over millennia through the calcification activities of millions of tiny colonial polyps.',
        vi: 'Thường được ca ngợi là những khu rừng mưa dưới nước của sinh quyển, các cấu trúc đá vôi rực rỡ này về cơ bản là do sinh vật tạo nên (biogenic), được xây dựng qua hàng thiên niên kỷ thông qua hoạt động vôi hóa của hàng triệu polyp san hô sống thành tập đoàn.'
      },
      {
        en: 'However, contemporary anthropogenic carbon emissions are driving two simultaneous geochemical crises across the world\'s oceans: atmospheric thermal warming and pervasive ocean acidification.',
        vi: 'Tuy nhiên, lượng khí thải carbon do con người gây ra ngày nay đang thúc đẩy hai cuộc khủng hoảng địa hóa học đồng thời trên khắp các đại dương: sự nóng lên của bầu khí quyển và hiện tượng axit hóa đại dương lan rộng.'
      },
      {
        en: 'To comprehend the severity of ocean acidification, one must examine seawater carbonate chemistry.',
        vi: 'Để hiểu được mức độ nghiêm trọng của hiện tượng axit hóa đại dương, người ta phải xem xét hóa học cacbonat trong nước biển.'
      },
      {
        en: 'As global industrial activities release billions of tons of carbon dioxide into the atmosphere, approximately thirty percent of that gas dissolves directly into surface oceanic waters.',
        vi: 'Khi các hoạt động công nghiệp toàn cầu giải phóng hàng tỷ tấn carbon dioxide vào khí quyển, khoảng ba mươi phần trăm lượng khí đó hòa tan trực tiếp vào các vùng nước bề mặt đại dương.'
      },
      {
        en: 'Dissolved carbon dioxide reacts with water molecules to form carbonic acid, which subsequently dissociates into bicarbonate ions and free hydrogen ions.',
        vi: 'Khí carbon dioxide hòa tan phản ứng với các phân tử nước để tạo thành axit cacbonic, sau đó phân ly thành các ion bicacbonat và các ion hydro tự do.'
      },
      {
        en: 'These free hydrogen ions rapidly bond with available carbonate ions, depleting the ambient carbonate pool.',
        vi: 'Các ion hydro tự do này nhanh chóng liên kết với các ion cacbonat có sẵn, làm cạn kiệt nguồn cacbonat xung quanh.'
      },
      {
        en: 'Because scleractinian corals and calcifying mollusks rely on abundant carbonate ions to precipitate aragonite—the sturdy crystalline form of calcium carbonate required for building skeletal matrices—acidified water drastically impedes skeleton accretion and can literally corrode existing reef foundations.',
        vi: 'Vì san hô tạo rạn và các loài thân mềm vôi hóa dựa vào lượng ion cacbonat dồi dào để kết tủa aragonit—dạng tinh thể cứng cáp của canxi cacbonat cần thiết để xây dựng khung xương—nước biển bị axit hóa làm cản trở nghiêm trọng quá trình tích tụ bộ xương và có thể ăn mòn các nền tảng rạn san hô hiện có.'
      },
      {
        en: 'Simultaneously, elevated sea surface temperatures disrupt the delicate metabolic partnership between coral polyps and their intracellular dinoflagellate algae, commonly known as zooxanthellae.',
        vi: 'Đồng thời, nhiệt độ bề mặt nước biển tăng cao phá vỡ mối quan hệ đối tác trao đổi chất mỏng manh giữa các polyp san hô và tảo đơn bào nội bào của chúng, thường được gọi là zooxanthellae.'
      },
      {
        en: 'Under normal conditions, these photosynthetic endosymbionts provide up to ninety percent of the coral\'s daily nutritional energy through glucose synthesis in exchange for shelter and inorganic nutrients.',
        vi: 'Trong điều kiện bình thường, những sinh vật nội cộng sinh quang hợp này cung cấp tới chín mươi phần trăm năng lượng dinh dưỡng hàng ngày của san hô thông qua tổng hợp glucose để đổi lấy nơi trú ẩn và các chất dinh dưỡng vô cơ.'
      },
      {
        en: 'However, under prolonged thermal heatwave stress, the microalgal symbiont produces toxic reactive oxygen molecules that damage host tissue.',
        vi: 'Tuy nhiên, dưới áp lực của những đợt nắng nóng nhiệt kéo dài, sinh vật cộng sinh vi tảo (symbiont) tạo ra các phân tử oxy phản ứng độc hại làm tổn thương mô của vật chủ.'
      },
      {
        en: 'In a desperate physiological defense mechanism, the coral polyp expels its algal partners, causing the colony to bleach bone-white.',
        vi: 'Trong một cơ chế tự vệ sinh lý tuyệt vọng, polyp san hô trục xuất các đối tác tảo của nó, khiến tập đoàn san hô bị tẩy trắng như màu xương.'
      },
      {
        en: 'Without its symbionts, the coral enters a state of acute starvation, rendering it exceedingly susceptible to opportunistic pathogenic infections and mortality.',
        vi: 'Nếu không có các sinh vật cộng sinh, san hô rơi vào tình trạng đói ăn trầm trọng, khiến nó cực kỳ dễ bị nhiễm mầm bệnh cơ hội và dẫn đến tử vong.'
      },
      {
        en: 'Despite these grim projections, marine geneticists have observed remarkable islands of physiological resilience.',
        vi: 'Bất chấp những dự báo u ám này, các nhà di truyền học biển đã quan sát thấy những hòn đảo kiên cường sinh lý đáng chú ý.'
      },
      {
        en: 'In localized thermal refugia—such as shallow lagoons in the Persian Gulf and geothermal volcanic seeps in the South Pacific—certain resilient coral strains host heat-tolerant clade D Symbiodiniaceae capable of photosynthesizing efficiently even at thirty-four degrees Celsius.',
        vi: 'Tại các vùng tị nạn nhiệt cục bộ—chẳng hạn như các đầm phá nông ở Vịnh Ba Tư và các mạch địa nhiệt núi lửa ở Nam Thái Bình Dương—một số chủng san hô kiên cường sở hữu loài Symbiodiniaceae nhánh D chịu nhiệt có khả năng quang hợp hiệu quả ngay cả ở ba mươi tư độ C.'
      },
      {
        en: 'Marine biologists are pioneering assisted evolution projects, selectively breeding thermally tolerant microalgae and micro-fragmenting coral colonies to accelerate reef regeneration.',
        vi: 'Các nhà sinh học biển đang tiên phong trong các dự án hỗ trợ tiến hóa, nhân giống chọn lọc các vi tảo chịu nhiệt và vi phân mảnh các tập đoàn san hô để đẩy nhanh quá trình tái sinh rạn.'
      },
      {
        en: 'However, scientists caution that biological restoration alone is merely a temporary triage strategy.',
        vi: 'Tuy nhiên, các nhà khoa học cảnh báo rằng chỉ riêng phục hồi sinh học đơn thuần là một chiến lược phân loại ứng phó tạm thời.'
      },
      {
        en: 'Without radical reductions in global fossil fuel emissions, accelerating chemical acidification will inevitably overwhelm the adaptive physiological thresholds of marine calcifiers.',
        vi: 'Nếu không có sự cắt giảm triệt để lượng khí thải từ nhiên liệu hóa thạch toàn cầu, tình trạng axit hóa hóa học gia tăng chắc chắn sẽ vượt qua các ngưỡng sinh lý thích ứng của các sinh vật vôi hóa biển.'
      },
      {
        en: 'In tandem with biological and genetic interventions, oceanographers are deploying localized geochemical remediation experiments directly onto degraded reef sectors.',
        vi: 'Cùng với các can thiệp sinh học và di truyền, các nhà hải dương học đang triển khai các thử nghiệm xử lý địa hóa học cục bộ trực tiếp trên các khu vực rạn san hô bị suy thoái.'
      },
      {
        en: 'By dispersing finely ground alkaline minerals—such as calcium hydroxide and olivine—into shallow coastal currents, researchers can induce artificial ocean alkalinization.',
        vi: 'Bằng cách phân tán các khoáng chất kiềm nghiền mịn—chẳng hạn như canxi hydroxit và olivin—vào các dòng hải lưu ven bờ nông, các nhà nghiên cứu có thể tạo ra quá trình kiềm hóa đại dương nhân tạo.'
      },
      {
        en: 'This intervention locally neutralizes free hydrogen ions, effectively raising the saturation state of aragonite and creating temporary calcification sanctuaries where fragile juvenile corals can deposit their carbonate skeletons unhindered.',
        vi: 'Can thiệp này vô hiệu hóa các ion hydro tự do tại chỗ, làm tăng hiệu quả trạng thái bão hòa của aragonit và tạo ra các khu bảo tồn vôi hóa tạm thời, nơi các san hô non mỏng manh có thể tích tụ bộ xương cacbonat mà không bị cản trở.'
      },
      {
        en: 'Moreover, indigenous ecological knowledge and community-managed marine protected areas have proven instrumental in preserving reef vitality.',
        vi: 'Hơn nữa, tri thức sinh thái bản địa và các khu bảo tồn biển do cộng đồng quản lý đã chứng minh vai trò quan trọng trong việc bảo tồn sức sống của rạn san hô.'
      },
      {
        en: 'When artisanal fishing communities actively patrol and protect coastal waters from destructive dynamite blasting and land-based agricultural runoff, reefs exhibit significantly faster post-bleaching recovery rates than unmanaged marine corridors.',
        vi: 'Khi các cộng đồng ngư dân thủ công tích cực tuần tra và bảo vệ vùng biển ven bờ khỏi các vụ nổ mìn phá hủy và dòng chảy nông nghiệp từ đất liền, các rạn san hô thể hiện tốc độ phục hồi sau tẩy trắng nhanh hơn đáng kể so với các hành lang biển không được quản lý.'
      },
      {
        en: 'Ultimately, safeguarding coral reefs demands an integrated socio-ecological approach combining global carbon abatement, cutting-edge marine biotechnology, and rigorous local environmental governance to ensure these magnificent biogenic structures endure for future generations.',
        vi: 'Cuối cùng, việc bảo vệ các rạn san hô đòi hỏi một cách tiếp cận sinh thái xã hội tích hợp kết hợp giảm thiểu carbon toàn cầu, công nghệ sinh học biển tiên tiến và quản trị môi trường địa phương nghiêm ngặt để đảm bảo các cấu trúc sinh học tuyệt đẹp này tồn tại cho các thế hệ tương lai.'
      }
    ],
    questions: [
      {
        id: 'q_b2_3_1',
        type: 'main_idea',
        question: 'What is the core scientific thesis presented regarding coral reef ecosystems?',
        options: [
          'Ocean acidification and thermal heatwaves synergistically threaten coral calcification and symbiosis, necessitating global carbon emission cuts alongside biological restoration',
          'Coral bleaching is entirely caused by plastic trash floating on the ocean surface',
          'Corals grow faster and build thicker skeletons in high-acid seawater environments',
          'Marine scientists recommend removing all natural coral reefs to make room for industrial shipping canals'
        ],
        correctIndex: 0,
        explanation: 'Luận điểm khoa học cốt lõi: Axit hóa đại dương và nhiệt độ nước biển tăng tác động tiêu cực đồng thời đến quá trình vôi hóa và quan hệ cộng sinh của san hô, đòi hỏi phải giảm phát thải carbon toàn cầu kết hợp phục hồi sinh học.'
      },
      {
        id: 'q_b2_3_2',
        type: 'detail',
        question: 'According to paragraph 2, how does dissolved carbon dioxide chemically deplete the carbonate ions needed by corals?',
        options: [
          'Carbonic acid dissociates into free hydrogen ions, which bond with carbonate ions and reduce the pool needed for aragonite precipitation',
          'Carbon dioxide turns directly into solid iron blocks that sink to the seabed',
          'Dissolved gas evaporates all seawater, leaving salt crystals behind',
          'Carbon dioxide absorbs all oxygen, causing deep-sea fish to suffocate'
        ],
        correctIndex: 0,
        explanation: 'Đoạn 2 phân tích cơ chế hóa học: CO2 tạo axit cacbonic giải phóng ion H+ tự do, ion này lập tức liên kết với ion cacbonat có sẵn, làm cạn kiệt nguồn cacbonat cần để kết tủa aragonit.'
      },
      {
        id: 'q_b2_3_3',
        type: 'vocab_context',
        question: 'In the passage, what does the word "symbiont" mean regarding the coral\'s microscopic algal partner?',
        options: [
          'An organism living in a close, mutually beneficial ecological partnership with another species',
          'A deadly viral disease that infects sea turtles',
          'A commercial submarine used for catching tuna',
          'A type of robotic underwater sensor'
        ],
        correctIndex: 0,
        explanation: '"Symbiont" có nghĩa là sinh vật cộng sinh, sống trong mối quan hệ gắn bó hữu cơ và tương hỗ lẫn nhau với vật chủ ("organism living in symbiosis").'
      },
      {
        id: 'q_b2_3_4',
        type: 'cause_effect',
        question: 'Why do coral polyps expel their zooxanthellae algae during prolonged marine heatwaves?',
        options: [
          'Because heat-stressed microalgae produce toxic reactive oxygen molecules that harm the coral host tissue',
          'Because the algae consume too much seawater and make the coral feel heavy',
          'Because predatory sharks bite the algae away from the coral polyps',
          'Because colder ocean temperatures freeze the outer surface of the reef'
        ],
        correctIndex: 0,
        explanation: 'Đoạn 3 giải thích: khi bị stress nhiệt độ cao kéo dài, vi tảo cộng sinh sinh ra các phân tử oxy phản ứng độc hại làm tổn thương mô vật chủ, khiến san hô buộc phải trục xuất tảo ra ngoài (tẩy trắng).'
      },
      {
        id: 'q_b2_3_5',
        type: 'inference',
        question: 'What does the discovery of heat-tolerant clade D Symbiodiniaceae in the Persian Gulf demonstrate?',
        options: [
          'Certain coral strains have evolved physiological adaptations that could be leveraged in assisted evolution and reef restoration programs',
          'Corals in the Middle East do not require sunlight or water to survive',
          'Persian Gulf waters have zero dissolved carbon dioxide emissions',
          'All coral species across the Pacific will naturally become immortal by next year'
        ],
        correctIndex: 0,
        explanation: 'Sự tồn tại của clade D chịu được 34 độ C chứng minh một số chủng san hô đã tiến hóa thích nghi sinh lý đặc biệt, mở ra cơ hội ứng dụng cho các dự án tiến hóa có hỗ trợ để phục hồi rạn san hô.'
      },
      {
        id: 'q_b2_3_6',
        type: 'speaker_intention',
        question: 'Why does the speaker describe assisted biological evolution as merely a "temporary triage strategy"?',
        options: [
          'To emphasize that biological breeding cannot save reefs if atmospheric fossil fuel emissions continue unabated',
          'To argue that funding for marine biology laboratories should be completely cut',
          'To show that triage hospitals should be built on floating oceanic barges',
          'To persuade tourists to avoid swimming near coral restoration zones'
        ],
        correctIndex: 0,
        explanation: 'Người nói dùng cụm từ "temporary triage strategy" để nhấn mạnh rằng nỗ lực nhân giống sinh học chỉ là giải pháp tình thế cấp cứu tạm thời, nếu không cắt giảm phát thải hóa thạch toàn cầu thì các rạn san hô vẫn sẽ sụp đổ.'
      }
    ]
  }
];
