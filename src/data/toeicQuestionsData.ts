import { ToeicQuestion } from '../types';

export const TOEIC_QUESTION_BANK: ToeicQuestion[] = [
  // --- PART 1: PHOTOS (LISTENING) ---
  {
    id: 'toeic_p1_1',
    part: 'part1_photos',
    skill: 'listening',
    imageUrl: 'https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?auto=format&fit=crop&w=1000&q=80',
    audioScript: 'Look at the picture marked number 1. (A) The man is typing on a laptop. (B) The man is repairing a printer. (C) The man is drinking from a mug. (D) The man is presenting a chart.',
    questionText: 'Part 1: Nghe 4 nhận định (A, B, C, D) và chọn phương án mô tả chính xác nhất bức ảnh bên dưới.',
    options: [
      'A. The man is typing on a laptop.',
      'B. The man is repairing a printer.',
      'C. The man is drinking from a mug.',
      'D. The man is presenting a chart.'
    ],
    correctAnswer: 'A',
    explanation: 'Đáp án (A) mô tả chính xác hành động người đàn ông đang gõ bàn phím laptop trong phòng làm việc. Các phương án (B), (C), (D) không khớp với hành động trong ảnh.',
    vietnameseTranslation: 'Nhìn vào bức ảnh. (A) Người đàn ông đang gõ máy tính xách tay. (B) Người đàn ông đang sửa máy in. (C) Người đàn ông đang uống nước từ chiếc cốc. (D) Người đàn ông đang trình bày biểu đồ.',
    keyVocabulary: [
      { word: 'Typing', ipa: '/ˈtaɪ.pɪŋ/', meaning: 'Đang gõ bàn phím' },
      { word: 'Laptop', ipa: '/ˈlæp.tɒp/', meaning: 'Máy tính xách tay' }
    ]
  },
  {
    id: 'toeic_p1_2',
    part: 'part1_photos',
    skill: 'listening',
    imageUrl: 'https://images.unsplash.com/photo-1578916171728-46686eac8d58?auto=format&fit=crop&w=1000&q=80',
    audioScript: 'Look at the picture marked number 2. (A) Some boxes are being loaded into a truck. (B) Some merchandise is displayed on the shelves. (C) The cashier is counting cash. (D) Customers are waiting in line at the entrance.',
    questionText: 'Part 1: Nghe 4 nhận định (A, B, C, D) và chọn phương án mô tả chính xác nhất bức ảnh bên dưới.',
    options: [
      'A. Some boxes are being loaded into a truck.',
      'B. Some merchandise is displayed on the shelves.',
      'C. The cashier is counting cash.',
      'D. Customers are waiting in line at the entrance.'
    ],
    correctAnswer: 'B',
    explanation: 'Đáp án (B) mô tả chính xác trạng thái hàng hóa (merchandise) được xếp ngay ngắn trên các kệ (shelves).',
    vietnameseTranslation: '(A) Một số thùng hàng đang được bốc lên xe tải. (B) Một số hàng hóa được trưng bày trên các kệ. (C) Thu ngân đang đếm tiền mặt. (D) Khách hàng đang xếp hàng tại lối vào.',
    keyVocabulary: [
      { word: 'Merchandise', ipa: '/ˈmɜː.tʃən.daɪs/', meaning: 'Hàng hóa, sản phẩm bày bán' },
      { word: 'Shelves', ipa: '/ʃelvz/', meaning: 'Các kệ, giá đỡ' }
    ]
  },
  {
    id: 'toeic_p1_3',
    part: 'part1_photos',
    skill: 'listening',
    imageUrl: 'https://images.unsplash.com/photo-1531497865144-0464ef8fb9a9?auto=format&fit=crop&w=1000&q=80',
    audioScript: 'Look at the picture marked number 3. (A) The colleagues are seated around a conference table. (B) The workers are painting the office wall. (C) The manager is locking the door. (D) The team is packing moving cartons.',
    questionText: 'Part 1: Nghe 4 nhận định (A, B, C, D) và chọn phương án mô tả chính xác nhất bức ảnh bên dưới.',
    options: [
      'A. The colleagues are seated around a conference table.',
      'B. The workers are painting the office wall.',
      'C. The manager is locking the door.',
      'D. The team is packing moving cartons.'
    ],
    correctAnswer: 'A',
    explanation: 'Đáp án (A) mô tả chính xác cảnh các đồng nghiệp đang ngồi thảo luận quanh bàn hội nghị.',
    vietnameseTranslation: '(A) Các đồng nghiệp đang ngồi quanh bàn họp. (B) Công nhân đang sơn tường văn phòng. (C) Người quản lý đang khóa cửa. (D) Đội ngũ đang đóng gói các thùng chuyển đồ.',
    keyVocabulary: [
      { word: 'Colleagues', ipa: '/ˈkɒl.iːɡz/', meaning: 'Đồng nghiệp' },
      { word: 'Conference table', ipa: '/ˈkɒn.fər.əns ˈteɪ.bəl/', meaning: 'Bàn họp, bàn hội nghị' }
    ]
  },

  // --- PART 2: QUESTION & RESPONSE (LISTENING) ---
  {
    id: 'toeic_p2_1',
    part: 'part2_qna',
    skill: 'listening',
    audioScript: 'Where is the annual shareholders meeting being held this year? (A) In Conference Room B on the second floor. (B) Yes, it was very productive. (C) At ten o’clock tomorrow morning.',
    questionText: 'Part 2: Nghe câu hỏi và chọn câu phản hồi phù hợp nhất.',
    options: [
      'A. In Conference Room B on the second floor.',
      'B. Yes, it was very productive.',
      'C. At ten o’clock tomorrow morning.'
    ],
    correctAnswer: 'A',
    explanation: 'Câu hỏi bắt đầu bằng từ để hỏi nơi chốn "Where", do đó đáp án trả lời về địa điểm (Conference Room B on the second floor) là chính xác nhất. Đáp án B là Yes/No không phù hợp, đáp án C trả lời thời gian.',
    vietnameseTranslation: 'Cuộc họp cổ đông thường niên năm nay được tổ chức ở đâu? (A) Tại Phòng họp B ở tầng hai. (B) Vâng, nó đã rất hiệu quả. (C) Lúc 10 giờ sáng mai.',
    keyVocabulary: [
      { word: 'Shareholders', ipa: '/ˈʃeəˌhəʊl.dərz/', meaning: 'Các cổ đông' },
      { word: 'Conference', ipa: '/ˈkɒn.fər.əns/', meaning: 'Hội nghị, cuộc họp lớn' }
    ]
  },
  {
    id: 'toeic_p2_2',
    part: 'part2_qna',
    skill: 'listening',
    audioScript: 'Could you review this budget proposal before the board meeting? (A) Yes, I’ll take a look right after lunch. (B) The board was made of wood. (C) About fifty dollars per ticket.',
    questionText: 'Part 2: Nghe câu hỏi và chọn câu phản hồi phù hợp nhất.',
    options: [
      'A. Yes, I’ll take a look right after lunch.',
      'B. The board was made of wood.',
      'C. About fifty dollars per ticket.'
    ],
    correctAnswer: 'A',
    explanation: 'Đây là câu yêu cầu lịch sự "Could you review...?", đáp án A đưa ra sự đồng ý và mốc thời gian xem xét hợp lý.',
    vietnameseTranslation: 'Bạn có thể xem qua bản đề xuất ngân sách này trước cuộc họp hội đồng quản trị không? (A) Được chứ, tôi sẽ xem ngay sau bữa trưa. (B) Cái bảng được làm bằng gỗ. (C) Khoảng năm mươi đô la mỗi vé.',
    keyVocabulary: [
      { word: 'Proposal', ipa: '/prəˈpəʊ.zəl/', meaning: 'Bản đề xuất' },
      { word: 'Review', ipa: '/rɪˈvjuː/', meaning: 'Xem xét, đánh giá lại' }
    ]
  },

  // --- PART 3: SHORT CONVERSATIONS (LISTENING) ---
  {
    id: 'toeic_p3_1',
    part: 'part3_conv',
    skill: 'listening',
    audioScript: 'Man: Hello Sarah, have you finished the quarterly sales presentation for tomorrow? Woman: Almost, Mark. I am just waiting for the final revenue figures from the accounting department. Man: Great. Let me know if you need help polishing the PowerPoint slides.',
    questionText: 'What is the woman waiting for?',
    options: [
      'A. The marketing budget approval',
      'B. Revenue data from accounting',
      'C. A new laptop charger',
      'D. A meeting room reservation'
    ],
    correctAnswer: 'B',
    explanation: 'Người phụ nữ nói rõ: "I am just waiting for the final revenue figures from the accounting department" (Tôi chỉ đang đợi số liệu doanh thu cuối cùng từ phòng kế toán).',
    vietnameseTranslation: 'Người đàn ông: Chào Sarah, bạn đã làm xong bài thuyết trình doanh số quý cho ngày mai chưa? Người phụ nữ: Gần xong rồi Mark. Tôi chỉ đang đợi số liệu doanh thu cuối cùng từ phòng kế toán. Người đàn ông: Tuyệt. Hãy cho tôi biết nếu bạn cần giúp chau chuốt các slide PowerPoint nhé.',
    keyVocabulary: [
      { word: 'Quarterly', ipa: '/ˈkwɔː.təl.i/', meaning: 'Hàng quý, theo quý' },
      { word: 'Revenue', ipa: '/ˈrev.ən.juː/', meaning: 'Doanh thu' }
    ]
  },

  // --- PART 4: SHORT TALKS / ANNOUNCEMENTS (LISTENING) ---
  {
    id: 'toeic_p4_1',
    part: 'part4_talks',
    skill: 'listening',
    audioScript: 'Attention passengers on Flight VN-204 to Tokyo. Due to adverse weather conditions at the destination airport, our departure has been delayed by approximately forty-five minutes. Please remain seated near Gate 12 for further updates.',
    questionText: 'Why has the flight departure been delayed?',
    options: [
      'A. Mechanical maintenance issues',
      'B. Severe weather at the destination',
      'C. Air traffic controller strike',
      'D. Late arrival of flight crew'
    ],
    correctAnswer: 'B',
    explanation: 'Người thông báo nêu nguyên nhân: "Due to adverse weather conditions at the destination airport" (Do điều kiện thời tiết bất lợi tại sân bay đến).',
    vietnameseTranslation: 'Xin hành khách trên chuyến bay VN-204 đi Tokyo chú ý. Do điều kiện thời tiết bất lợi tại sân bay đến, giờ khởi hành của chúng ta bị hoãn khoảng 45 phút. Vui lòng ngồi gần Cổng 12 để cập nhật thêm.',
    keyVocabulary: [
      { word: 'Adverse', ipa: '/ˈæd.vɜːs/', meaning: 'Bất lợi, có hại' },
      { word: 'Departure', ipa: '/dɪˈpɑː.tʃər/', meaning: 'Sự khởi hành' }
    ]
  },

  // --- PART 5: INCOMPLETE SENTENCES (READING) ---
  {
    id: 'toeic_p5_1',
    part: 'part5_grammar',
    skill: 'reading',
    questionText: 'The CEO announced that the quarterly bonus will be distributed _______ to all eligible full-time employees.',
    options: [
      'A. equal',
      'B. equally',
      'C. equality',
      'D. equalize'
    ],
    correctAnswer: 'B',
    explanation: 'Chỗ trống đứng sau động từ dạng bị động "will be distributed", cần một trạng từ (adverb) đuôi "-ly" để bổ nghĩa cho động từ phân phối (distributed). Do đó chọn "equally".',
    vietnameseTranslation: 'Giám đốc điều hành thông báo rằng tiền thưởng hàng quý sẽ được phân phối đồng đều cho tất cả nhân viên toàn thời gian đủ điều kiện.',
    keyVocabulary: [
      { word: 'Distribute', ipa: '/dɪˈstrɪb.juːt/', meaning: 'Phân phối, phân phát' },
      { word: 'Eligible', ipa: '/ˈel.ɪ.dʒə.bəl/', meaning: 'Đủ điều kiện, xứng đáng' }
    ]
  },
  {
    id: 'toeic_p5_2',
    part: 'part5_grammar',
    skill: 'reading',
    questionText: 'Ms. Henderson has proven to be a _______ asset to our international marketing campaign.',
    options: [
      'A. value',
      'B. valuable',
      'C. valuation',
      'D. valuably'
    ],
    correctAnswer: 'B',
    explanation: 'Chỗ trống đứng trước danh từ "asset" và sau mạo từ "a", cần một tính từ (adjective) để bổ nghĩa cho danh từ "asset". Chọn "valuable" (quý giá, có giá trị cao).',
    vietnameseTranslation: 'Cô Henderson đã chứng tỏ mình là một tài sản quý giá cho chiến dịch tiếp thị quốc tế của chúng tôi.',
    keyVocabulary: [
      { word: 'Valuable', ipa: '/ˈvæl.jə.bəl/', meaning: 'Quý giá, có giá trị' },
      { word: 'Asset', ipa: '/ˈæs.et/', meaning: 'Tài sản, nhân tố quý' }
    ]
  },
  {
    id: 'toeic_p5_3',
    part: 'part5_grammar',
    skill: 'reading',
    questionText: 'All travel expense reports must be submitted _______ Friday at 5:00 PM to receive reimbursement this month.',
    options: [
      'A. prior',
      'B. by',
      'C. until',
      'D. since'
    ],
    correctAnswer: 'B',
    explanation: 'Giới từ "by" diễn tả một hành động phải hoàn thành trước hoặc muộn nhất vào một thời điểm cụ thể ("by Friday at 5:00 PM"). "Until" dùng cho hành động kéo dài liên tục.',
    vietnameseTranslation: 'Tất cả các báo cáo chi phí đi lại phải được nộp trước 5:00 chiều thứ Sáu để nhận được tiền hoàn trả trong tháng này.',
    keyVocabulary: [
      { word: 'Reimbursement', ipa: '/ˌriː.ɪmˈbɜːs.mənt/', meaning: 'Sự hoàn tiền, thanh toán lại chi phí' },
      { word: 'Expense', ipa: '/ɪkˈspens/', meaning: 'Chi phí, công tác phí' }
    ]
  },
  {
    id: 'toeic_p5_4',
    part: 'part5_grammar',
    skill: 'reading',
    questionText: 'Despite the severe market downturn, our software division maintained its _______ growth trajectory.',
    options: [
      'A. consistent',
      'B. consistently',
      'C. consistency',
      'D. consist'
    ],
    correctAnswer: 'A',
    explanation: 'Chỗ trống đứng trước cụm danh từ "growth trajectory", cần một tính từ "consistent" (nhất quán, ổn định) để bổ nghĩa.',
    vietnameseTranslation: 'Bất chấp sự suy thoái nghiêm trọng của thị trường, bộ phận phần mềm của chúng tôi vẫn duy trì quỹ đạo tăng trưởng ổn định.',
    keyVocabulary: [
      { word: 'Trajectory', ipa: '/trəˈdʒek.tər.i/', meaning: 'Quỹ đạo, chiều hướng phát triển' },
      { word: 'Downturn', ipa: '/ˈdaʊn.tɜːn/', meaning: 'Sự suy thoái kinh tế' }
    ]
  },

  // --- PART 6 & 7: READING COMPREHENSION ---
  {
    id: 'toeic_p7_1',
    part: 'part7_reading',
    skill: 'reading',
    passage: `MEMORANDUM
To: All Staff Members
From: Human Resources Department
Date: August 28
Subject: New Hybrid Work Policy Implementation

Starting next Monday, our company will formally transition to a hybrid work schedule. Employees in software engineering and product design are required to be present at the office on Tuesdays and Thursdays for core collaborative sessions. For the remaining three days, you may choose to work remotely from home, provided that all sprint deadlines and daily standup check-ins are met.

Please ensure your remote workspace meets our enterprise security standards by installing the updated VPN client available on the company intranet portal by Friday afternoon.`,
    questionText: 'On which days are software engineering employees required to work at the office?',
    options: [
      'A. Mondays and Wednesdays',
      'B. Tuesdays and Thursdays',
      'C. Fridays only',
      'D. Every working day'
    ],
    correctAnswer: 'B',
    explanation: 'Trong thông báo ghi rõ: "Employees in software engineering and product design are required to be present at the office on Tuesdays and Thursdays".',
    vietnameseTranslation: 'BẢN GHI NHỚ: Bắt đầu từ thứ Hai tới, công ty sẽ chính thức chuyển sang lịch làm việc kết hợp (hybrid). Nhân viên kỹ thuật phần mềm và thiết kế sản phẩm phải có mặt tại văn phòng vào Thứ Ba và Thứ Năm...',
    keyVocabulary: [
      { word: 'Hybrid', ipa: '/ˈhaɪ.brɪd/', meaning: 'Kết hợp giữa làm tại văn phòng và làm từ xa' },
      { word: 'Collaborative', ipa: '/kəˈlæb.ər.ə.tɪv/', meaning: 'Mang tính hợp tác tập thể' }
    ]
  },
  {
    id: 'toeic_p7_2',
    part: 'part7_reading',
    skill: 'reading',
    passage: `MEMORANDUM (Tiếp tục đoạn văn trên)
...Please ensure your remote workspace meets our enterprise security standards by installing the updated VPN client available on the company intranet portal by Friday afternoon.`,
    questionText: 'What must employees do before Friday afternoon?',
    options: [
      'A. Submit a formal resignation letter',
      'B. Purchase new ergonomic desks',
      'C. Install the updated VPN client software',
      'D. Schedule a meeting with the HR Director'
    ],
    correctAnswer: 'C',
    explanation: 'Câu cuối bản ghi nhớ yêu cầu: "installing the updated VPN client available on the company intranet portal by Friday afternoon".',
    vietnameseTranslation: 'Vui lòng đảm bảo không gian làm việc từ xa của bạn đáp ứng các tiêu chuẩn bảo mật doanh nghiệp bằng cách cài đặt phần mềm VPN cập nhật có sẵn trên cổng nội bộ trước chiều thứ Sáu.',
    keyVocabulary: [
      { word: 'Enterprise', ipa: '/ˈen.tə.praɪz/', meaning: 'Doanh nghiệp' },
      { word: 'Security', ipa: '/sɪˈkjʊə.rə.ti/', meaning: 'Bảo mật an toàn' }
    ]
  },

  // --- SPEAKING PART (TOEIC 4 SKILLS) ---
  {
    id: 'toeic_sp_1',
    part: 'speaking_read',
    skill: 'speaking',
    questionText: 'Question 1 (Read a text aloud): Nhấn Micro và đọc to đoạn văn bản công sở sau với ngữ điệu và phát âm chuẩn xác.',
    passage: 'Good morning and welcome to Apex Financial Group. Before we begin our tour of the new trading floor, please make sure your visitor badges are visible at all times. If you have any questions regarding our investment portfolio, feel free to ask our analysts during the Q&A session at noon.',
    explanation: 'Đánh giá tiêu chí: Phát âm IPA chuẩn các từ khóa (Financial, Portfolio, Analysts), ngắt nghỉ đúng cụm từ và ngữ điệu tự nhiên.',
    vietnameseTranslation: 'Chào buổi sáng và chào mừng quý vị đến với Tập đoàn Tài chính Apex. Trước khi bắt đầu chuyến tham quan sàn giao dịch mới, vui lòng đảm bảo thẻ khách của quý vị luôn được đeo rõ ràng...',
    keyVocabulary: [
      { word: 'Financial', ipa: '/faɪˈnæn.ʃəl/', meaning: 'Thuộc về tài chính' },
      { word: 'Portfolio', ipa: '/ˌpɔːtˈfəʊ.li.əʊ/', meaning: 'Danh mục đầu tư' }
    ]
  },

  // --- WRITING PART (TOEIC 4 SKILLS) ---
  {
    id: 'toeic_wr_1',
    part: 'writing_email',
    skill: 'writing',
    questionText: 'Question 2 (Write an email response): Viết một email ngắn (50 - 100 từ) phản hồi cho khách hàng Mr. David Miller về việc giao hàng bị chậm trễ do thời tiết và đề xuất giải pháp bồi thường phí vận chuyển.',
    passage: `From: David Miller <david.miller@clientcorp.com>
Subject: Urgent: Order #89201 Delivery Delay
Dear Customer Support,
I was expecting my shipment of server components yesterday, but the tracking status still shows "In Transit". Could you please clarify when my order will arrive?
Sincerely, David Miller`,
    explanation: 'Tiêu chí chấm điểm: Cấu trúc email công sở chuẩn (Salutation, Apology, Explanation, Solution, Closing), sử dụng câu bị động và từ vựng lịch sự.',
    vietnameseTranslation: 'Viết email phản hồi khách hàng: Xin lỗi vì sự chậm trễ, giải thích nguyên nhân khách quan do bão và cam kết giao hàng vào sáng mai kèm miễn phí cước vận chuyển.',
    keyVocabulary: [
      { word: 'Apologize', ipa: '/əˈpɒl.ə.dʒaɪz/', meaning: 'Xin lỗi chân thành' },
      { word: 'Compensation', ipa: '/ˌkɒm.penˈseɪ.ʃən/', meaning: 'Sự bồi thường thỏa đáng' }
    ]
  }
];
