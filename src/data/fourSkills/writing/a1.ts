import { WritingPrompt } from '../types';

export const a1WritingLessons: WritingPrompt[] = [
  {
    id: 'wp_a1_1',
    title: 'Self-Introduction Note for an English Club',
    type: 'Personal Note',
    category: 'Daily Life',
    level: 'A1',
    minWords: 40,
    maxWords: 70,
    wordRange: '40–70 words',
    prompt: 'Viết một mẩu ghi chú ngắn (40–70 từ) để giới thiệu bản thân với các thành viên mới trong câu lạc bộ tiếng Anh: Nêu tên, nơi bạn đang sống, công việc hoặc ngành học hiện tại, 1-2 sở thích cá nhân và lý do bạn muốn tham gia câu lạc bộ.',
    guidelines: [
      'Chào hỏi thân thiện và giới thiệu tên, nơi ở bằng thì Hiện tại Đơn (My name is..., I live in...)',
      'Nêu công việc hoặc ngành học hiện tại (I work as... / I study...)',
      'Chia sẻ một vài sở thích lúc rảnh rỗi (In my free time, I enjoy...)',
      'Nêu lý do tham gia câu lạc bộ để làm quen và cải thiện kỹ năng nói'
    ],
    recommendedVocab: [
      { word: 'Friendly', meaning: 'Thân thiện, cởi mở' },
      { word: 'Spare time', meaning: 'Thời gian rảnh rỗi' },
      { word: 'Improve', meaning: 'Cải thiện, nâng cao' },
      { word: 'Member', meaning: 'Thành viên câu lạc bộ' }
    ],
    modelAnswer: `Hello everyone! My name is Nam and I live in Hanoi. I am a software tester at an IT company. In my spare time, I like reading books and playing football with my friends. I want to join this club because I want to make new friends and improve my spoken English. Nice to meet you all!`
  },
  {
    id: 'wp_a1_2',
    title: 'Weekend Plans Message to a Friend',
    type: 'Short Message',
    category: 'Social & Travel',
    level: 'A1',
    minWords: 40,
    maxWords: 70,
    wordRange: '40–70 words',
    prompt: 'Viết một tin nhắn ngắn (40–70 từ) gửi cho bạn Alex để hỏi thăm tình hình, rủ bạn đi uống cà phê vào sáng thứ Bảy tuần này và hỏi xem bạn có rảnh để tham gia cùng không.',
    guidelines: [
      'Bắt đầu bằng lời chào thân mật và câu hỏi thăm (Hi Alex, how are you?)',
      'Đưa ra lời rủ đi cà phê với thời gian và địa điểm cụ thể (on Saturday morning at 9 AM)',
      'Gợi ý một hoạt động đơn giản (drink iced coffee, chat about our new jobs)',
      'Hỏi xem bạn có rảnh không và đề nghị bạn phản hồi sớm'
    ],
    recommendedVocab: [
      { word: 'Free', meaning: 'Rảnh rỗi, có thời gian' },
      { word: 'Coffee shop', meaning: 'Quán cà phê' },
      { word: 'Suggest', meaning: 'Gợi ý, đề xuất' },
      { word: 'Weekend', meaning: 'Dịp cuối tuần' }
    ],
    modelAnswer: `Hi Alex, how are you doing? Are you free this weekend? I want to invite you to a nice coffee shop near my house on Saturday morning at 9 AM. We can drink iced coffee and chat about our new jobs. Please text me back if you can come. See you soon!`
  },
  {
    id: 'wp_a1_3',
    title: 'Daily Morning Routine Description',
    type: 'Personal Note',
    category: 'Daily Life',
    level: 'A1',
    minWords: 40,
    maxWords: 70,
    wordRange: '40–70 words',
    prompt: 'Viết một đoạn văn ngắn (40–70 từ) mô tả thói quen buổi sáng điển hình của bạn: Thời gian thức dậy, các hoạt động vệ sinh và ăn sáng, phương tiện đi lại và thời gian bắt đầu ngày làm việc/học tập.',
    guidelines: [
      'Dùng thì Hiện tại Đơn diễn tả các thói quen lặp lại hàng ngày (Every weekday, I wake up at...)',
      'Sử dụng các từ nối trình tự thời gian cơ bản (First, After that, Then)',
      'Mô tả bữa ăn sáng và phương tiện di chuyển (ride motorbike, bus)',
      'Nêu mốc thời gian bắt đầu ca học hoặc ca làm việc'
    ],
    recommendedVocab: [
      { word: 'Routine', meaning: 'Thói quen, lịch trình hàng ngày' },
      { word: 'Healthy', meaning: 'Lành mạnh, tốt cho sức khỏe' },
      { word: 'Commute', meaning: 'Đi lại, di chuyển đi làm' },
      { word: 'Arrive', meaning: 'Đến nơi, có mặt' }
    ],
    modelAnswer: `Every weekday, I wake up at 6:30 AM. First, I wash my face, brush my teeth, and eat a healthy breakfast with bread and milk. After that, I ride my motorbike to the office. The street is busy, but I always arrive before 8:30 AM. My workday starts at 9:00 AM.`
  },
  {
    id: 'wp_a1_4',
    title: 'Birthday Party Invitation Note',
    type: 'Informal Email',
    category: 'Social & Travel',
    level: 'A1',
    minWords: 40,
    maxWords: 70,
    wordRange: '40–70 words',
    prompt: 'Chủ nhật tới là sinh nhật bạn. Viết một bức thư ngắn hoặc thiệp mời (40–70 từ) gửi cho bạn cùng lớp Linh: Mời bạn tới nhà ăn tối chúc mừng sinh nhật, nêu thời gian, địa điểm, các món ăn/trò chơi và đề nghị bạn báo trước.',
    guidelines: [
      'Lời mở đầu thân thiện với bạn bè (Dear Linh,)',
      'Nêu lý do tổ chức tiệc sinh nhật lần thứ 20 (my twentieth birthday)',
      'Thời gian và hoạt động chính (dinner at 6 PM, delicious pizza, music, games)',
      'Đề nghị bạn phản hồi xác nhận tham gia trước thứ Sáu'
    ],
    recommendedVocab: [
      { word: 'Celebrate', meaning: 'Kỷ niệm, ăn mừng' },
      { word: 'Delicious', meaning: 'Ngon miệng' },
      { word: 'Classmate', meaning: 'Bạn cùng lớp' },
      { word: 'Invitation', meaning: 'Lời mời dự tiệc' }
    ],
    modelAnswer: `Dear Linh,
Next Sunday is my twentieth birthday! I am having a small party at my home at 6:00 PM. We will eat delicious pizza, listen to pop music, and play video games together. I really hope you can come and celebrate with me. Please let me know by Friday.
Best,
Hoa`
  }
];
