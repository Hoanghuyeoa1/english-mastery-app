import { ReadingLesson } from '../types';

export const a1ReadingLessons: ReadingLesson[] = [
  {
    id: 'read_a1_1',
    title: 'My Daily Morning Routine',
    category: 'Daily Life',
    level: 'A1',
    readTime: '2 phút',
    wordCount: 120,
    summary: 'Khám phá thói quen buổi sáng tràn đầy năng lượng của Tom tại một căn hộ nhỏ gần công viên.',
    content: [
      "My name is Tom and I live in a quiet apartment near the city park. Every day, my alarm rings at six o'clock in the morning. I get out of bed and drink a large glass of warm water. Then, I put on my running shoes and walk in the park for twenty minutes. The morning air is always cool and fresh.",
      'After my walk, I take a quick shower and prepare breakfast in the kitchen. I usually eat two boiled eggs, fresh bread, and an apple. I also make a cup of black coffee. At seven thirty, I pack my blue backpack and walk to the bus stop. My office opens at eight o\'clock, so I never arrive late.'
    ],
    keyVocab: [
      { word: 'Alarm', ipa: '/əˈlɑːm/', meaning: 'Đồng hồ báo thức' },
      { word: 'Apartment', ipa: '/əˈpɑːt.mənt/', meaning: 'Căn hộ chung cư' },
      { word: 'Boiled', ipa: '/bɔɪld/', meaning: 'Được luộc chín' },
      { word: 'Fresh', ipa: '/freʃ/', meaning: 'Tươi mát, trong lành' },
      { word: 'Prepare', ipa: '/prɪˈpeər/', meaning: 'Chuẩn bị, nấu nướng' }
    ],
    questions: [
      {
        id: 'rq_a1_1_1',
        type: 'main_idea',
        question: 'What is the main idea of this reading passage?',
        options: [
          "Tom's daily morning routine before going to work",
          'How to cook a dinner party for friends',
          "Tom's weekend holiday in the mountains",
          'Buying a new car in the city'
        ],
        correctIndex: 0,
        explanation: 'Đoạn văn miêu tả chi tiết thói quen buổi sáng thường ngày của Tom từ lúc thức dậy lúc 6 giờ đến khi đi làm lúc 7:30.'
      },
      {
        id: 'rq_a1_1_2',
        type: 'detail',
        question: "What time does Tom's alarm ring every morning?",
        options: [
          "At five o'clock",
          "At six o'clock",
          'At seven thirty',
          "At eight o'clock"
        ],
        correctIndex: 1,
        explanation: "Đoạn 1 nêu rõ: 'Every day, my alarm rings at six o'clock in the morning.'"
      },
      {
        id: 'rq_a1_1_3',
        type: 'detail',
        question: 'What does Tom eat for breakfast?',
        options: [
          'A large bowl of spicy noodle soup',
          'Two boiled eggs, fresh bread, and an apple',
          'Fried rice and a cup of cold milk',
          'Sweet chocolate cake and ice cream'
        ],
        correctIndex: 1,
        explanation: "Đoạn 2 nêu: 'I usually eat two boiled eggs, fresh bread, and an apple.'"
      },
      {
        id: 'rq_a1_1_4',
        type: 'vocab_context',
        question: 'In paragraph 1, the word "fresh" describes:',
        options: [
          'Air that is clean and cool',
          'Food that is very hot and spicy',
          'A noisy and crowded street',
          'An old and broken clock'
        ],
        correctIndex: 0,
        explanation: "Từ 'fresh' trong câu 'The morning air is always cool and fresh' chỉ không khí trong lành, mát mẻ."
      },
      {
        id: 'rq_a1_1_5',
        type: 'detail',
        question: 'How does Tom travel to his office?',
        options: [
          'He drives a private car',
          'He rides a motorbike',
          'He walks to the bus stop to take the bus',
          'He rides a bicycle through the park'
        ],
        correctIndex: 2,
        explanation: "Đoạn 2 nói rõ: 'At seven thirty, I pack my blue backpack and walk to the bus stop.'"
      }
    ]
  },
  {
    id: 'read_a1_2',
    title: 'A Sunday with My Family',
    category: 'Daily Life',
    level: 'A1',
    readTime: '2 phút',
    wordCount: 110,
    summary: 'Một ngày Chủ nhật ấm áp và vui vẻ của gia đình Sarah với bữa trưa tự nấu và trò chơi cờ bàn.',
    content: [
      'Sunday is my favorite day of the week because my whole family stays at home together. My father wakes up early and waters the green plants in our small garden. My mother likes cooking, so she makes delicious pancakes for our family breakfast. My younger brother and I clean the dining table and wash the dishes.',
      'In the afternoon, the weather is sunny and warm. We sit in the living room and play board games together. My brother is very funny and always makes everyone laugh. At five o\'clock, we help my parents cook chicken soup for dinner. Spending peaceful time with my family makes me feel happy and safe.'
    ],
    keyVocab: [
      { word: 'Favorite', ipa: '/ˈfeɪ.vər.ɪt/', meaning: 'Được yêu thích nhất' },
      { word: 'Garden', ipa: '/ˈɡɑː.dən/', meaning: 'Khu vườn' },
      { word: 'Delicious', ipa: '/dɪˈlɪʃ.əs/', meaning: 'Thơm ngon, ngon miệng' },
      { word: 'Dishes', ipa: '/dɪʃ.ɪz/', meaning: 'Bát đĩa ăn uống' },
      { word: 'Peaceful', ipa: '/ˈpiːs.fəl/', meaning: 'Yên bình, thanh thản' }
    ],
    questions: [
      {
        id: 'rq_a1_2_1',
        type: 'main_idea',
        question: 'What is the text mainly about?',
        options: [
          "How Sarah's family spends a relaxing Sunday together at home",
          'Buying clothes at a shopping mall',
          'Studying for a difficult mathematics exam',
          'Traveling abroad by airplane'
        ],
        correctIndex: 0,
        explanation: 'Bài đọc kể về các hoạt động vui vẻ và thư giãn của cả gia đình Sarah trong ngày Chủ nhật tại nhà.'
      },
      {
        id: 'rq_a1_2_2',
        type: 'detail',
        question: "What does Sarah's father do early on Sunday morning?",
        options: [
          'He goes to the office to work',
          'He washes his bicycle on the street',
          'He waters the green plants in the small garden',
          'He watches action movies on television'
        ],
        correctIndex: 2,
        explanation: "Đoạn 1 nêu: 'My father wakes up early and waters the green plants in our small garden.'"
      },
      {
        id: 'rq_a1_2_3',
        type: 'detail',
        question: 'What do Sarah and her brother do after breakfast?',
        options: [
          'They go to sleep immediately',
          'They clean the dining table and wash the dishes',
          'They leave the house to play football',
          'They buy groceries at the supermarket'
        ],
        correctIndex: 1,
        explanation: "Đoạn 1 nêu rõ: 'My younger brother and I clean the dining table and wash the dishes.'"
      },
      {
        id: 'rq_a1_2_4',
        type: 'vocab_context',
        question: 'In paragraph 1, the word "delicious" means:',
        options: [
          'Tasting very good to eat',
          'Very cold and hard',
          'Extremely loud and noisy',
          'Bad and unpleasant'
        ],
        correctIndex: 0,
        explanation: "Từ 'delicious' có nghĩa là thơm ngon, ngon miệng ('tasting very good to eat')."
      },
      {
        id: 'rq_a1_2_5',
        type: 'detail',
        question: 'What do they do in the living room during the afternoon?',
        options: [
          'They paint the walls',
          'They play board games together',
          'They do homework on computers',
          'They listen to loud rock music'
        ],
        correctIndex: 1,
        explanation: "Đoạn 2 nêu: 'We sit in the living room and play board games together.'"
      }
    ]
  },
  {
    id: 'read_a1_3',
    title: 'English Class at the Community Center',
    category: 'Education',
    level: 'A1',
    readTime: '2 phút',
    wordCount: 107,
    summary: 'Trải nghiệm học tiếng Anh đầy hứng khởi của David và các bạn cùng lớp tại trung tâm cộng đồng.',
    content: [
      'David attends a beginner English class at the local community center every Tuesday evening. The classroom is bright, modern, and has ten students. Our teacher is Ms. Clara, and she is very kind and patient. She always writes new vocabulary on the white board and speaks English slowly so everyone can understand.',
      'During the lesson, students work in pairs to practice simple daily dialogues. Today, David and his partner Anna practice asking for directions and ordering food at a restaurant. At the end of the lesson, Ms. Clara gives the class a short vocabulary quiz. David enjoys learning English because it helps him make new international friends.'
    ],
    keyVocab: [
      { word: 'Beginner', ipa: '/bɪˈɡɪn.ər/', meaning: 'Người mới bắt đầu' },
      { word: 'Patient', ipa: '/ˈpeɪ.ʃənt/', meaning: 'Kiên nhẫn, điềm tĩnh' },
      { word: 'Dialogue', ipa: '/ˈdaɪ.ə.lɒɡ/', meaning: 'Đoạn hội thoại' },
      { word: 'Partner', ipa: '/ˈpɑːt.nər/', meaning: 'Bạn cặp, bạn đồng hành' },
      { word: 'Directions', ipa: '/daɪˈrek.ʃənz/', meaning: 'Chỉ đường, phương hướng' }
    ],
    questions: [
      {
        id: 'rq_a1_3_1',
        type: 'main_idea',
        question: 'What is the main subject of this story?',
        options: [
          'An evening English class for beginner students at a community center',
          'Buying train tickets to travel around Europe',
          'How to build a modern community library',
          'A cooking competition between two restaurants'
        ],
        correctIndex: 0,
        explanation: 'Bài viết miêu tả lớp học tiếng Anh buổi tối dành cho học viên mới tại trung tâm cộng đồng.'
      },
      {
        id: 'rq_a1_3_2',
        type: 'detail',
        question: 'How often does David attend the English class?',
        options: [
          'Every Tuesday evening',
          'Every Sunday morning',
          'Five days a week',
          'Once every month'
        ],
        correctIndex: 0,
        explanation: "Đoạn 1 nêu: 'David attends a beginner English class at the local community center every Tuesday evening.'"
      },
      {
        id: 'rq_a1_3_3',
        type: 'detail',
        question: 'Why can all the students easily understand Ms. Clara?',
        options: [
          'Because she speaks English slowly and clearly',
          'Because she speaks in their native language only',
          'Because she never talks during class',
          'Because she uses a loudspeaker'
        ],
        correctIndex: 0,
        explanation: "Đoạn 1 nêu rõ: '...and speaks English slowly so everyone can understand.'"
      },
      {
        id: 'rq_a1_3_4',
        type: 'detail',
        question: 'What dialogue topic do David and Anna practice today?',
        options: [
          'Renting a bicycle in Amsterdam',
          'Asking for directions and ordering food at a restaurant',
          'Fixing a broken smartphone screen',
          'Booking a doctor appointment'
        ],
        correctIndex: 1,
        explanation: "Đoạn 2 nêu rõ: 'Today, David and his partner Anna practice asking for directions and ordering food at a restaurant.'"
      },
      {
        id: 'rq_a1_3_5',
        type: 'vocab_context',
        question: 'The word "patient" in paragraph 1 describes someone who:',
        options: [
          'Remains calm and does not get angry easily',
          'Runs very fast in races',
          'Forgets things constantly',
          'Always arrives late to appointments'
        ],
        correctIndex: 0,
        explanation: "'Patient' (kiên nhẫn) miêu tả người điềm tĩnh, ân cần và không dễ bực bội."
      }
    ]
  },
  {
    id: 'read_a1_4',
    title: 'A Saturday Morning at the Green Market',
    category: 'Culture & Society',
    level: 'A1',
    readTime: '2 phút',
    wordCount: 112,
    summary: 'Khám phá không gian nhộn nhịp, hoa quả tươi ngon và đồ ăn ấm áp tại chợ nông sản cuối tuần.',
    content: [
      'Every Saturday morning, the town square hosts a lively outdoor farmers market. Local farmers from nearby villages bring fresh vegetables, sweet fruits, and colorful flowers to sell. Elena visits the market with a large woven basket. She loves looking at the red tomatoes, crisp green cucumbers, and bright yellow lemons displayed neatly on wooden tables.',
      'The sellers are friendly and always smile at their customers. Elena buys a kilo of sweet oranges and a bunch of fresh mint leaves. In the corner of the market, a baker sells warm chocolate croissants and fresh orange juice. Elena sits on a wooden bench, eats her pastry, and listens to a guitarist playing cheerful songs.'
    ],
    keyVocab: [
      { word: 'Lively', ipa: '/ˈlaɪv.li/', meaning: 'Sống động, nhộn nhịp' },
      { word: 'Outdoor', ipa: '/ˈaʊt.dɔːr/', meaning: 'Ngoài trời' },
      { word: 'Display', ipa: '/dɪˈspleɪ/', meaning: 'Trưng bày, sắp xếp' },
      { word: 'Friendly', ipa: '/ˈfrend.li/', meaning: 'Thân thiện, cởi mở' },
      { word: 'Cheerful', ipa: '/ˈtʃɪə.fəl/', meaning: 'Vui tươi, phấn khởi' }
    ],
    questions: [
      {
        id: 'rq_a1_4_1',
        type: 'main_idea',
        question: 'What is the passage primarily describing?',
        options: [
          "Elena's Saturday morning visit to a lively local farmers market",
          'How to plant orange trees on a farm',
          'Playing guitar in an indoor music studio',
          'Cleaning up the town square after a festival'
        ],
        correctIndex: 0,
        explanation: 'Bài viết kể về chuyến đi dạo và mua sắm của Elena tại chợ nông sản sáng thứ Bảy.'
      },
      {
        id: 'rq_a1_4_2',
        type: 'detail',
        question: 'What fruits and vegetables does Elena see on the wooden tables?',
        options: [
          'Frozen pizzas and canned fish',
          'Red tomatoes, crisp cucumbers, and bright lemons',
          'Sweet candies and chocolate bars',
          'Rice noodles and dried mushrooms'
        ],
        correctIndex: 1,
        explanation: "Đoạn 1 nêu: 'She loves looking at the red tomatoes, crisp green cucumbers, and bright yellow lemons displayed neatly on wooden tables.'"
      },
      {
        id: 'rq_a1_4_3',
        type: 'detail',
        question: 'What items does Elena actually purchase at the market?',
        options: [
          'A kilo of oranges and fresh mint leaves',
          'A box of tea and two watermelons',
          'Three shirts and a pair of shoes',
          'A basket of red apples and potatoes'
        ],
        correctIndex: 0,
        explanation: "Đoạn 2 nêu rõ: 'Elena buys a kilo of sweet oranges and a bunch of fresh mint leaves.'"
      },
      {
        id: 'rq_a1_4_4',
        type: 'vocab_context',
        question: 'In paragraph 1, the word "lively" means:',
        options: [
          'Full of energy, movement, and activity',
          'Completely silent and empty',
          'Very dark and cold',
          'Expensive and luxurious'
        ],
        correctIndex: 0,
        explanation: "'Lively' nghĩa là tràn đầy sức sống, nhộn nhịp, náo nhiệt ('full of energy, movement, and activity')."
      },
      {
        id: 'rq_a1_4_5',
        type: 'detail',
        question: 'What does Elena do while sitting on the wooden bench?',
        options: [
          'She talks on her phone',
          'She eats her pastry and listens to a cheerful guitarist',
          'She reads a thick textbook',
          'She sleeps under a tree'
        ],
        correctIndex: 1,
        explanation: "Đoạn 2 nêu rõ: 'Elena sits on a wooden bench, eats her pastry, and listens to a guitarist playing cheerful songs.'"
      }
    ]
  }
];
