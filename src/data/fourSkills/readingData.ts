import { ReadingLesson } from './types';

export const READING_LESSONS: ReadingLesson[] = [
  {
    id: 'read_1',
    title: 'How Modern Large Language Models Generate Code',
    category: 'Tech & AI',
    level: 'B2',
    readTime: '4.5 phút',
    wordCount: 385,
    summary: 'Phân tích cơ chế sinh mã nguồn của các mô hình AI tạo sinh dựa trên kiến trúc Transformer, cơ chế Attention, và bản chất xác suất trong kỹ thuật phần mềm.',
    content: [
      'In recent years, artificial intelligence has fundamentally revolutionized the landscape of software engineering. Modern generative AI coding assistants and intelligent pair programmers rely on deep neural networks trained on hundreds of petabytes of open-source repositories, technical documentation, and enterprise codebases across dozens of programming languages. These models can autocomplete complex algorithms, generate comprehensive unit test suites, translate legacy code across languages, and formulate explanatory comments in fractions of a second.',
      'At the architectural core of these state-of-the-art models lies the Transformer architecture, pioneered in 2017 and powered by multi-head self-attention mechanisms. When an engineer submits a prompt, docstring, or incomplete function definition, the tokenizer decomposes the input into numerical vector embeddings. The multi-head attention layers calculate non-linear statistical relationships between distant syntax tokens across vast context windows. This contextual awareness allows the model to preserve variable scopes, anticipate matching closing brackets, deduce return types, and satisfy language-specific syntactic grammars with astonishing precision.',
      'However, software engineers must maintain a rigorous distinction between statistical plausibility and computational truth. Large language models do not possess an internal runtime environment, a logical execution engine, or true conceptual comprehension; their output is fundamentally probabilistic rather than deterministic. When generating code, the model predicts the token sequences that have the highest mathematical probability of following the input prompt based on patterns ingested during training. Consequently, generated code may look syntactically elegant yet contain subtle logic flaws, deprecated library APIs, or critical security vulnerabilities.',
      'Therefore, professional software craftsmanship in the era of generative AI requires elevated vigilance rather than blind reliance. Automated regression testing, static type analysis, continuous security scanning, and diligent human code reviews remain indispensable pillars of modern software delivery. Developers who master the art of prompt engineering and pair AI velocity with rigorous verification will define the next frontier of high-impact engineering.'
    ],
    keyVocab: [
      { word: 'Probabilistic', ipa: '/ˌprɒb.ə.bɪˈlɪs.tɪk/', meaning: 'Thuộc về xác suất, mang tính thống kê' },
      { word: 'Deterministic', ipa: '/dɪˌtɜː.mɪˈnɪs.tɪk/', meaning: 'Tất định, xác định rõ ràng không ngẫu nhiên' },
      { word: 'Embeddings', ipa: '/ɪmˈbed.ɪŋz/', meaning: 'Các biểu diễn vector trong không gian nhiều chiều' },
      { word: 'Vigilance', ipa: '/ˈvɪdʒ.əl.əns/', meaning: 'Sự cảnh giác, cẩn trọng cao độ' },
      { word: 'Indispensable', ipa: '/ˌɪn.dɪˈspen.sə.bəl/', meaning: 'Không thể thiếu, thiết yếu tuyệt đối' }
    ],
    questions: [
      {
        id: 'rq1_1',
        type: 'main_idea',
        question: 'What is the primary thesis of the article regarding AI code generation?',
        options: [
          'AI models will replace all human programmers within the next twelve months',
          'Generative AI coding tools leverage the Transformer architecture for remarkable syntactic speed, but their probabilistic nature requires human verification and rigorous automated testing',
          'Programmers should avoid using AI tools entirely due to security vulnerabilities',
          'The Transformer architecture was invented to replace traditional relational databases'
        ],
        correctIndex: 1,
        explanation: 'Bài viết khẳng định AI dùng Transformer rất mạnh về cú pháp nhưng vì bản chất là xác suất (probabilistic) nên bắt buộc cần kiểm thử tự động và con người review.'
      },
      {
        id: 'rq1_2',
        type: 'detail',
        question: 'What specific mechanism within the Transformer architecture allows the model to capture relationships between distant tokens?',
        options: [
          'Multi-head self-attention mechanism',
          'Physical copper cable connectors',
          'Hard drive defragmentation loops',
          'Analog sound wave amplifiers'
        ],
        correctIndex: 0,
        explanation: 'Đoạn 2 nêu rõ: "powered by multi-head self-attention mechanisms... calculate non-linear statistical relationships between distant syntax tokens".'
      },
      {
        id: 'rq1_3',
        type: 'vocab_context',
        question: 'In paragraph 3, the phrase "probabilistic rather than deterministic" means that the AI model:',
        options: [
          'Executes the code in a real processor before returning the result',
          'Predicts the most mathematically likely next tokens based on statistical training data rather than guaranteeing logical truth',
          'Only works on computers powered by solar energy',
          'Generates completely random numbers without any patterns'
        ],
        correctIndex: 1,
        explanation: '"Probabilistic rather than deterministic" chỉ bản chất dự đoán chuỗi token có xác suất toán học cao nhất từ dữ liệu học chứ không phải suy luận tất định logic.'
      },
      {
        id: 'rq1_4',
        type: 'negative_fact',
        question: 'Which of the following is NOT mentioned in paragraph 1 as a capability of modern generative AI coding tools?',
        options: [
          'Autocompleting complex algorithms',
          'Generating unit test suites',
          'Translating legacy code across languages',
          'Physically manufacturing computer silicon microchips in a factory'
        ],
        correctIndex: 3,
        explanation: 'Đoạn 1 nhắc đến autocomplete, sinh unit tests và dịch code. Việc sản xuất vi mạch silicon vật lý không hề có.'
      },
      {
        id: 'rq1_5',
        type: 'inference',
        question: 'What does the author imply about code that "looks syntactically elegant"?',
        options: [
          'It is guaranteed to be 100% free of bugs and ready for production deployment',
          'Visual elegance in code syntax does not guarantee the absence of security vulnerabilities or subtle logic flaws',
          'Developers should reject clean code and write messy code instead',
          'Only junior developers care about syntax elegance'
        ],
        correctIndex: 1,
        explanation: 'Đoạn 3 ngụ ý rằng mã trông đẹp mắt về cú pháp chưa chắc đã đúng logic hoặc an toàn về bảo mật.'
      },
      {
        id: 'rq1_6',
        type: 'detail',
        question: 'According to the final paragraph, what four practices are called "indispensable pillars" of modern software delivery?',
        options: [
          'Printing code on paper, using floppy disks, turning off monitors, and working in darkness',
          'Automated regression testing, static type analysis, continuous security scanning, and diligent human code reviews',
          'Social media marketing, flyer distribution, office decoration, and logo redesign',
          'Canceling cloud subscriptions, deleting Git repositories, avoiding code comments, and using plain text passwords'
        ],
        correctIndex: 1,
        explanation: 'Đoạn cuối nêu rõ 4 trụ cột: automated regression testing, static type analysis, continuous security scanning, và human code reviews.'
      },
      {
        id: 'rq1_7',
        type: 'vocab_context',
        question: 'In the final paragraph, the word "vigilance" is closest in meaning to:',
        options: ['Carelessness and neglect', 'Watchful alertness and caution', 'Extreme fatigue and sleepiness', 'Rapid typing speed'],
        correctIndex: 1,
        explanation: '"Vigilance" có nghĩa là sự cảnh giác, cẩn trọng và tỉnh táo theo dõi ("watchful alertness and caution").'
      }
    ]
  },
  {
    id: 'read_2',
    title: 'The Neuroscience of Spaced Repetition & Long-Term Memory',
    category: 'Science & Habit',
    level: 'B2',
    readTime: '4.5 phút',
    wordCount: 410,
    summary: 'Nghiên cứu cơ chế thần kinh học của trí nhớ dài hạn, đường cong lãng quên Ebbinghaus và cách thuật toán lặp lại ngắt quãng (SRS) tối ưu hóa kết nối synap.',
    content: [
      'Human memory is fundamentally engineered for biological adaptation and cognitive efficiency rather than exhaustive, infinite data storage. In 1885, German experimental psychologist Hermann Ebbinghaus published his landmark findings on memory retention, introducing the celebrated "Forgetting Curve". Ebbinghaus discovered that without active reinforcement, human learners lose more than fifty percent of newly acquired information within twenty-four hours, and up to eighty percent within a month. This rapid decay is not an anatomical defect; it is a neurological filter that prevents the conscious mind from being overwhelmed by transient daily sensory input.',
      'To counteract this natural memory decay, modern cognitive scientists developed the Spaced Repetition System (SRS). Rather than engaging in massed practice or "cramming"—where material is repeated intensely over a compressed timeframe—SRS schedules review sessions across expanding, mathematically optimized intervals. By calculating difficulty ratings and previous recall accuracy, algorithms such as SM-2 present vocabulary items at the exact psychological threshold where a memory trace is on the verge of fading from working memory.',
      'Neurologically, each deliberate act of active retrieval triggers an extraordinary biological phenomenon called Long-Term Potentiation (LTP). When a learner exerts mental effort to recall a foreign word rather than passively reading its translation, specific neural circuits in the hippocampus and cerebral cortex fire synchronously. This repeated synchronous firing strengthens the synaptic junctions between neurons through increased neurotransmitter release and the physical growth of dendritic spines. Over time, volatile short-term electrical impulses consolidate into durable, permanent neural pathways.',
      'In language acquisition, combining spaced repetition with contextual application produces compounding returns. When learners encounter vocabulary across varied reading articles, listening dialogues, and roleplay exercises, the brain builds rich associative semantic webs. Ultimately, spaced repetition transforms vocabulary acquisition from an arduous test of willpower into an automated, scientifically validated habit of lifelong mastery.'
    ],
    keyVocab: [
      { word: 'Seminal', ipa: '/ˈsem.ɪ.nəl/', meaning: 'Mang tính chất nền tảng, mở đường' },
      { word: 'Potentiation', ipa: '/pəˌten.ʃiˈeɪ.ʃən/', meaning: 'Sự tăng cường tiềm lực sinh học' },
      { word: 'Consolidate', ipa: '/kənˈsɒl.ɪ.deɪt/', meaning: 'Củng cố, làm cho vững chắc lâu dài' },
      { word: 'Volatile', ipa: '/ˈvɒl.ə.taɪl/', meaning: 'Dễ biến đổi, mau phai nhạt' },
      { word: 'Arduous', ipa: '/ˈɑː.dʒu.əs/', meaning: 'Gian nan, cực nhọc đầy thử thách' }
    ],
    questions: [
      {
        id: 'rq2_1',
        type: 'main_idea',
        question: 'What is the primary subject of the text?',
        options: [
          'The historical biography of German psychologists in the nineteenth century',
          'How the neuroscience of spaced repetition and active retrieval counteracts memory decay to build permanent neural connections',
          'Why computer microchips have more storage capacity than human brains',
          'A comparative study of traditional paper flashcards versus mobile smartphone batteries'
        ],
        correctIndex: 1,
        explanation: 'Bài viết giải thích cơ chế sinh học thần kinh của lặp lại ngắt quãng (SRS) và hồi tưởng chủ động giúp chống lại đường cong quên lãng để hình thành trí nhớ dài hạn.'
      },
      {
        id: 'rq2_2',
        type: 'detail',
        question: 'According to the Forgetting Curve described in paragraph 1, how much information do learners lose within 24 hours without active recall?',
        options: [
          'Less than one percent',
          'More than fifty percent',
          'Exactly one hundred percent',
          'Zero percent'
        ],
        correctIndex: 1,
        explanation: 'Đoạn 1 nêu: "human learners lose more than fifty percent of newly acquired information within twenty-four hours".'
      },
      {
        id: 'rq2_3',
        type: 'vocab_context',
        question: 'In paragraph 2, the word "cramming" refers to:',
        options: [
          'Intensely studying large amounts of material in a short, compressed timeframe',
          'Eating large quantities of food before an examination',
          'Exercising physical muscles in a gymnasium',
          'Sleeping for twelve consecutive hours'
        ],
        correctIndex: 0,
        explanation: '"Cramming" là hành vi học nhồi nhét cường độ cao trong khoảng thời gian ngắn trước kỳ thi.'
      },
      {
        id: 'rq2_4',
        type: 'negative_fact',
        question: 'Which of the following is NOT described as a neurological benefit of Long-Term Potentiation (LTP)?',
        options: [
          'Strengthening of synaptic junctions between neurons',
          'Increased release of neurotransmitters',
          'Physical growth of dendritic spines',
          'Complete deletion of the hippocampus from the brain'
        ],
        correctIndex: 3,
        explanation: 'LTP làm mạnh synap, tăng chất dẫn truyền thần kinh và phát triển gai dendrite. Việc xóa bỏ hippocampus là hoàn toàn sai.'
      },
      {
        id: 'rq2_5',
        type: 'inference',
        question: 'Why does passive reading produce weaker memory retention compared to active retrieval?',
        options: [
          'Passive reading does not trigger the deliberate mental exertion and synchronous neural firing that drives Long-Term Potentiation',
          'Books are too heavy for the brain to hold',
          'Passive reading causes immediate blindness in adult learners',
          'Reading words in English drains the electrical battery of the brain'
        ],
        correctIndex: 0,
        explanation: 'Đọc thụ động không kích hoạt sự gắng sức hồi tưởng chủ động và đồng bộ nơ-ron cần thiết cho LTP củng cố synap.'
      },
      {
        id: 'rq2_6',
        type: 'detail',
        question: 'What is the optimal timing for reviewing an item according to spaced repetition algorithms?',
        options: [
          'Every three seconds without stopping',
          'At the exact psychological threshold where a memory trace is on the verge of fading from working memory',
          'Once every twenty years',
          'Only after the learner has completely forgotten their own native language'
        ],
        correctIndex: 1,
        explanation: 'SRS tính toán lịch ôn tập ngay tại thời điểm dấu vết trí nhớ chuẩn bị phai nhạt khỏi bộ nhớ làm việc.'
      },
      {
        id: 'rq2_7',
        type: 'vocab_context',
        question: 'In the final paragraph, the word "arduous" is closest in meaning to:',
        options: ['Effortless and simple', 'Strenuous, difficult, and demanding', 'Pleasant and relaxing', 'Extremely cheap'],
        correctIndex: 1,
        explanation: '"Arduous" có nghĩa là gian nan, vất vả và đòi hỏi nhiều nỗ lực ("strenuous, difficult, and demanding").'
      }
    ]
  },
  {
    id: 'read_3',
    title: 'Clean Architecture: Decoupling Domain Logic in Enterprise Systems',
    category: 'Tech & AI',
    level: 'C1',
    readTime: '4.5 phút',
    wordCount: 420,
    summary: 'Nguyên lý thiết kế Clean Architecture của Robert C. Martin, nguyên tắc Đảo ngược phụ thuộc (DIP) và cách tách biệt Domain Core khỏi hạ tầng.',
    content: [
      'In large-scale enterprise software systems, architectures frequently suffer from insidious structural erosion over time. When business requirements evolve rapidly under aggressive market deadlines, software engineering teams often take architectural shortcuts, directly mingling core business logic with user interface frameworks, relational database drivers, and third-party cloud SDKs. When domain entities contain hardcoded SQL queries or HTTP request parsers, even routine framework version upgrades or schema alterations trigger cascading regression defects across the entire corporate codebase.',
      'To resolve this chronic fragility, software pioneer Robert C. Martin codified the principles of Clean Architecture. Clean Architecture establishes concentric boundaries around software components, governed by a fundamental rule known as the Dependency Inversion Principle: source code dependencies must point inward, toward high-level business policies. The innermost circle comprises Enterprise Business Rules and Entities, surrounded by Application Use Cases. Outer infrastructure layers—such as database engines, web frameworks, payment gateways, and graphical user interfaces—are treated as replaceable peripheral plugins that depend inward on abstract domain interfaces.',
      'This strict decoupling delivers profound practical dividends for long-term maintainability and software quality. Because core business logic has zero direct dependencies on external frameworks or databases, the entire use case layer can be tested in isolation. Software engineers can execute thousands of comprehensive domain unit tests in sub-second execution runs using in-memory mock repositories, completely independent of live network connections or database container instances. Furthermore, teams can easily swap underlying storage technologies—such as migrating from PostgreSQL to DynamoDB—without altering a single line of core business rules.',
      'Ultimately, adopting Clean Architecture requires disciplined upfront investment and architectural conviction. While writing abstract interfaces and data transfer mappers introduces initial structural overhead, it safeguards enterprise applications against obsolescence and vendor lock-in, ensuring that software assets remain maintainable, extensible, and evergreen for decades.'
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
          'Replacing all human developers with automated compiler scripts',
          'Decoupling core business domain logic from volatile external frameworks, databases, and UI delivery mechanisms to ensure testability and long-term maintainability',
          'Purchasing the most expensive cloud servers available on the market',
          'Deleting all database tables to reduce storage costs'
        ],
        correctIndex: 1,
        explanation: 'Mục tiêu cốt lõi của Clean Architecture là tách rời nghiệp vụ khỏi framework/database/UI để đảm bảo khả năng kiểm thử và bảo trì bền vững.'
      },
      {
        id: 'rq3_2',
        type: 'detail',
        question: 'According to the Dependency Inversion Principle in Clean Architecture, which direction must source code dependencies point?',
        options: [
          'Outward, from core business logic toward database drivers',
          'Inward, from external infrastructure layers toward high-level business policies and entities',
          'Horizontally between unrelated third-party libraries only',
          'Randomly depending on daily developer preferences'
        ],
        correctIndex: 1,
        explanation: 'Đoạn 2 nêu rõ quy tắc then chốt: "source code dependencies must point inward, toward high-level business policies".'
      },
      {
        id: 'rq3_3',
        type: 'vocab_context',
        question: 'In paragraph 1, the word "insidious" is closest in meaning to:',
        options: ['Gradual, subtle, and harmful', 'Extremely fast and obvious', 'Bright and colorful', 'Cheap and affordable'],
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
          'They skip running tests and assume code is correct',
          'Because domain logic does not depend on live databases, tests use fast in-memory mock implementations without network overhead',
          'They use supercomputers that cost millions of dollars per minute',
          'Unit tests only run when the operating system is rebooted'
        ],
        correctIndex: 1,
        explanation: 'Do tầng domain hoàn toàn độc lập với database thật, kiểm thử có thể chạy cực nhanh trên RAM dùng mock repository.'
      },
      {
        id: 'rq3_6',
        type: 'detail',
        question: 'Who is cited as the pioneer that codified the principles of Clean Architecture?',
        options: ['Robert C. Martin', 'Hermann Ebbinghaus', 'Isaac Newton', 'Albert Einstein'],
        correctIndex: 0,
        explanation: 'Đoạn 2 nêu rõ: "software pioneer Robert C. Martin codified the principles of Clean Architecture".'
      },
      {
        id: 'rq3_7',
        type: 'vocab_context',
        question: 'In the final paragraph, the phrase "vendor lock-in" refers to:',
        options: [
          'Locking office doors when vendors visit the building',
          'A situation where a business becomes dependent on a single proprietary technology vendor and cannot easily switch without massive cost',
          'Buying discounted hardware from physical retail stores',
          'Refusing to pay invoices from electricity companies'
        ],
        correctIndex: 1,
        explanation: '"Vendor lock-in" là tình trạng bị phụ thuộc và trói buộc vào một nhà cung cấp công nghệ duy nhất, khó chuyển đổi do chi phí quá lớn.'
      }
    ]
  }
];
