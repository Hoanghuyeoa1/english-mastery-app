import { ReadingLesson } from '../types';

export const b2ReadingLessons: ReadingLesson[] = [
  {
    id: 'read_1',
    title: 'How Modern Large Language Models Generate Code',
    category: 'Tech & AI',
    level: 'B2',
    readTime: '4.5 phút',
    wordCount: 307,
    summary: 'Phân tích cơ chế sinh mã nguồn của các mô hình AI tạo sinh dựa trên kiến trúc Transformer, cơ chế Attention, và bản chất xác suất trong kỹ thuật phần mềm.',
    content: [
      'In recent years, artificial intelligence has fundamentally revolutionized the landscape of software engineering. Modern generative AI coding assistants and intelligent pair programmers rely on deep neural networks trained on hundreds of petabytes of open-source repositories, technical documentation, and enterprise codebases across dozens of programming languages. These models can autocomplete complex algorithms, generate comprehensive unit test suites, translate legacy code across languages, and formulate explanatory comments in fractions of a second.',
      'At the architectural core of these state-of-the-art models lies the Transformer architecture, pioneered in 2017 and powered by multi-head self-attention mechanisms. When an engineer submits a prompt, docstring, or incomplete function definition, the tokenizer decomposes the input into numerical vector embeddings. The multi-head attention layers calculate non-linear statistical relationships between distant syntax tokens across vast context windows. This contextual awareness allows the model to preserve variable scopes, anticipate matching closing brackets, deduce return types, and satisfy language-specific syntactic grammars with astonishing precision.',
      'However, software engineers must maintain a rigorous distinction between statistical plausibility and computational truth. Large language models do not possess an internal runtime environment, a logical execution engine, or true conceptual comprehension; their output is fundamentally probabilistic rather than deterministic. When generating code, the model predicts the token sequences that have the highest mathematical probability of following the input prompt based on patterns ingested during training. Consequently, generated code may look syntactically elegant yet contain subtle logic flaws, deprecated library APIs, or critical security vulnerabilities that escape superficial visual inspection.',
      'Therefore, professional software craftsmanship in the era of generative AI requires elevated vigilance rather than blind reliance. Automated regression testing, static type analysis, continuous security scanning, and diligent human code reviews remain indispensable pillars of modern software delivery. Developers who master the art of prompt engineering and pair AI velocity with rigorous verification will define the next frontier of high-impact engineering while safeguarding production stability.'
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
          'AI models will entirely replace human software engineers within the next twelve months',
          'Generative AI coding tools leverage the Transformer architecture for remarkable syntactic speed, but their probabilistic nature requires human verification and rigorous automated testing',
          'Programmers should completely avoid using AI tools due to inherent security vulnerabilities',
          'The Transformer architecture was developed primarily to optimize legacy database indexing'
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
          'Hardware-accelerated arithmetic logic units',
          'Cyclic redundancy checksum algorithms',
          'Synchronous input-output thread pooling'
        ],
        correctIndex: 0,
        explanation: 'Đoạn 2 nêu rõ: "powered by multi-head self-attention mechanisms... calculate non-linear statistical relationships between distant syntax tokens".'
      },
      {
        id: 'rq1_3',
        type: 'vocab_context',
        question: 'In paragraph 3, the phrase "probabilistic rather than deterministic" means that the AI model:',
        options: [
          'Executes the code in an isolated sandbox environment before outputting results',
          'Predicts the most mathematically likely next tokens based on statistical training data rather than guaranteeing logical truth',
          'Follows rigid algorithmic flowcharts programmed manually by computer scientists',
          'Generates arbitrary syntax sequences without evaluating grammatical conventions'
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
          'Generating comprehensive unit test suites',
          'Translating legacy code across languages',
          'Guaranteeing mathematical correctness and runtime execution safety'
        ],
        correctIndex: 3,
        explanation: 'Đoạn 1 nêu các khả năng autocomplete, sinh unit test, và chuyển đổi ngôn ngữ. Khả năng bảo đảm tính đúng đắn toán học hay an toàn runtime không hề được đề cập.'
      },
      {
        id: 'rq1_5',
        type: 'inference',
        question: 'What does the author imply about code that "looks syntactically elegant"?',
        options: [
          'It is guaranteed to be completely free of bugs and ready for production deployment',
          'Visual elegance in code syntax does not guarantee the absence of security vulnerabilities or subtle logic flaws',
          'Developers should write cryptic and dense code to avoid oversimplifying domain logic',
          'Syntax elegance is only relevant for beginner educational programming exercises'
        ],
        correctIndex: 1,
        explanation: 'Đoạn 3 ngụ ý rằng mã trông đẹp mắt về cú pháp chưa chắc đã đúng logic hoặc an toàn về bảo mật.'
      },
      {
        id: 'rq1_6',
        type: 'detail',
        question: 'According to the final paragraph, what four practices are called "indispensable pillars" of modern software delivery?',
        options: [
          'Manual testing, monolithic architecture, rapid code commits, and daily meetings',
          'Automated regression testing, static type analysis, continuous security scanning, and diligent human code reviews',
          'Microservice decomposition, cloud containerization, dynamic feature flagging, and user interviews',
          'Aggressive refactoring, continuous database migrations, dark mode theming, and agile retrospectives'
        ],
        correctIndex: 1,
        explanation: 'Đoạn cuối nêu rõ 4 trụ cột: automated regression testing, static type analysis, continuous security scanning, và human code reviews.'
      },
      {
        id: 'rq1_7',
        type: 'vocab_context',
        question: 'In the final paragraph, the word "vigilance" is closest in meaning to:',
        options: ['Carelessness and neglect', 'Watchful alertness and caution', 'Passive indifference and complacency', 'Rapid typing speed and agility'],
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
    wordCount: 303,
    summary: 'Nghiên cứu cơ chế thần kinh học của trí nhớ dài hạn, đường cong lãng quên Ebbinghaus và cách thuật toán lặp lại ngắt quãng (SRS) tối ưu hóa kết nối synap.',
    content: [
      'Human memory is fundamentally engineered for biological adaptation and cognitive efficiency rather than exhaustive, infinite data storage. In 1885, German experimental psychologist Hermann Ebbinghaus published his landmark findings on memory retention, introducing the celebrated "Forgetting Curve". Ebbinghaus discovered that without active reinforcement, human learners lose more than fifty percent of newly acquired information within twenty-four hours, and up to eighty percent within a month. This rapid decay is not an anatomical defect; it is a neurological filter that prevents the conscious mind from being overwhelmed by transient daily sensory input.',
      'To counteract this natural memory decay, modern cognitive scientists developed the Spaced Repetition System (SRS). Rather than engaging in massed practice or "cramming"—where material is repeated intensely over a compressed timeframe—SRS schedules review sessions across expanding, mathematically optimized intervals. By calculating difficulty ratings and previous recall accuracy, algorithms such as SM-2 present vocabulary items at the exact psychological threshold where a memory trace is on the verge of fading from working memory, thereby maximizing retention with minimal review cycles.',
      'Neurologically, each deliberate act of active retrieval triggers an extraordinary biological phenomenon called Long-Term Potentiation (LTP). When a learner exerts mental effort to recall a foreign word rather than passively reading its translation, specific neural circuits in the hippocampus and cerebral cortex fire synchronously. This repeated synchronous firing strengthens the synaptic junctions between neurons through increased neurotransmitter release and the physical growth of dendritic spines. Over time, volatile short-term electrical impulses consolidate into durable, permanent neural pathways across the brain cortex.',
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
          'The biochemical role of dietary nutrients in accelerating short-term sensory processing',
          'A comparative analysis of rote memorization techniques in traditional European classroom settings'
        ],
        correctIndex: 1,
        explanation: 'Bài viết giải thích cơ chế sinh học thần kinh của lặp lại ngắt quãng (SRS) và hồi tưởng chủ động giúp chống lại đường cong quên lãng để hình thành trí nhớ dài hạn.'
      },
      {
        id: 'rq2_2',
        type: 'detail',
        question: 'According to the Forgetting Curve described in paragraph 1, how much information do learners lose within 24 hours without active recall?',
        options: [
          'Less than ten percent',
          'More than fifty percent',
          'Exactly one hundred percent',
          'Approximately twenty-five percent'
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
          'Reviewing flashcards at mathematically expanding intervals over several months',
          'Taking long meditative breaks during rigorous academic examinations',
          'Transcribing foreign language audio recordings into handwritten notebooks'
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
          'Permanent inhibition of neural pathway formation across the cerebral cortex'
        ],
        correctIndex: 3,
        explanation: 'LTP làm mạnh synap, tăng chất dẫn truyền thần kinh và phát triển gai dendrite. Việc ức chế vĩnh viễn hình thành đường dẫn truyền thần kinh là hoàn toàn trái ngược.'
      },
      {
        id: 'rq2_5',
        type: 'inference',
        question: 'Why does passive reading produce weaker memory retention compared to active retrieval?',
        options: [
          'Passive reading does not trigger the deliberate mental exertion and synchronous neural firing that drives Long-Term Potentiation',
          'Passive reading overstimulates the visual cortex with excessive light frequencies, causing cognitive fatigue',
          'Passive reading stores vocabulary exclusively in temporary motor cortex pathways that expire after minutes',
          'Receptive reading completely suppresses the synthesis of neurotransmitters in the human brain'
        ],
        correctIndex: 0,
        explanation: 'Đọc thụ động không kích hoạt sự gắng sức hồi tưởng chủ động và đồng bộ nơ-ron cần thiết cho LTP củng cố synap.'
      },
      {
        id: 'rq2_6',
        type: 'detail',
        question: 'What is the optimal timing for reviewing an item according to spaced repetition algorithms?',
        options: [
          'At fixed, unvarying twenty-four-hour intervals regardless of recall difficulty',
          'At the exact psychological threshold where a memory trace is on the verge of fading from working memory',
          'Immediately after completing a study session before any retention decay can begin',
          'Exclusively after a learner has failed multiple consecutive examination attempts'
        ],
        correctIndex: 1,
        explanation: 'SRS tính toán lịch ôn tập ngay tại thời điểm dấu vết trí nhớ chuẩn bị phai nhạt khỏi bộ nhớ làm việc.'
      },
      {
        id: 'rq2_7',
        type: 'vocab_context',
        question: 'In the final paragraph, the word "arduous" is closest in meaning to:',
        options: ['Effortless and simple', 'Strenuous, difficult, and demanding', 'Pleasant and relaxing', 'Superficial and trivial'],
        correctIndex: 1,
        explanation: '"Arduous" có nghĩa là gian nan, vất vả và đòi hỏi nhiều nỗ lực ("strenuous, difficult, and demanding").'
      }
    ]
  },
  {
    id: 'read_b2_1',
    title: 'Sponge Cities: Redesigning Urban Landscapes for Climate Resilience',
    category: 'Environment',
    level: 'B2',
    readTime: '4.5 phút',
    wordCount: 307,
    summary: 'Mô hình Thành phố Bọt biển (Sponge Cities): ứng dụng kỹ thuật thủy văn tự nhiên, bề mặt thấm nước và thảm thực vật ngập nước để thích ứng biến đổi khí hậu.',
    content: [
      'In recent decades, rapid global urbanization has replaced porous natural soils and absorbing wetlands with vast expanses of impermeable concrete, asphalt highways, and high-density skyscrapers. Consequently, when climate-amplified torrential downpours strike contemporary metropolitan centers, traditional subterranean drainage conduits quickly become overwhelmed by unprecedented volumes of surface runoff. Catastrophic urban flash floods paralyze public transportation arteries, submerge commercial underground basements, disrupt electrical grids, and inflict billions of dollars in recurrent infrastructural damages every monsoon season.',
      'To combat this chronic vulnerability, pioneering civil engineers and ecological architects developed the "Sponge City" paradigm. Pioneered extensively across vulnerable Asian and European river deltas, a sponge city reconfigures urban hydrology by emulating natural ecological cycles rather than attempting to forcefully channel stormwater away through rigid concrete pipes. The strategy prioritizes three fundamental environmental mechanisms: natural surface absorption, subterranean retention storage, and controlled biological purification through native wetland vegetation. By transforming impervious cityscapes into dynamic sponges, the framework harmonizes civil engineering with local microclimates.',
      'Architecturally, implementing the sponge city concept transforms metropolitan surfaces into living ecological filters. Municipal authorities mandate the construction of permeable pavements in pedestrian plazas, interconnected bio-swales along roadways, and expansive rooftop gardens that capture up to seventy percent of localized rainwater before it cascades into street gutters. Furthermore, urban planners integrate subterranean retention aquifers beneath public parks and establish artificial wetlands that naturally filter toxic pollutants, sediment, and heavy metals from runoff through gravel beds and aquatic plant roots.',
      'While retrofitting established urban cores requires substantial initial capital investment and inter-agency coordination, the ecological dividends are profound and enduring. Beyond mitigating catastrophic flood hazards, sponge infrastructure dampens the urban heat island effect through enhanced plant evapotranspiration, replenishes depleted regional groundwater tables, and enriches urban biodiversity. Ultimately, embracing natural hydrology proves that future resilient cities must learn to absorb and cooperate with water rather than perpetually wage war against it.'
    ],
    keyVocab: [
      { word: 'Porous', ipa: '/ˈpɔː.rəs/', meaning: 'Xốp, có nhiều lỗ thấm nước' },
      { word: 'Impermeable', ipa: '/ɪmˈpɜː.mi.ə.bəl/', meaning: 'Không thấm nước, trơ' },
      { word: 'Hydrology', ipa: '/haɪˈdrɒl.ə.dʒi/', meaning: 'Thủy văn học' },
      { word: 'Bio-swales', ipa: '/ˈbaɪ.əʊ.sweɪlz/', meaning: 'Rãnh thoát nước sinh học thực vật' },
      { word: 'Mitigating', ipa: '/ˈmɪt.ɪ.ɡeɪ.tɪŋ/', meaning: 'Làm giảm nhẹ, xoa dịu hiểm họa' }
    ],
    questions: [
      {
        id: 'rq_b2_1_1',
        type: 'main_idea',
        question: 'What is the primary thesis of the article regarding Sponge Cities?',
        options: [
          'Modern cities must demolish all concrete buildings and relocate citizens to rural agricultural villages',
          'Sponge cities redesign urban landscapes to mimic natural hydrology, absorbing and recycling stormwater rather than relying solely on rigid concrete drains',
          'Metropolitan areas should invest solely in deeper underground concrete pipes to pump stormwater into the ocean',
          'Pavements made of asphalt are the most effective material for preventing urban flash floods'
        ],
        correctIndex: 1,
        explanation: 'Bài viết khẳng định mô hình Thành phố Bọt biển tái cấu trúc hệ thủy văn đô thị bằng cách mô phỏng chu trình tự nhiên để hấp thụ, lưu trữ và lọc nước mưa.'
      },
      {
        id: 'rq_b2_1_2',
        type: 'detail',
        question: 'According to paragraph 1, why do traditional metropolitan drainage conduits frequently fail during heavy downpours?',
        options: [
          'Because municipal workers turn off water valves during rainfall',
          'Because expansive impermeable concrete and asphalt prevent natural soil absorption, sending excessive runoff into underground pipes',
          'Because rivers in cities have completely dried up',
          'Because increased sediment runoff clogs underground pumping stations during minor showers'
        ],
        correctIndex: 1,
        explanation: 'Đoạn 1 nêu: bề mặt bê tông và nhựa đường không thấm nước (impermeable) thay thế đất xốp tự nhiên, khiến lượng nước mưa dồn vào cống ngầm vượt ngưỡng tải.'
      },
      {
        id: 'rq_b2_1_3',
        type: 'detail',
        question: 'Which three architectural mechanisms are described in paragraph 3 as part of sponge infrastructure?',
        options: [
          'Plastic roofing sheets, electric heat lamps, and copper drainage pipes',
          'Permeable pedestrian pavements, interconnected bio-swales, and rooftop gardens',
          'Elevated wooden bridges, concrete seawalls, and steel drainage gates',
          'Industrial water chillers, concrete storm canals, and chemical filtration plants'
        ],
        correctIndex: 1,
        explanation: 'Đoạn 3 chỉ rõ 3 giải pháp: permeable pavements (vỉa hè thấm nước), bio-swales (rãnh sinh học), và rooftop gardens (vườn trên mái).'
      },
      {
        id: 'rq_b2_1_4',
        type: 'vocab_context',
        question: 'In paragraph 2, the word "emulating" is closest in meaning to:',
        options: [
          'Imitating and copying the beneficial behavior of a model',
          'Violently destroying and erasing',
          'Completely ignoring and neglecting',
          'Painting with bright artificial colors'
        ],
        correctIndex: 0,
        explanation: '"Emulating" có nghĩa là học tập, bắt chước và mô phỏng theo mô hình tự nhiên ("imitating and copying").'
      },
      {
        id: 'rq_b2_1_5',
        type: 'inference',
        question: 'What additional environmental benefit does sponge infrastructure provide besides flood control?',
        options: [
          'It completely stops all tropical typhoons from forming in oceans',
          'It dampens the urban heat island effect through evapotranspiration and replenishes groundwater',
          'It eliminates the need for electrical energy across the entire city',
          'It completely removes the necessity for municipal wastewater treatment facilities'
        ],
        correctIndex: 1,
        explanation: 'Đoạn 4 nêu: ngoài giảm lụt, hạ tầng này còn hạ nhiệt hiệu ứng đảo nhiệt đô thị (urban heat island effect) nhờ bốc thoát hơi nước và bổ cập nước ngầm.'
      },
      {
        id: 'rq_b2_1_6',
        type: 'inference',
        question: "What is the author's overall stance toward the relationship between future cities and water?",
        options: [
          'Hostile; cities should build higher concrete barriers to keep water out permanently',
          'Collaborative; cities should integrate natural hydrology and learn to coexist sustainably with water cycles',
          'Indifferent; flood damages are inevitable and impossible to prevent',
          'Skeptical; green infrastructure costs too much money and delivers zero practical results'
        ],
        correctIndex: 1,
        explanation: 'Câu kết bài viết nhấn mạnh quan điểm đồng hành: "cities must learn to absorb and cooperate with water rather than perpetually wage war against it".'
      }
    ]
  },
  {
    id: 'read_b2_2',
    title: 'The Psychology of Decision Fatigue in Executive Leadership',
    category: 'Career & Business',
    level: 'B2',
    readTime: '4.5 phút',
    wordCount: 314,
    summary: 'Nghiên cứu tâm lý học về sự suy giảm năng lực quyết định (Decision Fatigue) ở các nhà lãnh đạo và chiến lược bảo toàn năng lượng nhận thức.',
    content: [
      'In high-stakes corporate environments, modern business executives make hundreds of discrete judgment calls every single day, ranging from minor operational approvals to multi-million-dollar strategic acquisitions. While leaders frequently believe their analytical abilities remain steady and objective throughout the day, empirical cognitive psychology reveals a contrary reality: human willpower and executive decision-making operate like finite biological muscles that gradually tire after repeated exertion. Consequently, sustained cognitive focus over extended operational shifts inevitably induces subtle impairments in executive control and risk assessment.',
      'This phenomenon, scientifically known as "decision fatigue", occurs because the human prefrontal cortex expends significant glucose and neural energy whenever it evaluates complex trade-offs, suppresses impulsive reactions, or navigates ethical dilemmas. As a grueling workday progresses and mental resources dwindle, the brain unconsciously adopts cognitive shortcuts to conserve its remaining metabolic energy. Consequently, leaders late in the afternoon frequently either procrastinate on vital choices or default to the most reckless, low-effort path of least resistance without thoroughly evaluating consequences or consulting team members.',
      'A renowned landmark study analyzing judicial rulings demonstrated that judges granted parole to roughly sixty-five percent of prisoners early in the morning, but that approval rate steadily plummeted toward nearly zero percent just before lunch break. After taking a nutritional rest and replenishing glucose levels, their favorable approval rates rebounded back up to sixty-five percent. This stark disparity underscores that when cognitive depletion sets in, human arbiters instinctively favor the safest default option: maintaining the status quo and denying requests.',
      'To safeguard against the costly pitfalls of decision fatigue, elite entrepreneurs and corporate leaders adopt deliberate behavioral countermeasures. Many institutionalize strict daily routines, such as wearing identical minimalist clothing or delegating trivial administrative schedules, which preserves mental bandwidth for high-impact decisions. Furthermore, savvy organizations schedule crucial architectural and budget reviews strictly during morning hours, ensuring that complex strategic direction is forged when cognitive acuity and objective judgment are at their peak.'
    ],
    keyVocab: [
      { word: 'Fatigue', ipa: '/fəˈtiːɡ/', meaning: 'Sự kiệt sức, suy giảm năng lượng' },
      { word: 'Prefrontal cortex', ipa: '/ˌpriːˈfrʌn.təl ˈkɔː.teks/', meaning: 'Vỏ não trước trán (chịu trách nhiệm ra quyết định)' },
      { word: 'Dwindle', ipa: '/ˈdwɪn.dəl/', meaning: 'Thu nhỏ lại, hao mòn dần' },
      { word: 'Disparity', ipa: '/dɪˈspær.ə.ti/', meaning: 'Sự chênh lệch rõ rệt, bất bình đẳng' },
      { word: 'Acuity', ipa: '/əˈkjuː.ə.ti/', meaning: 'Sự nhạy bén, độ sắc sảo của tư duy' }
    ],
    questions: [
      {
        id: 'rq_b2_2_1',
        type: 'main_idea',
        question: 'What is the central focus of the passage on decision fatigue?',
        options: [
          'Why executive leaders should never hire outside consultants for corporate strategy',
          'How repeated decision-making drains cognitive resources over the course of a day, leading to degraded judgment and the need for protective routines',
          'The historical evolution of courtrooms and legal juries in ancient Rome',
          'The physiological benefits of aerobic cardiovascular exercise during corporate lunch breaks'
        ],
        correctIndex: 1,
        explanation: 'Bài viết giải thích cơ chế suy kiệt năng lực nhận thức (decision fatigue) sau chuỗi quyết định liên tục và các biện pháp bảo vệ sự nhạy bén trí tuệ.'
      },
      {
        id: 'rq_b2_2_2',
        type: 'detail',
        question: 'According to paragraph 2, what physiological reason explains why the brain experiences decision fatigue?',
        options: [
          'The human eye muscles become physically paralyzed by computer screens',
          'The prefrontal cortex expends significant glucose and neural energy when evaluating complex trade-offs',
          'Blood flow to the cerebral cortex stops completely during afternoon meetings',
          'The motor cortex releases hormones that suppress long-term memory retrieval'
        ],
        correctIndex: 1,
        explanation: 'Đoạn 2 nêu rõ: "the prefrontal cortex expends significant glucose and neural energy whenever it evaluates trade-offs".'
      },
      {
        id: 'rq_b2_2_3',
        type: 'detail',
        question: 'In the judicial study mentioned in paragraph 3, what happened to parole approval rates just before the lunch break?',
        options: [
          'They climbed to ninety-nine percent',
          'They dropped from roughly sixty-five percent toward nearly zero percent',
          'They remained completely unchanged all day long',
          'Judges postponed all rulings to the following judicial calendar year'
        ],
        correctIndex: 1,
        explanation: 'Đoạn 3 chỉ rõ tỷ lệ đồng ý giảm từ 65% vào đầu buổi sáng xuống gần 0% trước giờ nghỉ trưa do thẩm phán bị kiệt quệ nhận thức.'
      },
      {
        id: 'rq_b2_2_4',
        type: 'vocab_context',
        question: 'In paragraph 2, the word "dwindle" is closest in meaning to:',
        options: [
          'Diminish, shrink, or gradually decrease in amount',
          'Multiply rapidly and uncontrollably',
          'Oscillate unpredictably between extreme values',
          'Solidify into rigid cognitive biases'
        ],
        correctIndex: 0,
        explanation: '"Dwindle" có nghĩa là suy giảm, hao mòn, vơi cạn dần ("diminish, shrink, or gradually decrease").'
      },
      {
        id: 'rq_b2_2_5',
        type: 'inference',
        question: 'Why do some elite entrepreneurs wear identical minimalist clothing every day according to paragraph 4?',
        options: [
          'Because corporate uniform policies strictly mandate monochrome apparel',
          'To eliminate trivial low-value choices in the morning and preserve cognitive bandwidth for crucial decisions',
          'Because clothing variety has been proven to trigger allergic skin reactions',
          'To cultivate an imposing and intimidating executive persona in meetings'
        ],
        correctIndex: 1,
        explanation: 'Đoạn 4 giải thích việc mặc đồ tối giản giống nhau mỗi ngày giúp loại bỏ các lựa chọn vụn vặt buổi sáng, dành năng lượng trí tuệ cho các quyết định trọng yếu.'
      },
      {
        id: 'rq_b2_2_6',
        type: 'detail',
        question: 'When cognitive depletion sets in late in the day, what default choice does the brain instinctively make?',
        options: [
          'It formulates ambitious long-term organizational transformations',
          'It favors the safest, low-effort path of least resistance by maintaining the status quo',
          'It aggressively initiates confrontational negotiations with competitors',
          'It processes quantitative spreadsheets with significantly higher accuracy'
        ],
        correctIndex: 1,
        explanation: 'Đoạn 3 kết luận: khi kiệt quệ nhận thức, não bộ có xu hướng chọn phương án an toàn và tốn ít công sức nhất: "maintaining the status quo and denying requests".'
      }
    ]
  }
];
