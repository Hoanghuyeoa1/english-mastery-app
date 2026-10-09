import { ReadingLesson } from '../types';

export const c1ReadingLessons: ReadingLesson[] = [
  {
    id: 'read_3',
    title: 'Clean Architecture: Decoupling Domain Logic in Enterprise Systems',
    category: 'Tech & AI',
    level: 'C1',
    readTime: '5.5 phút',
    wordCount: 471,
    summary: 'Nguyên lý thiết kế Clean Architecture của Robert C. Martin, nguyên tắc Đảo ngược phụ thuộc (DIP) và cách tách biệt Domain Core khỏi hạ tầng.',
    content: [
      'In large-scale enterprise software systems, architectures frequently suffer from insidious structural erosion over time. When business requirements evolve rapidly under aggressive market deadlines, software engineering teams often take architectural shortcuts, directly mingling core business logic with user interface frameworks, relational database drivers, and third-party cloud SDKs. When domain entities contain hardcoded SQL queries, HTTP serialization logic, or vendor-specific messaging formats, even routine library version upgrades or schema alterations trigger cascading regression defects across the entire corporate codebase, paralyzing release velocity.',
      'To resolve this chronic fragility, software pioneer Robert C. Martin codified the principles of Clean Architecture, drawing inspiration from Hexagonal Architecture (Ports and Adapters) and Onion Architecture. Clean Architecture establishes concentric boundaries around software components, governed by a fundamental rule known as the Dependency Inversion Principle: source code dependencies must point inward, toward high-level business policies. The innermost circle comprises Enterprise Business Rules and Entities, surrounded by Application Use Cases. Outer infrastructure layers—such as database engines, web frameworks, payment gateways, and graphical user interfaces—are treated as replaceable peripheral plugins that depend inward on abstract domain interfaces rather than the reverse. By establishing an architectural boundary enforced by continuous dependency analysis, the core enterprise logic remains isolated from the ephemeral churn of external open-source packages, runtime upgrades, and shifting database vendor pricing models.',
      'This architectural bifurcation introduces Domain-Driven Design (DDD) concepts, where use cases orchestrate data flow between pure entities without knowing whether records are retrieved from PostgreSQL, distributed cache clusters, or mock memory vectors. Because core business logic possesses zero direct dependencies on external frameworks or execution runtimes, the entire domain layer can be tested in isolation. Software engineers can execute thousands of comprehensive domain unit tests in sub-second execution runs using in-memory mock repositories, completely independent of live network connections or containerized infrastructure. Furthermore, organizations can seamlessly migrate persistence technologies or replace deprecated third-party providers without refactoring a single business calculation. As a result, high-performing engineering organizations maintain consistent deployment cadence and prevent architectural decay even as the engineering headcount scales across multiple distributed development hubs.',
      'Moreover, in modern microservices and modular monolith architectures, Clean Architecture serves as an indispensable organizational blueprint. By strictly isolating use case interactors from external transport protocols—whether gRPC, RESTful endpoints, or message-driven asynchronous event streams—engineering teams can evolve communication channels independently without risking domain regressions. Teams establish distinct aggregate boundaries and enforce a ubiquitous language across bounded contexts, dramatically reducing cognitive friction between software developers, system architects, and non-technical business domain experts.',
      'Ultimately, adopting Clean Architecture requires disciplined upfront investment and unwavering architectural conviction. While writing abstract repository interfaces, boundary interactors, and bidirectional data transfer mappers introduces initial structural overhead, it safeguards enterprise applications against obsolescence and vendor lock-in. By isolating volatile external dependencies behind immutable domain boundaries, Clean Architecture ensures that software assets remain maintainable, extensible, and intellectually coherent across decades of operational evolution.'
    ],
    keyVocab: [
      { word: 'Insidious', ipa: '/ɪnˈsɪd.i.əs/', meaning: 'Âm thầm, diễn ra lén lút khó nhận biết' },
      { word: 'Decoupling', ipa: '/diːˈkʌp.lɪŋ/', meaning: 'Sự tách rời, giảm phụ thuộc lẫn nhau' },
      { word: 'Concentric', ipa: '/kənˈsen.trɪk/', meaning: 'Đồng tâm, có cùng tâm điểm' },
      { word: 'Obsolescence', ipa: '/ˌɒb.səˈles.əns/', meaning: 'Tình trạng trở nên lỗi thời' },
      { word: 'Evergreen', ipa: '/ˈev.ə.ɡriːn/', meaning: 'Bền vững, luôn mới mẻ theo thời gian' }
    ],
    questions: [
      {
        id: 'rq3_1',
        type: 'main_idea',
        question: 'What is the primary focus of Clean Architecture as described in the passage?',
        options: [
          'Maximizing database query throughput through hardware acceleration and distributed sharding',
          'Decoupling core business domain logic from volatile external frameworks, databases, and UI delivery mechanisms to ensure testability and long-term maintainability',
          'Automating continuous cloud infrastructure deployment through serverless orchestrators',
          'Migrating all enterprise applications from compiled languages to dynamically interpreted web scripts'
        ],
        correctIndex: 1,
        explanation: 'Mục tiêu cốt lõi của Clean Architecture là tách rời nghiệp vụ khỏi framework/database/UI để đảm bảo khả năng kiểm thử và bảo trì bền vững.'
      },
      {
        id: 'rq3_2',
        type: 'detail',
        question: 'According to the Dependency Inversion Principle in Clean Architecture, which direction must source code dependencies point?',
        options: [
          'Outward, from core business logic toward database drivers and message brokers',
          'Inward, from external infrastructure layers toward high-level business policies and entities',
          'Horizontally between unrelated external third-party software development kits',
          'Bidirectionally between persistence models and user interface controllers'
        ],
        correctIndex: 1,
        explanation: 'Đoạn 2 nêu rõ quy tắc then chốt: "source code dependencies must point inward, toward high-level business policies".'
      },
      {
        id: 'rq3_3',
        type: 'vocab_context',
        question: 'In paragraph 1, the word "insidious" is closest in meaning to:',
        options: [
          'Gradual, subtle, and harmful',
          'Transparent, predictable, and manageable',
          'Rapid, violent, and easily detected',
          'Temporary, harmless, and self-correcting'
        ],
        correctIndex: 0,
        explanation: '"Insidious" có nghĩa là âm thầm, ngấm ngầm nhưng gây hại nghiêm trọng ("gradual, subtle, and harmful").'
      },
      {
        id: 'rq3_4',
        type: 'negative_fact',
        question: 'Which of the following is NOT described as an outer peripheral layer in Clean Architecture?',
        options: [
          'Relational database engines',
          'Enterprise Business Rules and Core Entities',
          'Web routers and HTTP controllers',
          'Third-party payment gateways'
        ],
        correctIndex: 1,
        explanation: 'Enterprise Business Rules and Entities là vòng tròn trung tâm cốt lõi bên trong nhất, không phải tầng ngoại vi bên ngoài.'
      },
      {
        id: 'rq3_5',
        type: 'inference',
        question: 'What allows developers in a Clean Architecture codebase to run thousands of unit tests in milliseconds?',
        options: [
          'They bypass domain validation assertions and test only user interface layouts',
          'Because domain logic does not depend on live databases, tests use fast in-memory mock implementations without network overhead',
          'They compile code directly into microcode executing inside the computer CPU cache',
          'Unit tests only run when mocked cloud containers are loaded into production clusters'
        ],
        correctIndex: 1,
        explanation: 'Do tầng domain hoàn toàn độc lập với database thật, kiểm thử có thể chạy cực nhanh trên RAM dùng mock repository.'
      },
      {
        id: 'rq3_6',
        type: 'detail',
        question: 'Who is cited as the pioneer that codified the principles of Clean Architecture?',
        options: [
          'Robert C. Martin',
          'Hermann Ebbinghaus',
          'Martin Fowler',
          'Alan Turing'
        ],
        correctIndex: 0,
        explanation: 'Đoạn 2 nêu rõ: "software pioneer Robert C. Martin codified the principles of Clean Architecture".'
      },
      {
        id: 'rq3_7',
        type: 'vocab_context',
        question: 'In the final paragraph, the phrase "vendor lock-in" refers to:',
        options: [
          'Physical security procedures that restrict software vendors from entering corporate offices',
          'A situation where a business becomes dependent on a single proprietary technology vendor and cannot easily switch without massive cost',
          'Legal contracts that require enterprise software to be audited by governmental consumer agencies',
          'The practice of retaining multiple competing hardware suppliers to drive down manufacturing costs'
        ],
        correctIndex: 1,
        explanation: '"Vendor lock-in" là tình trạng bị phụ thuộc và trói buộc vào một nhà cung cấp công nghệ duy nhất, khó chuyển đổi do chi phí quá lớn.'
      }
    ]
  },
  {
    id: 'read_c1_1',
    title: 'Linguistic Relativity and the Cognitive Architecture of Thought',
    category: 'Culture & Society',
    level: 'C1',
    readTime: '5.5 phút',
    wordCount: 489,
    summary: 'Khám phá giả thuyết Sapir-Whorf về mối quan hệ giữa cấu trúc ngôn ngữ và mô thức tư duy nhận thức, từ phân biệt màu sắc đến định hướng không gian.',
    content: [
      'The proposition that the language we speak actively shapes the cognitive architecture through which we perceive reality has captivated linguists, anthropologists, and philosophers for over a century. Formally articulated in the mid-twentieth century by Edward Sapir and Benjamin Lee Whorf, the hypothesis of linguistic relativity—frequently referred to as the Sapir-Whorf hypothesis—posited that structural distinctions across natural languages do not merely provide disparate phonetic labels for universal human concepts, but rather predispose speakers toward divergent modes of categorization, spatial navigation, and temporal conceptualization. Rather than viewing human cognition as an entirely modular, hardwired computational matrix unaffected by sociological context, early structural linguists recognized that natural language acts as an active cognitive mediator between raw sensory stimuli and conscious introspective awareness.',
      'Early iterations of the theory succumbed to excessive determinism, claiming that language strictly imprisons human thought within linguistic boundaries. However, contemporary psycholinguistic research has revitalized the hypothesis under a nuanced neo-Whorfian paradigm. Empirical studies demonstrated that linguistic categories subtly steer automatic perceptual attention rather than permanently restricting conscious intellect. For example, speakers of languages with fine-grained color distinctions—such as Russian, which possesses distinct obligatory terms for light blue ("goluboy") and dark blue ("siniy")—exhibit faster neurological visual discrimination times when categorizing color swatches along those lexical boundaries than English speakers, whose single umbrella term "blue" collapses that spectral distinction.',
      'More profound cognitive divergences manifest in spatial cognition. While Western Indo-European languages rely almost exclusively on egocentric spatial coordinates—orienting objects relative to the observer\'s subjective body (left, right, front, back)—several indigenous communities employ absolute geocentric reckoning. Speakers of Guugu Yimithirr, an Australian Aboriginal language, orient their physical environment using cardinal compass directions (north, south, east, west) regardless of bodily orientation. A speaker will refer to a bug crawling on their "southwest leg" or describe an elder standing "east of the hearth." Consequently, Guugu Yimithirr speakers possess an internal dead-reckoning faculty of extraordinary fidelity, intuitively tracking cardinal orientations even inside pitch-black subterranean caverns. Consequently, when navigating unfamiliar terrain, these speakers continuously calculate their precise spatial coordinates with an effortless automaticity that astonishingly outperforms GPS-reliant modern urban observers.',
      'In the contemporary scientific landscape, the intersection of cognitive linguistics and computational semantics provides fresh empirical validation for linguistic relativity. Natural language processing models trained on monocultural text corpora invariably inherit the unique relational biases and conceptual associations embedded within that specific language\'s lexical ontology. Furthermore, cross-linguistic neuroimaging experiments reveal distinct hemodynamic activation patterns in the left prefrontal cortex when polyglots synthesize philosophical arguments across divergent grammatical frameworks, demonstrating that multilingual cognition cultivates versatile heuristic problem-solving capacities.',
      'Ultimately, these empirical findings illuminate the dynamic plasticity of the human mind. Language acts as an invisible cognitive scaffolding, cultivating habitual attentional pathways and reinforcing specific ontological categories. Bilingual and multilingual individuals frequently report subtle shifts in emotional resonance, ethical framing, and problem-solving strategies when alternating between languages. Far from being a passive communicative vessel, human language remains a generative lens that refracts raw sensory experience into cultural meaning.'
    ],
    keyVocab: [
      { word: 'Predispose', ipa: '/ˌpriː.dɪˈspəʊz/', meaning: 'Khiến ai có khuynh hướng, thiên về điều gì' },
      { word: 'Determinism', ipa: '/dɪˈtɜː.mɪ.nɪ.zəm/', meaning: 'Thuyết quyết định luận (tất định)' },
      { word: 'Egocentric', ipa: '/ˌeɡ.əʊˈsen.trɪk/', meaning: 'Lấy bản thân làm trung tâm tọa độ' },
      { word: 'Geocentric', ipa: '/ˌdʒiː.əʊˈsen.trɪk/', meaning: 'Lấy địa lý/phương hướng tự nhiên làm tọa độ' },
      { word: 'Scaffolding', ipa: '/ˈskæf.əl.dɪŋ/', meaning: 'Giàn giáo, khung nâng đỡ nhận thức' }
    ],
    questions: [
      {
        id: 'rq_c1_1_1',
        type: 'main_idea',
        question: 'Which statement most accurately encapsulates the central thesis of the passage?',
        options: [
          'Human thought is entirely imprisoned by grammar, rendering cross-cultural communication mathematically impossible',
          'While linguistic determinism has been discredited, contemporary evidence indicates that language acts as cognitive scaffolding that shapes perceptual attention and spatial reckoning',
          'Absolute cardinal navigation is biologically superior to egocentric spatial systems in modern urban settings',
          'The Russian language possesses the most sophisticated color vocabulary in global linguistic history'
        ],
        correctIndex: 1,
        explanation: 'Bài viết chỉ ra: dù thuyết quyết định luận cứng nhắc bị bác bỏ, nhưng ngôn ngữ vẫn hoạt động như giàn giáo nhận thức (cognitive scaffolding) hướng dẫn sự chú ý và tư duy không gian.'
      },
      {
        id: 'rq_c1_1_2',
        type: 'detail',
        question: 'According to paragraph 2, what distinction exists in Russian color vocabulary compared to English?',
        options: [
          'Russian lacks words for primary colors like red and green',
          'Russian obligatorily distinguishes between light blue ("goluboy") and dark blue ("siniy")',
          'Russian uses identical terms for blue and green shades',
          'Russian borrows color descriptors exclusively from Latin botanical taxonomies'
        ],
        correctIndex: 1,
        explanation: 'Đoạn 2 chỉ ra: tiếng Nga bắt buộc phân biệt rõ giữa xanh lam sáng ("goluboy") và xanh lam sẫm ("siniy").'
      },
      {
        id: 'rq_c1_1_3',
        type: 'inference',
        question: 'What can be inferred about a Guugu Yimithirr speaker who is blindfolded and spun around inside a closed room?',
        options: [
          'They will instantly lose their orientation and be unable to describe their own bodily position',
          'They will likely retain an accurate internal awareness of cardinal directions like north and south',
          'They will switch automatically to using egocentric words like "left" and "right"',
          'They will be unable to speak their native language until the blindfold is removed'
        ],
        correctIndex: 1,
        explanation: 'Đoạn 3 giải thích người nói Guugu Yimithirr có trực giác phương vị địa lý cực kỳ chuẩn xác ("internal dead-reckoning faculty of extraordinary fidelity"), định hướng la bàn ngay cả trong hang tối.'
      },
      {
        id: 'rq_c1_1_4',
        type: 'vocab_context',
        question: 'In paragraph 2, the word "spectral" refers to:',
        options: [
          'Relating to supernatural ghosts or paranormal apparitions',
          'Pertaining to the distribution of light across the electromagnetic color spectrum',
          'Associated with ancient religious scripts and manuscripts',
          'Describing military defense radar frequencies'
        ],
        correctIndex: 1,
        explanation: '"Spectral" trong ngữ cảnh này thuộc về quang phổ ánh sáng màu sắc ("electromagnetic color spectrum").'
      },
      {
        id: 'rq_c1_1_5',
        type: 'inference',
        question: 'How does modern "neo-Whorfian" theory diverge from the original twentieth-century Sapir-Whorf formulation?',
        options: [
          'It rejects the existence of grammatical rules across human societies',
          'It replaces strict linguistic determinism with habitual attentional steering and cognitive tendencies',
          'It asserts that animal vocalizations follow identical cognitive architectures to human language',
          'It claims that thought precedes language in every developmental milestone'
        ],
        correctIndex: 1,
        explanation: 'Đoạn 2 nhấn mạnh trường phái neo-Whorfian từ bỏ thuyết quyết định luận cứng nhắc ("excessive determinism") để chuyển sang nhận định ngôn ngữ điều hướng sự chú ý nhận thức ("subtly steer automatic perceptual attention").'
      },
      {
        id: 'rq_c1_1_6',
        type: 'detail',
        question: 'What term does the author use in paragraph 3 to describe spatial systems based on observer body orientation?',
        options: [
          'Absolute geocentric reckoning',
          'Egocentric spatial coordinates',
          'Topographical dead-reckoning',
          'Omnipresent relational mapping'
        ],
        correctIndex: 1,
        explanation: 'Đoạn 3 nêu rõ hệ quy chiếu không gian dựa vào cơ thể người quan sát là "egocentric spatial coordinates".'
      },
      {
        id: 'rq_c1_1_7',
        type: 'vocab_context',
        question: 'In the final paragraph, the metaphor comparing language to a "generative lens" implies that language:',
        options: [
          'Distorts reality so severely that objective scientific truth is permanently lost',
          'Actively shapes and refracts sensory experience into meaningful cultural interpretations rather than merely mirroring facts',
          'Functions exactly like an optical microscope used in biological laboratories',
          'Diminishes cognitive ability by filtering out auditory sensations'
        ],
        correctIndex: 1,
        explanation: 'Hình ảnh ẩn dụ "generative lens that refracts raw sensory experience" chỉ ra rằng ngôn ngữ chủ động kiến tạo và định hình trải nghiệm giác quan thành ý nghĩa văn hóa.'
      }
    ]
  },
  {
    id: 'read_c1_2',
    title: 'The Paradox of the Circular Economy: Decoupling Resource Consumption',
    category: 'Environment',
    level: 'C1',
    readTime: '5.5 phút',
    wordCount: 476,
    summary: 'Phân tích nghịch lý kinh tế tuần hoàn: liệu tái chế và chu trình khép kín có thực sự tách rời tăng trưởng kinh tế khỏi suy kiệt tài nguyên trước hiệu ứng bật lại Jevons.',
    content: [
      'In response to accelerating planetary boundary transgressions and ecological degradation, policymakers and industrial strategists have vigorously championed the "circular economy" paradigm. Promoted as a systemic departure from the extractive 19th-century linear model—colloquially summarized as "take, make, use, and dispose"—the circular model aspires to decouple aggregate economic growth from virgin resource extraction. By implementing closed-loop industrial ecology, cradle-to-cradle product lifecycles, and relentless recycling protocols, proponents envision an evergreen capitalist economy where biological nutrients cycle indefinitely and technical materials are repurposed without environmental friction. This alluring vision posits that through sophisticated biomimicry and closed-loop material cascades, modern societies can enjoy indefinite compounding economic expansion while miraculously reducing ecological footprints to net-zero levels.',
      'However, this optimistic narrative encounters insurmountable thermodynamic barriers rooted in the second law of thermodynamics: entropy. In physical reality, no industrial process operates with one hundred percent thermodynamic efficiency. Each successive mechanical or chemical recycling loop inevitably downcycles materials, degrading tensile polymer strength, introducing alloy contaminants, and demanding substantial exergy inputs. For instance, while structural metals like titanium or copper are theoretically infinitely recyclable, secondary smelting processes generate toxic dross, consume colossal electrical currents, and lose minute percentage fractions to mechanical dispersion. Consequently, an industrial system cannot sustain perpetual growth solely on recycled loops without constant infusions of virgin ore.',
      'An equally formidable obstacle arises from behavioral economics: the Jevons Paradox, also known as the macroeconomic rebound effect. First documented in 1865 regarding coal efficiency, this economic mechanism posits that technological advancements that increase the efficiency of a resource frequently lower its effective unit cost, which subsequently stimulates aggregate systemic demand rather than reducing total consumption. In contemporary circular supply chains, secondary recycled plastics and remanufactured modular electronics reduce per-unit manufacturing costs. Rather than stabilizing planetary resource throughput, these cost reductions frequently stimulate consumer turnover and foster novel commercial consumption vectors, neutralizing ecological gains. Consequently, historical data suggests that resource efficiency gains routinely translate into lower consumer prices, which invariably stimulates aggregate production volumes and expands total ecological extraction across international trade corridors.',
      'Crucially, the circular economy paradox intersects with acute geopolitical frictions and critical mineral supply chains. The global green transition toward electric vehicles, offshore wind turbines, and photovoltaic grids requires astronomical quantities of rare earth elements, lithium, nickel, and cobalt. Because global recycling infrastructure remains nascent and economically expensive compared to cheap open-pit mining in developing regions, the primary demand for virgin ores will continue to expand exponentially for decades before secondary material stocks reach sufficient recycling volumes.',
      'Therefore, ecological economists contend that true environmental decoupling cannot be achieved merely through technological optimization or circular lip-service. A viable global sustainability architecture demands rigorous "sufficiency policies" that enforce hard macro-level resource extraction caps, penalize planned obsolescence, and decouple societal well-being from perpetual GDP expansion. Without deliberate limits on absolute material throughput, the circular economy risks serving as an ideological greenwash that legitimizes unsustainable industrial extraction.'
    ],
    keyVocab: [
      { word: 'Decouple', ipa: '/diːˈkʌp.əl/', meaning: 'Tách rời, ngắt liên kết tương hỗ' },
      { word: 'Thermodynamics', ipa: '/ˌθɜː.məʊ.daɪˈnæm.ɪks/', meaning: 'Nhiệt động lực học' },
      { word: 'Entropy', ipa: '/ˈen.trə.pi/', meaning: 'Độ mất trật tự, năng lượng hao tán không thể thu hồi' },
      { word: 'Rebound effect', ipa: '/ˈriː.baʊnd ɪˌfekt/', meaning: 'Hiệu ứng bật lại (tiết kiệm hiệu suất dẫn đến tiêu thụ nhiều hơn)' },
      { word: 'Throughput', ipa: '/ˈθruː.pʊt/', meaning: 'Lưu lượng nguyên vật liệu luân chuyển trong hệ thống' }
    ],
    questions: [
      {
        id: 'rq_c1_2_1',
        type: 'main_idea',
        question: 'What is the primary argument advanced by the author regarding the circular economy?',
        options: [
          'Recycling should be discontinued immediately because it causes more pollution than open landfills',
          'While the circular economy is promoted as a green solution, thermodynamic entropy and the Jevons paradox prevent it from achieving absolute decoupling without hard caps on resource extraction',
          'The linear economic model is thermodynamically superior to closed-loop industrial ecology',
          'Consumer electronics companies have successfully solved all material degradation challenges'
        ],
        correctIndex: 1,
        explanation: 'Luận điểm chính: Kinh tế tuần hoàn gặp rào cản nhiệt động lực học (entropy) và nghịch lý Jevons, do đó không thể tách rời tăng trưởng khỏi tiêu thụ tài nguyên nếu thiếu các hạn mức khai thác tuyệt đối.'
      },
      {
        id: 'rq_c1_2_2',
        type: 'detail',
        question: 'According to paragraph 2, why is infinite recycling physically impossible in industrial reality?',
        options: [
          'Governments explicitly prohibit the reuse of scrap metal',
          'The second law of thermodynamics (entropy) causes unavoidable material degradation, contaminant accumulation, and energy dissipation with each cycle',
          'Secondary smelting produces zero carbon emissions',
          'Factory workers refuse to operate electric smelting equipment'
        ],
        correctIndex: 1,
        explanation: 'Đoạn 2 nêu rõ: Định luật 2 nhiệt động lực học (entropy) làm suy thoái vật liệu, tích tụ tạp chất và đòi hỏi tiêu tốn năng lượng trong mỗi chu kỳ tái chế.'
      },
      {
        id: 'rq_c1_2_3',
        type: 'inference',
        question: 'How does the Jevons Paradox undermine the environmental objectives of circular manufacturing?',
        options: [
          'By making recycled goods so expensive that consumers stop buying them',
          'By lowering per-unit production costs, which subsequently drives up overall consumer consumption and offsets material savings',
          'By forcing corporations to extract coal instead of using renewable electricity',
          'By causing immediate technological obsolescence across industrial robotic factories'
        ],
        correctIndex: 1,
        explanation: 'Đoạn 3 giải thích: Nghịch lý Jevons khiến giá thành sản phẩm giảm, từ đó kích thích tổng nhu cầu tiêu dùng tăng vọt, triệt tiêu lợi ích tiết kiệm tài nguyên ban đầu.'
      },
      {
        id: 'rq_c1_2_4',
        type: 'vocab_context',
        question: 'In paragraph 1, the phrase "cradle-to-cradle" describes a design philosophy that:',
        options: [
          'Focuses exclusively on childcare and pediatric hospital equipment',
          'Designs products whose constituent materials can be perpetually reused or safely returned to biological systems',
          'Extracts raw minerals without paying governmental mining royalties',
          'Encourages consumers to discard electronic products after short trial periods'
        ],
        correctIndex: 1,
        explanation: '"Cradle-to-cradle" là triết lý thiết kế từ nôi đến nôi, nơi sản phẩm được tái tạo tuần hoàn vĩnh viễn hoặc hoàn trả an toàn về môi trường sinh thái.'
      },
      {
        id: 'rq_c1_2_5',
        type: 'negative_fact',
        question: 'Which of the following is NOT proposed in the conclusion as a necessary intervention for genuine ecological sustainability?',
        options: [
          'Enforcing hard macro-level limits on virgin resource extraction',
          'Penalizing corporate planned obsolescence through regulatory legislation',
          'Unconditionally subsidizing rapid GDP growth regardless of environmental throughput',
          'Decoupling human societal well-being from continuous economic output expansion'
        ],
        correctIndex: 2,
        explanation: 'Đoạn cuối khuyến nghị áp trần khai thác, phạt lỗi thời có chủ đích và tách rời thịnh vượng khỏi GDP. Việc trợ cấp vô điều kiện cho tăng trưởng GDP không hề được đề xuất.'
      },
      {
        id: 'rq_c1_2_6',
        type: 'vocab_context',
        question: 'In the final paragraph, the term "greenwash" refers to:',
        options: [
          'An industrial detergent used to sanitize secondary recycled glass',
          'Deceptive rhetoric that makes an unsustainable practice appear environmentally benevolent',
          'A sustainable agricultural irrigation technique used in arid river deltas',
          'The biological process through which wetlands filter chemical water toxins'
        ],
        correctIndex: 1,
        explanation: '"Greenwash" (tẩy xanh) là hành vi truyền thông gây hiểu lầm, biến các hoạt động gây hại thành thân thiện với môi trường.'
      },
      {
        id: 'rq_c1_2_7',
        type: 'inference',
        question: 'What underlying assumption of conventional capitalist economics does the author challenge most directly?',
        options: [
          'That private enterprise should be forbidden from inventing new technologies',
          'That indefinite economic growth can be sustained within finite planetary ecological boundaries purely through technological efficiency',
          'That workers should be compensated for industrial factory labor',
          'That international shipping routes should be regulated by maritime treaties'
        ],
        correctIndex: 1,
        explanation: 'Tác giả chất vấn trực tiếp giả định kinh tế truyền thống rằng tăng trưởng kinh tế có thể duy trì vô hạn trong một hành tinh hữu hạn chỉ nhờ tối ưu hóa công nghệ.'
      }
    ]
  },
  {
    id: 'read_c1_3',
    title: 'Epistemic Humility and Metacognition in the Algorithmic Information Age',
    category: 'Education',
    level: 'C1',
    readTime: '5.5 phút',
    wordCount: 463,
    summary: 'Tìm hiểu vai trò của đức tính khiêm nhường tri thức (Epistemic Humility) và siêu nhận thức trong việc nhận diện thiên kiến nhận thức và đối phó bong bóng lọc thông tin thuật toán.',
    content: [
      'In contemporary epistemic landscapes, the ubiquitous proliferation of algorithmic recommendation engines has dramatically transformed how knowledge is distributed and validated. Rather than cultivating enlightened civic discourse, hyper-personalized engagement algorithms optimize content feeds for emotional valence and ideological conformity. By feeding users material that perpetually confirms preexisting dogmas, these systems construct insular "echo chambers" and epistemic bubbles. In this fragmented media ecosystem, epistemic bubbles actively insulate participants from alternative perspectives, while echo chambers systematically cultivate intense suspicion and hostility toward any evidentiary sources outside the chosen tribal in-group. Within these synthetic feedback loops, intellectual confidence becomes paradoxically detached from actual cognitive competence, exacerbating the Dunning-Kruger effect on an unprecedented civilizational scale.',
      'To navigate this hyper-saturated communicative terrain, cognitive psychologists and epistemologists advocate for the cultivation of "epistemic humility." Unlike self-effacing modesty or paralyzing skepticism, epistemic humility denotes a rigorous metacognitive disposition: the conscious recognition of the boundaries, vulnerabilities, and potential flaws within one\'s own epistemic framework. An epistemically humble individual recognizes that human reasoning is systematically constrained by cognitive biases, selective attention, and cultural conditioning, and therefore treats personal certitude as an unvetted working hypothesis rather than an absolute inviolable truth. Rather than viewing self-correction as an embarrassing intellectual deficit, an epistemically humble scholar actively treats conflicting data as a rare cognitive opportunity to refine and elevate their own internal mental models.',
      'Metacognition serves as the operational engine of epistemic humility. Defined as "cognition about cognition" or the conscious monitoring and regulation of one\'s own mental operations, metacognitive vigilance requires learners to scrutinize the evidentiary pedigree of their beliefs. When encountering controversial data, a metacognitively trained mind actively questions: "What cognitive heuristic led me to this rapid conclusion? What contradictory data sources have I systematically ignored due to affective discomfort? Am I defending this thesis because it is logically rigorous, or because it affirms my tribal identity?"',
      'Beyond individual metacognitive self-regulation, cultivating epistemic humility requires the intentional design of deliberative collective institutions. In traditional academic communities, peer review, adversarial collaboration, and public replication consortia institutionalize humility by subjecting personal hypotheses to rigorous scrutiny. Conversely, corporate digital architectures disincentivize intellectual modesty by rewarding tribal belligerence and sensationalism with algorithmic visibility. Democratic societies must therefore treat epistemically humble civic literacy as an indispensable infrastructural imperative for safeguarding truth and rational political deliberation.',
      'Integrating epistemic humility into 21st-century educational curricula requires a fundamental paradigm shift away from rote memorization toward dialectical inquiry. Universities and schools must teach students to embrace cognitive dissonance, evaluate ideological counter-arguments with genuine intellectual charity, and view the correction of their own misconceptions as cognitive triumphs rather than humiliating defeats. In an age dominated by synthetic certainty and algorithmic polarization, the capacity to candidly declare "I do not know, and my current perspective may be incomplete" represents the ultimate marker of mature intellect.'
    ],
    keyVocab: [
      { word: 'Epistemic', ipa: '/ˌep.ɪˈstiː.mɪk/', meaning: 'Thuộc về nhận thức luận, liên quan đến bản chất tri thức' },
      { word: 'Humility', ipa: '/hjuːˈmɪl.ə.ti/', meaning: 'Sự khiêm nhường, tính khiêm tốn' },
      { word: 'Metacognition', ipa: '/ˌmet.ə.kɒɡˈnɪʃ.ən/', meaning: 'Siêu nhận thức (nhận thức về chính quá trình tư duy)' },
      { word: 'Heuristic', ipa: '/hjuːˈrɪs.tɪk/', meaning: 'Đường tắt nhận thức, lối phán đoán dựa vào kinh nghiệm nhanh' },
      { word: 'Certitude', ipa: '/ˈsɜː.tɪ.tʃuːd/', meaning: 'Sự tin chắc tuyệt đối, niềm tin quả quyết' }
    ],
    questions: [
      {
        id: 'rq_c1_3_1',
        type: 'main_idea',
        question: 'What is the primary thesis of the article regarding epistemic humility?',
        options: [
          'Social media platforms should be completely outlawed by educational institutions',
          'Epistemic humility, sustained by active metacognitive monitoring, is an essential cognitive virtue for resisting algorithmic echo chambers and intellectual arrogance',
          'Human intelligence has irrevocably declined since the invention of the printing press',
          'Metacognition is a genetic trait that cannot be cultivated through academic training'
        ],
        correctIndex: 1,
        explanation: 'Luận điểm chính: Sự khiêm nhường tri thức (epistemic humility) kết hợp với siêu nhận thức (metacognition) là đức tính nhận thức cốt lõi giúp con người vượt qua bong bóng thông tin thuật toán.'
      },
      {
        id: 'rq_c1_3_2',
        type: 'detail',
        question: 'According to paragraph 2, how does epistemic humility differ from paralyzing skepticism or modesty?',
        options: [
          'It forces individuals to reject all forms of empirical scientific evidence',
          'It denotes a conscious, rigorous metacognitive recognition of the limits and potential fallibility of one\'s own understanding',
          'It requires students to remain completely silent during classroom academic debates',
          'It prioritizes corporate loyalty over personal moral principles'
        ],
        correctIndex: 1,
        explanation: 'Đoạn 2 nêu rõ: Epistemic humility là thái độ siêu nhận thức có ý thức về giới hạn và khả năng sai lầm trong khung tri thức của chính mình.'
      },
      {
        id: 'rq_c1_3_3',
        type: 'inference',
        question: 'Why do algorithmic recommendation engines exacerbate the Dunning-Kruger effect according to paragraph 1?',
        options: [
          'They slow down home internet connection speeds, causing frustration',
          'They perpetually reinforce users\' existing beliefs within echo chambers, inflating subjective confidence while isolating them from critical counter-evidence',
          'They deliberately delete encyclopedic dictionaries from personal computers',
          'They penalize users who read academic peer-reviewed journal articles'
        ],
        correctIndex: 1,
        explanation: 'Đoạn 1 nêu: Thuật toán tạo ra các vòng lặp phản hồi khép kín (echo chambers) liên tục xác nhận định kiến sẵn có, khiến niềm tin chủ quan tăng cao trong khi năng lực nhận thức thực tế bị cô lập.'
      },
      {
        id: 'rq_c1_3_4',
        type: 'vocab_context',
        question: 'In paragraph 3, the phrase "evidentiary pedigree" refers to:',
        options: [
          'The genetic ancestry of laboratory research animals',
          'The verifiable origin, credibility, and logical validity of supporting proof behind a claim',
          'The financial salary paid to university research professors',
          'The historical printing techniques used in 18th-century European publishing'
        ],
        correctIndex: 1,
        explanation: '"Evidentiary pedigree" chỉ xuất xứ, độ tin cậy và tính hợp lệ logic của các bằng chứng củng cố cho một niềm tin.'
      },
      {
        id: 'rq_c1_3_5',
        type: 'detail',
        question: 'What three reflexive questions are highlighted in paragraph 3 as examples of metacognitive vigilance?',
        options: [
          'Questions examining typing speed, monitor brightness, and office posture',
          'Questions probing cognitive heuristics, unexamined counter-data, and tribal identity motivations',
          'Questions calculating investment returns, insurance liabilities, and travel expenses',
          'Questions comparing hardware CPU architectures, cache memory sizes, and bus bandwidth'
        ],
        correctIndex: 1,
        explanation: 'Đoạn 3 nêu 3 câu hỏi tự vấn: thiên kiến đường tắt (heuristic), dữ liệu trái chiều bị phớt lờ, và động cơ bảo vệ bản sắc phe nhóm (tribal identity).'
      },
      {
        id: 'rq_c1_3_6',
        type: 'inference',
        question: 'According to paragraph 5, how should modern universities view a student\'s willingness to correct their own misconceptions?',
        options: [
          'As an unacceptable academic failure that warrants grade penalties',
          'As a profound cognitive victory rather than a humiliating personal defeat',
          'As undeniable evidence that earlier course lectures were ineffective',
          'As a symptom of declining attention spans in adolescent demographics'
        ],
        correctIndex: 1,
        explanation: 'Đoạn 5 nêu: Đại học cần dạy sinh viên coi việc tự sửa chữa quan niệm sai lầm của bản thân là một "thắng lợi nhận thức" (cognitive triumph) thay vì sự bại trận bẽ bàng.'
      },
      {
        id: 'rq_c1_3_7',
        type: 'vocab_context',
        question: 'In the final sentence, the phrase "synthetic certainty" refers to:',
        options: [
          'An artificially manufactured and superficial sense of conviction fueled by algorithmic echo chambers',
          'Chemical laboratory polymers used in surgical medical sutures',
          'Mathematical formulas verified by automated computer proof-checkers',
          'A reliable guarantee of permanent data encryption over public networks'
        ],
        correctIndex: 0,
        explanation: '"Synthetic certainty" chỉ cảm giác tin chắc nhân tạo, ảo tưởng và hời hợt được nuôi dưỡng bởi các buồng vang thông tin thuật toán.'
      }
    ]
  }
];
