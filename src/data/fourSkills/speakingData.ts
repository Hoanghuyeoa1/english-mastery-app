import { SpeakingPrompt } from './types';

export const SPEAKING_PROMPTS: SpeakingPrompt[] = [
  {
    id: 'sp_1',
    title: 'IT Job Interview: Senior Fullstack Engineer',
    category: 'Job Interview',
    level: 'B1-B2',
    scenario: 'Bạn đang tham gia buổi phỏng vấn kỹ thuật trực tuyến với Lead Engineer cho vị trí Senior Fullstack Software Engineer.',
    turns: [
      {
        turnIndex: 0,
        partnerPrompt: 'Lead Engineer: "Welcome to our technical interview round! To start off, could you briefly summarize your software engineering background and primary technical stack?"',
        targetSentence: 'I am a fullstack engineer with four years of experience designing high-throughput web applications with React, TypeScript, Node.js, and PostgreSQL.',
        phonetic: '/aɪ æm ə ˈfʊlˌstæk ˌendʒɪˈnɪər wɪð fɔː jɪəz əv ɪkˈspɪəriəns dɪˈzaɪnɪŋ haɪ ˈθruːpʊt web ˌæplɪˈkeɪʃnz wɪð riˈækt, ˈtaɪpˌskrɪpt, nəʊd dʒeɪ es, ænd ˈpəʊstɡres kjuː el/',
        meaningVi: 'Tôi là kỹ sư fullstack với 4 năm kinh nghiệm thiết kế các ứng dụng web thông lượng cao bằng React, TypeScript, Node.js và PostgreSQL.',
        keyKeywords: ['fullstack engineer', 'experience', 'high-throughput', 'React', 'TypeScript', 'Node.js', 'PostgreSQL'],
        sampleAudioText: 'I am a fullstack engineer with four years of experience designing high-throughput web applications with React, TypeScript, Node.js, and PostgreSQL.'
      },
      {
        turnIndex: 1,
        partnerPrompt: 'Lead Engineer: "That sounds very comprehensive. Can you describe a critical performance bottleneck you recently diagnosed and resolved under pressure?"',
        targetSentence: 'We experienced severe database connection exhaustion during peak traffic, so I implemented connection pooling and an in-memory Redis caching layer with a fifteen-minute TTL.',
        phonetic: '/wiː ɪkˈspɪəriənst sɪˈvɪər ˈdeɪtəbeɪs kəˈnekʃn ɪɡˈzɔːstʃn ˈdjʊərɪŋ piːk ˈtræfɪk, səʊ aɪ ˈɪmplɪmentɪd kəˈnekʃn ˈpuːlɪŋ ænd ən ɪn ˈmeməri ˈredɪs ˈkæʃɪŋ ˈleɪər wɪð ə ˌfɪfˈtiːn ˈmɪnɪt tiː tiː el/',
        meaningVi: 'Chúng tôi đã gặp sự cố cạn kiệt kết nối database trong giờ cao điểm, vì vậy tôi đã triển khai connection pool và tầng cache Redis với thời gian sống 15 phút.',
        keyKeywords: ['connection exhaustion', 'implemented', 'connection pooling', 'Redis caching', 'TTL'],
        sampleAudioText: 'We experienced severe database connection exhaustion during peak traffic, so I implemented connection pooling and an in-memory Redis caching layer with a fifteen-minute TTL.'
      },
      {
        turnIndex: 2,
        partnerPrompt: 'Lead Engineer: "How do you ensure message delivery reliability when building distributed microservices communicating asynchronously?"',
        targetSentence: 'We utilize transactional outbox patterns with Apache Kafka and enforce strict idempotency keys in our payment consumers to safely discard duplicate events.',
        phonetic: '/wiː ˈjuːtɪlaɪz trænˈzækʃənl ˈaʊtˌbɒks ˈpætənz wɪð əˈpætʃi ˈkɑːfkə ænd ɪnˈfɔːs strɪkt aɪˈdempətənsi kiːz ɪn ˈaʊə ˈpeɪmənt kənˈsjuːməz tuː ˈseɪfli dɪˈskɑːd ˈdjuːplɪkət ɪˈvents/',
        meaningVi: 'Chúng tôi sử dụng mẫu transactional outbox với Apache Kafka và áp dụng idempotency keys nghiêm ngặt để loại bỏ an toàn các sự kiện trùng lặp.',
        keyKeywords: ['transactional outbox', 'Apache Kafka', 'idempotency keys', 'discard duplicate'],
        sampleAudioText: 'We utilize transactional outbox patterns with Apache Kafka and enforce strict idempotency keys in our payment consumers to safely discard duplicate events.'
      },
      {
        turnIndex: 3,
        partnerPrompt: 'Lead Engineer: "How do you foster high engineering standards, clean code, and effective mentoring across cross-functional teams?"',
        targetSentence: 'I champion thorough peer code reviews, enforce automated CI/CD static linting gates, and conduct weekly architecture brown-bag knowledge sharing sessions.',
        phonetic: '/aɪ ˈtʃæmpiən ˈθʌrə pɪər kəʊd rɪˈvjuːz, ɪnˈfɔːs ˈɔːtəmeɪtɪd siː aɪ siː diː ˈstætɪk ˈlɪntɪŋ ɡeɪts, ænd kənˈdʌkt ˈwiːkli ˈɑːkɪtektʃə braʊn bæɡ ˈnɒlɪdʒ ˈʃeərɪŋ ˈseʃnz/',
        meaningVi: 'Tôi thúc đẩy review code chéo kỹ lưỡng, thực thi các cổng kiểm tra mã tĩnh CI/CD tự động và tổ chức các buổi chia sẻ kiến thức kiến trúc hàng tuần.',
        keyKeywords: ['peer code reviews', 'automated CI/CD', 'static linting', 'knowledge sharing'],
        sampleAudioText: 'I champion thorough peer code reviews, enforce automated CI/CD static linting gates, and conduct weekly architecture brown-bag knowledge sharing sessions.'
      },
      {
        turnIndex: 4,
        partnerPrompt: 'Lead Engineer: "Do you have any questions for us regarding our engineering culture, technical roadmap, or future platform initiatives?"',
        targetSentence: 'Could you elaborate on how your engineering leadership balances shipping aggressive product features against paying down legacy technical debt?',
        phonetic: '/kʊd juː ɪˈlæbəreɪt ɒn haʊ jɔːr ˌendʒɪˈnɪərɪŋ ˈliːdəʃɪp ˈbælənsɪz ˈʃɪpɪŋ əˈɡresɪv ˈprɒdʌkt ˈfiːtʃəz əˈɡenst ˈpeɪɪŋ daʊn ˈleɡəsi ˈteknɪkl det/',
        meaningVi: 'Anh có thể chia sẻ thêm về cách ban lãnh đạo kỹ thuật cân bằng giữa việc ra mắt tính năng sản phẩm mới và việc trả dần nợ kỹ thuật cũ không?',
        keyKeywords: ['elaborate', 'engineering leadership', 'balances', 'shipping features', 'technical debt'],
        sampleAudioText: 'Could you elaborate on how your engineering leadership balances shipping aggressive product features against paying down legacy technical debt?'
      }
    ]
  },
  {
    id: 'sp_2',
    title: 'Daily Agile Standup: Sprint Velocity & Blocker Resolution',
    category: 'Agile Standup',
    level: 'B1-B2',
    scenario: 'Bạn đang tham gia buổi họp Scrum Standup buổi sáng cùng nhóm phát triển phần mềm.',
    turns: [
      {
        turnIndex: 0,
        partnerPrompt: 'Scrum Master: "Good morning team! Let us initiate our daily standup. Who would like to kick off with their progress update from yesterday?"',
        targetSentence: 'Good morning everyone. Yesterday I completed the database indexing optimization for the customer search endpoint and wrote accompanying integration tests.',
        phonetic: '/ɡʊd ˈmɔːnɪŋ ˈevrɪwʌn. ˈjestədeɪ aɪ kəmˈpliːtɪd ðə ˈdeɪtəbeɪs ˈɪndeksɪŋ ˌɒptɪmaɪˈzeɪʃn fər ðə ˈkʌstəmə sɜːtʃ ˈendpɔɪnt ænd rəʊt əˈkʌmpəniɪŋ ˌɪntɪˈɡreɪʃn tests/',
        meaningVi: 'Chào buổi sáng mọi người. Hôm qua tôi đã hoàn thành tối ưu hóa chỉ mục database cho endpoint tìm kiếm khách hàng và viết các bài test tích hợp đi kèm.',
        keyKeywords: ['completed', 'database indexing', 'optimization', 'integration tests'],
        sampleAudioText: 'Good morning everyone. Yesterday I completed the database indexing optimization for the customer search endpoint and wrote accompanying integration tests.'
      },
      {
        turnIndex: 1,
        partnerPrompt: 'Scrum Master: "Great work on the search query speedup. What are your key milestones and focus areas for today?"',
        targetSentence: 'Today I am implementing the OAuth2 refresh token rotation flow and updating our Swagger API documentation to reflect the latest security contracts.',
        phonetic: '/təˈdeɪ aɪ æm ˈɪmplɪmentɪŋ ðiː əʊˈɔːθ tuː rɪˈfreʃ ˈtəʊkən rəʊˈteɪʃn fləʊ ænd ʌpˈdeɪtɪŋ ˈaʊə ˈswæɡər ˌeɪpiːˈaɪ ˌdɒkjʊmenˈteɪʃn tuː rɪˈflekt ðə ˈleɪtɪst sɪˈkjʊərəti ˈkɒntrækts/',
        meaningVi: 'Hôm nay tôi sẽ triển khai luồng xoay vòng refresh token OAuth2 và cập nhật tài liệu Swagger API để phản ánh các hợp đồng bảo mật mới nhất.',
        keyKeywords: ['implementing', 'OAuth2', 'refresh token', 'rotation', 'Swagger documentation'],
        sampleAudioText: 'Today I am implementing the OAuth2 refresh token rotation flow and updating our Swagger API documentation to reflect the latest security contracts.'
      },
      {
        turnIndex: 2,
        partnerPrompt: 'Scrum Master: "Are there any technical dependencies, staging environment instabilities, or cross-team blockers impeding your velocity?"',
        targetSentence: 'I currently have a minor blocker regarding the third-party sandbox webhook endpoints, so I will need fifteen minutes with the DevOps engineer this afternoon.',
        phonetic: '/aɪ ˈkʌrəntli hæv ə ˈmaɪnər ˈblɒkər rɪˈɡɑːdɪŋ ðə θɜːd ˈpɑːti ˈsændˌbɒks ˈwebˌhʊk ˈendpɔɪnts, səʊ aɪ wɪl niːd ˌfɪfˈtiːn ˈmɪnɪts wɪð ðə devˈɒps ˌendʒɪˈnɪər ðɪs ˌɑːftəˈnuːn/',
        meaningVi: 'Hiện tại tôi có một vướng mắc nhỏ liên quan đến các webhook sandbox của bên thứ ba, nên tôi sẽ cần 15 phút làm việc cùng kỹ sư DevOps vào chiều nay.',
        keyKeywords: ['minor blocker', 'third-party sandbox', 'webhook', 'DevOps engineer'],
        sampleAudioText: 'I currently have a minor blocker regarding the third-party sandbox webhook endpoints, so I will need fifteen minutes with the DevOps engineer this afternoon.'
      },
      {
        turnIndex: 3,
        partnerPrompt: 'Scrum Master: "Understood. Alex from DevOps is on this call and will sync with you right after. Are we still on track for our sprint release date?"',
        targetSentence: 'Yes, with that webhook resolution, all remaining sprint story points will be merged into staging by Thursday afternoon for final QA verification.',
        phonetic: '/jes, wɪð ðæt ˈwebˌhʊk ˌrezəˈluːʃn, ɔːl rɪˈmeɪnɪŋ sprɪnt ˈstɔːri pɔɪnts wɪl biː mɜːdʒd ˈɪntuː ˈsteɪdʒɪŋ baɪ ˈθɜːzdeɪ ˌɑːftəˈnuːn fər ˈfaɪnl kjuː eɪ ˌverɪfɪˈkeɪʃn/',
        meaningVi: 'Vâng, khi webhook được giải quyết, toàn bộ các story points còn lại sẽ được hợp nhất vào staging trước chiều thứ Năm để QA nghiệm thu lần cuối.',
        keyKeywords: ['webhook resolution', 'story points', 'merged', 'staging', 'QA verification'],
        sampleAudioText: 'Yes, with that webhook resolution, all remaining sprint story points will be merged into staging by Thursday afternoon for final QA verification.'
      },
      {
        turnIndex: 4,
        partnerPrompt: 'Scrum Master: "Awesome! Thanks for the transparent and concise update. Let us wrap up the standup and get to work!"',
        targetSentence: 'Thank you everyone. I will summarize our action items and post them in the engineering Slack channel right away.',
        phonetic: '/θæŋk juː ˈevrɪwʌn. aɪ wɪl ˈsʌməraɪz ˈaʊər ˈækʃn ˈaɪtəmz ænd pəʊst ðəm ɪn ðiː ˌendʒɪˈnɪərɪŋ slæk ˈtʃænl raɪt əˈweɪ/',
        meaningVi: 'Cảm ơn mọi người. Tôi sẽ tổng hợp các đầu mục hành động và đăng lên kênh Slack kỹ thuật ngay bây giờ.',
        keyKeywords: ['summarize', 'action items', 'engineering Slack', 'right away'],
        sampleAudioText: 'Thank you everyone. I will summarize our action items and post them in the engineering Slack channel right away.'
      }
    ]
  },
  {
    id: 'sp_3',
    title: 'Code Review & Architectural Trade-Off Defense',
    category: 'Tech Support',
    level: 'B2-C1',
    scenario: 'Bạn đang giải trình và bảo vệ quyết định kiến trúc trong buổi review Pull Request cùng Principal Architect.',
    turns: [
      {
        turnIndex: 0,
        partnerPrompt: 'Architect: "I reviewed your payment processing PR. Why did you decide to introduce an asynchronous RabbitMQ queue instead of synchronous HTTP calls?"',
        targetSentence: 'Using RabbitMQ decouples our webhook ingestion from the billing database, preventing connection exhaustion during sudden traffic spikes.',
        phonetic: '/ˈjuːzɪŋ ˈræbɪt em kjuː diːˈkʌplz ˈaʊə ˈwebˌhʊk ɪnˈdʒestʃn frəm ðə ˈbɪlɪŋ ˈdeɪtəbeɪs, prɪˈventɪŋ kəˈnekʃn ɪɡˈzɔːstʃn ˈdjʊərɪŋ ˈsʌdn ˈtræfɪk spaɪks/',
        meaningVi: 'Dùng RabbitMQ giúp tách rời việc tiếp nhận webhook khỏi database thanh toán, ngăn ngừa cạn kiệt kết nối khi lưu lượng tăng đột biến.',
        keyKeywords: ['RabbitMQ', 'decouples', 'webhook ingestion', 'billing database', 'connection exhaustion'],
        sampleAudioText: 'Using RabbitMQ decouples our webhook ingestion from the billing database, preventing connection exhaustion during sudden traffic spikes.'
      },
      {
        turnIndex: 1,
        partnerPrompt: 'Architect: "How do you guarantee that a duplicate webhook event from the financial provider will not trigger double billing for a customer?"',
        targetSentence: 'We persist an idempotency key with a twenty-four hour TTL in Redis to immediately discard duplicate transaction payloads.',
        phonetic: '/wiː pəˈsɪst ən aɪˈdempətənsi kiː wɪð ə ˈtwenti fɔːr ˈaʊə tiː tiː el ɪn ˈredɪs tuː ɪˈmiːdiətli dɪˈskɑːd ˈdjuːplɪkət trænˈzækʃn ˈpeɪləʊdz/',
        meaningVi: 'Chúng tôi lưu một idempotency key với thời gian sống 24h trong Redis để loại bỏ ngay lập tức các payload giao dịch bị trùng lặp.',
        keyKeywords: ['idempotency key', 'TTL', 'Redis', 'discard duplicate', 'transaction payloads'],
        sampleAudioText: 'We persist an idempotency key with a twenty-four hour TTL in Redis to immediately discard duplicate transaction payloads.'
      },
      {
        turnIndex: 2,
        partnerPrompt: 'Architect: "What is your failure recovery strategy if a worker consumer encounters an unhandled runtime error while processing financial events?"',
        targetSentence: 'Messages remain unacknowledged in the queue, automatically retrying up to three times with exponential backoff before routing to our dead-letter exchange.',
        phonetic: '/ˈmesɪdʒɪz rɪˈmeɪn ˌʌnəkˈnɒlɪdʒd ɪn ðə kjuː, ˌɔːtəˈmætɪkli ˌriːˈtraɪɪŋ ʌp tuː θriː taɪmz wɪð ˌekspəˈnenʃl ˈbækɒf bɪˈfɔː ˈruːtɪŋ tuː ˈaʊə ded ˈletər ɪksˈtʃeɪndʒ/',
        meaningVi: 'Tin nhắn sẽ chưa được xác nhận trong hàng đợi, tự động thử lại tối đa 3 lần với thuật toán lùi lũy thừa trước khi chuyển sang dead-letter exchange.',
        keyKeywords: ['unacknowledged', 'retrying', 'exponential backoff', 'dead-letter exchange'],
        sampleAudioText: 'Messages remain unacknowledged in the queue, automatically retrying up to three times with exponential backoff before routing to our dead-letter exchange.'
      },
      {
        turnIndex: 3,
        partnerPrompt: 'Architect: "How have you verified that your database migration script will not lock large tables in production during deployment?"',
        targetSentence: 'I created a non-blocking asynchronous index creation script and thoroughly validated execution plans on our production-scale staging database clone.',
        phonetic: '/aɪ kriˈeɪtɪd ə nɒn ˈblɒkɪŋ eɪˈsɪŋkrənəs ˈɪndeks kriˈeɪʃn skrɪpt ænd ˈθʌrəli ˈvælɪdeɪtɪd ˌeksɪˈkjuːʃn plænz ɒn ˈaʊə prəˈdʌkʃn skeɪl ˈsteɪdʒɪŋ ˈdeɪtəbeɪs kləʊn/',
        meaningVi: 'Tôi đã tạo một script tạo chỉ mục bất đồng bộ không gây khóa bảng và xác thực kỹ lưỡng kế hoạch thực thi trên bản sao staging quy mô production.',
        keyKeywords: ['non-blocking', 'asynchronous index', 'validated', 'execution plans', 'staging clone'],
        sampleAudioText: 'I created a non-blocking asynchronous index creation script and thoroughly validated execution plans on our production-scale staging database clone.'
      },
      {
        turnIndex: 4,
        partnerPrompt: 'Architect: "This is a stellar, robust engineering design. I have approved your PR with zero reservations!"',
        targetSentence: 'Thank you very much for the insightful review. I will trigger the automated deployment pipeline to staging immediately.',
        phonetic: '/θæŋk juː ˈveri mʌtʃ fər ðiː ˈɪnsaɪtfʊl rɪˈvjuː. aɪ wɪl ˈtrɪɡər ðiː ˈɔːtəmeɪtɪd dɪˈplɔɪmənt ˈpaɪplaɪn tuː ˈsteɪdʒɪŋ ɪˈmiːdiətli/',
        meaningVi: 'Cảm ơn anh rất nhiều vì những nhận xét sâu sắc. Tôi sẽ kích hoạt luồng triển khai tự động lên staging ngay lập tức.',
        keyKeywords: ['insightful review', 'trigger', 'automated deployment pipeline', 'staging'],
        sampleAudioText: 'Thank you very much for the insightful review. I will trigger the automated deployment pipeline to staging immediately.'
      }
    ]
  },
  {
    id: 'sp_4',
    title: 'London Coffee Shop: Specialty Beverage Customization',
    category: 'Daily Conversation',
    level: 'A2-B1',
    scenario: 'Bạn đang gọi đồ uống và bánh ngọt tại một tiệm cà phê đặc sản tại London với các yêu cầu tùy chỉnh chi tiết.',
    turns: [
      {
        turnIndex: 0,
        partnerPrompt: 'Barista: "Good afternoon! Welcome to Monmouth Coffee. What freshly roasted beverage can I craft for you today?"',
        targetSentence: 'Could I please get a large iced oat milk latte with two pumps of vanilla syrup and extra light ice?',
        phonetic: '/kʊd aɪ pliːz ɡet ə lɑːdʒ aɪst əʊt mɪlk ˈlɑːteɪ wɪð tuː pʌmps əv vəˈnɪlə ˈsɪrəp ænd ˈekstrə laɪt aɪs/',
        meaningVi: 'Cho tôi xin một ly latte sữa yến mạch đá cỡ lớn với 2 lần nhấn siro vani và cực ít đá được không ạ?',
        keyKeywords: ['large iced', 'oat milk latte', 'vanilla syrup', 'light ice'],
        sampleAudioText: 'Could I please get a large iced oat milk latte with two pumps of vanilla syrup and extra light ice?'
      },
      {
        turnIndex: 1,
        partnerPrompt: 'Barista: "Certainly! Would you prefer our house chocolatey espresso blend or our single-origin Ethiopian roast for a lighter, floral flavor?"',
        targetSentence: 'I would love to try the Ethiopian single-origin roast for a brighter, citrusy flavor profile, please.',
        phonetic: '/aɪ wʊd lʌv tuː traɪ ðiː ˌiːθiˈəʊpiən ˈsɪŋɡl ˈɒrɪdʒɪn rəʊst fər ə ˈbraɪtər, ˈsɪtrəsi ˈfleɪvə ˈprəʊfaɪl, pliːz/',
        meaningVi: 'Tôi muốn thử hạt rang đơn nguồn gốc Ethiopia để có hương vị trái cây tươi sáng và thanh nhẹ, làm ơn.',
        keyKeywords: ['Ethiopian', 'single-origin', 'brighter', 'citrusy flavor'],
        sampleAudioText: 'I would love to try the Ethiopian single-origin roast for a brighter, citrusy flavor profile, please.'
      },
      {
        turnIndex: 2,
        partnerPrompt: 'Barista: "Excellent choice. Would you like to accompany your latte with any warm artisanal pastries from our bakery today?"',
        targetSentence: 'Yes, please add one almond croissant warmed up, and a small blueberry scone to take away.',
        phonetic: '/jes, pliːz æd wʌn ˈɑːmənd ˈkwæsɒ̃ wɔːmd ʌp, ænd ə smɔːl ˈbluːbəri skɒn tuː teɪk əˈweɪ/',
        meaningVi: 'Vâng, cho tôi thêm một bánh sừng bò hạnh nhân hâm nóng và một bánh scone việt quất nhỏ mang đi.',
        keyKeywords: ['almond croissant', 'warmed up', 'blueberry scone', 'take away'],
        sampleAudioText: 'Yes, please add one almond croissant warmed up, and a small blueberry scone to take away.'
      },
      {
        turnIndex: 3,
        partnerPrompt: 'Barista: "Your total comes to nine pounds forty-five pence. Will you be paying by cash, card, or mobile contactless?"',
        targetSentence: 'I will pay with contactless Apple Pay on my phone, and could I also have a digital receipt sent to my email?',
        phonetic: '/aɪ wɪl peɪ wɪð ˈkɒntæktləs ˈæpl peɪ ɒn maɪ fəʊn, ænd kʊd aɪ ˈɔːlsəʊ hæv ə ˈdɪdʒɪtl rɪˈsiːt sent tuː maɪ ˈiːmeɪl/',
        meaningVi: 'Tôi sẽ thanh toán không tiếp xúc qua Apple Pay trên điện thoại, và bạn có thể gửi biên lai điện tử qua email của tôi được không?',
        keyKeywords: ['contactless Apple Pay', 'phone', 'digital receipt', 'email'],
        sampleAudioText: 'I will pay with contactless Apple Pay on my phone, and could I also have a digital receipt sent to my email?'
      },
      {
        turnIndex: 4,
        partnerPrompt: 'Barista: "All set! Here is your warmed pastry, and we will call your name at the pick-up counter for your iced latte in just two minutes!"',
        targetSentence: 'Thank you very much for your wonderful service. Have a fantastic afternoon ahead!',
        phonetic: '/θæŋk juː ˈveri mʌtʃ fər jɔː ˈwʌndəfl ˈsɜːvɪs. hæv ə fænˈtæstɪk ˌɑːftəˈnuːn əˈhed/',
        meaningVi: 'Cảm ơn bạn rất nhiều vì sự phục vụ tuyệt vời. Chúc bạn một buổi chiều thật tuyệt vời!',
        keyKeywords: ['thank you', 'wonderful service', 'fantastic afternoon'],
        sampleAudioText: 'Thank you very much for your wonderful service. Have a fantastic afternoon ahead!'
      }
    ]
  }
];
