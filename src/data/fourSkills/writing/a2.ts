import { WritingPrompt } from '../types';

export const a2WritingLessons: WritingPrompt[] = [
  {
    id: 'wp_a2_1',
    title: 'Thank You Email After Staying with a Host Family',
    type: 'Informal Email',
    category: 'Social & Travel',
    level: 'A2',
    minWords: 70,
    maxWords: 120,
    wordRange: '70–120 words',
    prompt: 'Bạn vừa trở về nhà sau chuyến đi cuối tuần tại Đà Nẵng và ở nhờ nhà gia đình bạn thân. Viết email (70–120 từ) cảm ơn sự đón tiếp nồng hậu của gia đình: Nhắc lại một món ăn hoặc kỷ niệm bạn thích nhất, thông báo chuyến về an toàn và mời họ ghé thăm nhà bạn khi có dịp.',
    guidelines: [
      'Lời chào trang trọng vừa phải và lời cảm ơn chân thành (Dear Mr. and Mrs. Smith, I am writing to thank you...)',
      'Kể lại một kỷ niệm đáng nhớ trong kỳ nghỉ (The seafood dinner was delicious, walking along the beach was unforgettable)',
      'Thông báo bạn đã về tới nơi an toàn (My bus trip back was safe and comfortable)',
      'Đưa ra lời mời họ đến thăm Hà Nội vào mùa hè tới'
    ],
    recommendedVocab: [
      { word: 'Hospitality', meaning: 'Sự hiếu khách, đón tiếp nồng hậu' },
      { word: 'Memorable', meaning: 'Đáng nhớ, khó quên' },
      { word: 'Comfortable', meaning: 'Thoải mái, dễ chịu' },
      { word: 'Grateful', meaning: 'Biết ơn, cảm kích' }
    ],
    modelAnswer: `Dear Mr. and Mrs. Smith,

I am writing this email to thank you so much for your wonderful hospitality during my stay in Da Nang last weekend.

I had a fantastic time with your family. The seafood dinner you cooked on Saturday night was delicious, and walking along the beach together was unforgettable. My bus trip back to Hanoi was very comfortable and safe.

I am truly grateful for your kindness and warm welcome. Next summer, if you visit Hanoi, please let me know. I will be very happy to show you around the Old Quarter and take you to my favorite noodle shop.

Warm regards,
Tuan`
  },
  {
    id: 'wp_a2_2',
    title: 'My Most Memorable Vacation in Da Lat',
    type: 'Personal Note',
    category: 'Social & Travel',
    level: 'A2',
    minWords: 70,
    maxWords: 120,
    wordRange: '70–120 words',
    prompt: 'Viết một bài chia sẻ ngắn (70–120 từ) cho blog lớp học về chuyến du lịch đáng nhớ của bạn tại Đà Lạt cùng bạn bè: Bạn đi cùng ai, thời tiết ra sao, hai hoạt động thú vị bạn đã trải nghiệm và lý do chuyến đi này có ý nghĩa đặc biệt với bạn.',
    guidelines: [
      'Mở đầu bằng thông tin về thời gian và người đồng hành (Last November, with my roommates...)',
      'Mô tả thời tiết và cảnh sắc thiên nhiên (chilly weather, morning fog, pine trees)',
      'Kể 2 hoạt động nổi bật bằng thì Quá khứ Đơn (visited coffee plantation, explored night market)',
      'Kết luận lý do chuyến đi giúp bạn xả stress và gắn kết bạn bè hơn'
    ],
    recommendedVocab: [
      { word: 'Picturesque', meaning: 'Đẹp như tranh vẽ' },
      { word: 'Chilly', meaning: 'Se se lạnh' },
      { word: 'Specialty', meaning: 'Đặc sản địa phương' },
      { word: 'Unwind', meaning: 'Thư giãn, xả hơi' }
    ],
    modelAnswer: `Last November, I went on a four-day vacation to Da Lat with my two university roommates.

The weather was pleasantly chilly and the mountain air felt very fresh. On our first morning, we rented two scooters and rode to a picturesque coffee plantation on the hillside. We drank hot dark coffee and watched the morning fog over the pine trees. In the evening, we explored the crowded night market and tasted local street specialties such as grilled rice paper and warm soy milk.

This trip was truly special to me because it helped us unwind after exhausting exams and brought us much closer together.`
  },
  {
    id: 'wp_a2_3',
    title: 'Restaurant Review for a Student Food Forum',
    type: 'Short Message',
    category: 'Daily Life',
    level: 'A2',
    minWords: 70,
    maxWords: 120,
    wordRange: '70–120 words',
    prompt: 'Viết một bài đánh giá ngắn (70–120 từ) trên diễn đàn ẩm thực sinh viên về một quán mì ramen Nhật Bản mới mở gần trường: Giới thiệu tên và vị trí quán, món ăn bạn đã gọi, đánh giá hương vị, thái độ phục vụ, mức giá và lời khuyên có nên đến thử không.',
    guidelines: [
      'Nêu rõ tên quán và vị trí gần trường đại học (Tokyo Ramen, behind university campus)',
      'Miêu tả món ăn chi tiết (rich and flavorful broth, chewy noodles, roasted pork)',
      'Đánh giá nhân viên và mức giá phù hợp sinh viên (friendly and attentive, reasonable price)',
      'Đưa ra nhận định tổng quan và thang điểm chấm (highly recommend, 4/5 stars)'
    ],
    recommendedVocab: [
      { word: 'Flavorful', meaning: 'Đậm đà, thơm ngon' },
      { word: 'Reasonable', meaning: 'Hợp lý, vừa túi tiền' },
      { word: 'Attentive', meaning: 'Chu đáo, tận tình' },
      { word: 'Highly recommend', meaning: 'Rất khuyến khích, khuyên dùng' }
    ],
    modelAnswer: `Yesterday, I visited Tokyo Ramen, a new Japanese noodle shop located right behind our university campus.

I ordered the signature Tonkotsu ramen with roasted pork and boiled egg. The broth was rich and flavorful, and the noodles were perfectly chewy. Although the shop was quite small and crowded at lunchtime, the staff members were very friendly and attentive. The bill was only ninety thousand dong, which is extremely reasonable for university students.

Overall, it was a delightful dining experience. If you love authentic ramen on a student budget, I highly recommend visiting this shop. I give it four out of five stars!`
  },
  {
    id: 'wp_a2_4',
    title: 'Declining an Invitation with an Apology and Alternative',
    type: 'Informal Email',
    category: 'Daily Life',
    level: 'A2',
    minWords: 70,
    maxWords: 120,
    wordRange: '70–120 words',
    prompt: 'Bạn của bạn (Mike) rủ bạn đi cắm trại vào thứ Bảy này, nhưng bạn có kỳ thi giữa kỳ quan trọng vào sáng thứ Hai. Viết email (70–120 từ) gửi Mike: Cảm ơn lời mời, giải thích lý do bạn không thể tham gia, mô tả việc ôn thi bận rộn và đề xuất một buổi gặp mặt khác vào tuần sau.',
    guidelines: [
      'Cảm ơn lời mời cắm trại một cách hào hứng (Thank you so much for inviting me...)',
      'Từ chối lịch sự và nêu rõ lý do kỳ thi giữa kỳ (chemistry midterm exam on Monday morning)',
      'Giải thích sự cần thiết phải ở nhà ôn tập (must revise five chapters, get good grades)',
      'Đề xuất dời lịch gặp mặt sang Chủ nhật tuần sau khi kỳ thi đã kết thúc'
    ],
    recommendedVocab: [
      { word: 'Midterm exam', meaning: 'Kỳ thi giữa kỳ' },
      { word: 'Preparation', meaning: 'Sự chuẩn bị, ôn luyện' },
      { word: 'Reschedule', meaning: 'Lên lại lịch, đổi lịch hẹn' },
      { word: 'Catch up', meaning: 'Gặp gỡ hàn huyên, cập nhật tin tức' }
    ],
    modelAnswer: `Hi Mike,

Thank you so much for inviting me to join the camping trip at the national park this Saturday. It sounds like an amazing adventure!

However, I am really sorry to tell you that I cannot make it this time. I have an important chemistry midterm exam on Monday morning, so I must stay home all weekend to revise five difficult chapters. My parents and teachers expect me to get good grades, so I cannot afford to lose study time.

Can we reschedule and hang out next Sunday instead? After my exam finishes, I will be completely free to catch up.

Best,
Huy`
  }
];
