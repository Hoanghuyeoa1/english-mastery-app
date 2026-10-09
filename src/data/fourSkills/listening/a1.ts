import { ListeningLesson } from '../types';

export const a1ListeningLessons: ListeningLesson[] = [
  {
    id: 'listen_a1_1',
    title: 'Ordering Breakfast at the Sunny Side Cafe',
    category: 'Daily Life',
    format: 'Dialogue',
    level: 'A1',
    duration: '1:50',
    description: 'Cuộc hội thoại gọi món ăn sáng và đồ uống phổ biến giữa thực khách và nhân viên phục vụ tại quán cà phê.',
    audioText: `Good morning! Welcome to the Sunny Side Cafe. Are you ready to order breakfast today?
Yes, good morning! I would like the classic pancake set with honey, please.
Certainly! Would you like fresh strawberries or bananas on top of your pancakes?
I prefer fresh strawberries, please. And could I also get two scrambled eggs on the side?
Sure thing. What would you like to drink with your meal today?
Do you have fresh orange juice?
Yes, we squeeze it every morning. Would you like a small or large glass?
A large glass of orange juice, please. And could I also get a cup of hot black coffee?
Of course. One pancake set with strawberries, two scrambled eggs, a large orange juice, and a hot black coffee. Is that all for you?
Yes, that is everything. How much is the total?
The total comes to twelve dollars and fifty cents. You can pay by cash or credit card right here.
Here is my credit card. Thank you very much for your help!
You are welcome! Your breakfast will be ready at your table in ten minutes.`,
    sentences: [
      {
        speaker: 'Waiter',
        en: 'Good morning! Welcome to the Sunny Side Cafe. Are you ready to order breakfast today?',
        vi: 'Chào buổi sáng! Chào mừng quý khách đến với Quán cà phê Sunny Side. Quý khách đã sẵn sàng gọi món ăn sáng hôm nay chưa ạ?'
      },
      {
        speaker: 'Customer',
        en: 'Yes, good morning! I would like the classic pancake set with honey, please.',
        vi: 'Vâng, chào buổi sáng! Cho tôi xin phần bánh kếp truyền thống kèm mật ong nhé.'
      },
      {
        speaker: 'Waiter',
        en: 'Certainly! Would you like fresh strawberries or bananas on top of your pancakes?',
        vi: 'Dạ chắc chắn rồi! Quý khách muốn thêm dâu tây tươi hay chuối lên trên bánh kếp ạ?'
      },
      {
        speaker: 'Customer',
        en: 'I prefer fresh strawberries, please. And could I also get two scrambled eggs on the side?',
        vi: 'Tôi thích dâu tây tươi hơn. Và cho tôi gọi thêm hai quả trứng khuấy ăn kèm được không?'
      },
      {
        speaker: 'Waiter',
        en: 'Sure thing. What would you like to drink with your meal today?',
        vi: 'Dạ được chứ ạ. Hôm nay quý khách muốn dùng thức uống gì cùng bữa ăn?'
      },
      {
        speaker: 'Customer',
        en: 'Do you have fresh orange juice?',
        vi: 'Quán mình có nước cam tươi không bạn?'
      },
      {
        speaker: 'Waiter',
        en: 'Yes, we squeeze it every morning. Would you like a small or large glass?',
        vi: 'Dạ có, chúng tôi vắt cam tươi mỗi buổi sáng. Quý khách muốn dùng ly nhỏ hay ly lớn ạ?'
      },
      {
        speaker: 'Customer',
        en: 'A large glass of orange juice, please. And could I also get a cup of hot black coffee?',
        vi: 'Cho tôi một ly nước cam lớn nhé. Và cho tôi thêm một tách cà phê đen nóng nữa được không?'
      },
      {
        speaker: 'Waiter',
        en: 'Of course. One pancake set with strawberries, two scrambled eggs, a large orange juice, and a hot black coffee. Is that all for you?',
        vi: 'Dạ được ạ. Một phần bánh kếp kèm dâu tây, hai quả trứng khuấy, một nước cam lớn và một cà phê đen nóng. Đó là tất cả món của quý khách đúng không ạ?'
      },
      {
        speaker: 'Customer',
        en: 'Yes, that is everything. How much is the total?',
        vi: 'Vâng, tất cả bấy nhiêu thôi. Tổng cộng hết bao nhiêu tiền vậy bạn?'
      },
      {
        speaker: 'Waiter',
        en: 'The total comes to twelve dollars and fifty cents. You can pay by cash or credit card right here.',
        vi: 'Dạ tổng cộng hết mười hai đô la và năm mươi xu. Quý khách có thể thanh toán bằng tiền mặt hoặc thẻ tín dụng ngay tại đây.'
      },
      {
        speaker: 'Customer',
        en: 'Here is my credit card. Thank you very much for your help!',
        vi: 'Đây là thẻ tín dụng của tôi. Cảm ơn bạn rất nhiều vì đã giúp đỡ!'
      },
      {
        speaker: 'Waiter',
        en: 'You are welcome! Your breakfast will be ready at your table in ten minutes.',
        vi: 'Dạ không có chi! Bữa sáng của quý khách sẽ được mang ra bàn sau mười phút nữa ạ.'
      }
    ],
    questions: [
      {
        id: 'q_a1_1_1',
        type: 'main_idea',
        question: 'What is the main purpose of the conversation between the customer and the waiter?',
        options: [
          'The customer is ordering a breakfast meal and drinks at a cafe',
          'The customer is applying for a job as a barista',
          'The waiter is teaching the customer how to bake pancakes',
          'The customer is complaining about cold food'
        ],
        correctIndex: 0,
        explanation: 'Cuộc trò chuyện xoay quanh việc khách hàng chọn món ăn sáng (bánh kếp, trứng khuấy) và đồ uống tại quán cà phê.'
      },
      {
        id: 'q_a1_1_2',
        type: 'detail',
        question: 'What fruit topping does the customer choose for the pancakes?',
        options: [
          'Fresh strawberries',
          'Green apples',
          'Fresh blueberries',
          'Sweet bananas'
        ],
        correctIndex: 0,
        explanation: 'Khách hàng nói rõ: "I prefer fresh strawberries, please" (Tôi thích dâu tây tươi hơn).'
      },
      {
        id: 'q_a1_1_3',
        type: 'vocab_context',
        question: 'In the conversation, what does the word "squeeze" mean when the waiter mentions the orange juice?',
        options: [
          'To press fruit to extract fresh liquid juice',
          'To freeze juice into cold ice cubes',
          'To boil fruit in hot water',
          'To purchase bottled juice from a store'
        ],
        correctIndex: 0,
        explanation: '"Squeeze" có nghĩa là ép hoặc vắt trái cây để lấy nước tươi ("press fruit to extract fresh liquid juice").'
      },
      {
        id: 'q_a1_1_4',
        type: 'detail',
        question: 'How much does the customer pay for the entire breakfast order?',
        options: [
          'Twelve dollars and fifty cents ($12.50)',
          'Ten dollars and twenty cents ($10.20)',
          'Fifteen dollars exactly ($15.00)',
          'Eight dollars and fifty cents ($8.50)'
        ],
        correctIndex: 0,
        explanation: 'Người phục vụ thông báo: "The total comes to twelve dollars and fifty cents" ($12.50).'
      }
    ]
  },
  {
    id: 'listen_a1_2',
    title: 'Weekend Grocery Special Announcement',
    category: 'Daily Life',
    format: 'Announcement',
    level: 'A1',
    duration: '2:15',
    description: 'Thông báo khuyến mãi cuối tuần và giờ đóng cửa tại siêu thị Green Market.',
    audioText: `Attention, valued shoppers of Green Market! Good afternoon and welcome to our store. We are pleased to announce our special weekend discounts available today on the first and second floors. In the fresh produce section on floor one, all organic red apples and green grapes are on sale at fifty percent off. If you are preparing dinner tonight, fresh salmon and chicken breast in the meat department are buy one, get one free until six in the evening. In aisle four, you can find fresh whole-wheat bread baked just one hour ago. Please remember that our bakery items sell out very quickly on Saturday afternoons. For our members, please present your loyalty card at checkout counter number five to collect double reward points. If you need help carrying heavy grocery bags, our friendly staff members in green shirts are happy to assist you near the main entrance. You can also pick up a free reusable canvas shopping bag at the customer service desk before you leave today. Green Market will close tonight at nine o'clock, so please complete your purchases thirty minutes before closing time. Thank you for shopping with us today, and we hope you have a wonderful weekend with your family.`,
    sentences: [
      {
        en: 'Attention, valued shoppers of Green Market! Good afternoon and welcome to our store.',
        vi: 'Xin quý khách mua sắm tại Siêu thị Green Market lưu ý! Xin kính chào quý khách và chào mừng quý khách đến với cửa hàng của chúng tôi.'
      },
      {
        en: 'We are pleased to announce our special weekend discounts available today on the first and second floors.',
        vi: 'Chúng tôi rất vui mừng thông báo các chương trình giảm giá đặc biệt cuối tuần diễn ra hôm nay tại tầng một và tầng hai.'
      },
      {
        en: 'In the fresh produce section on floor one, all organic red apples and green grapes are on sale at fifty percent off.',
        vi: 'Tại khu vực rau củ quả tươi ở tầng một, tất cả táo đỏ và nho xanh hữu cơ đang được giảm giá 50%.'
      },
      {
        en: 'If you are preparing dinner tonight, fresh salmon and chicken breast in the meat department are buy one, get one free until six in the evening.',
        vi: 'Nếu quý khách đang chuẩn bị bữa tối, cá hồi tươi và ức gà tại quầy thịt có ưu đãi mua một tặng một cho đến 6 giờ tối.'
      },
      {
        en: 'In aisle four, you can find fresh whole-wheat bread baked just one hour ago.',
        vi: 'Tại lối đi số bốn, quý khách có thể tìm thấy bánh mì nguyên cám tươi mới nướng cách đây một tiếng.'
      },
      {
        en: 'Please remember that our bakery items sell out very quickly on Saturday afternoons.',
        vi: 'Xin lưu ý rằng các mặt hàng bánh mì thường bán hết rất nhanh vào các buổi chiều thứ Bảy.'
      },
      {
        en: 'For our members, please present your loyalty card at checkout counter number five to collect double reward points.',
        vi: 'Đối với quý khách là hội viên, vui lòng xuất trình thẻ thành viên tại quầy thu ngân số 5 để tích lũy gấp đôi điểm thưởng.'
      },
      {
        en: 'If you need help carrying heavy grocery bags, our friendly staff members in green shirts are happy to assist you near the main entrance.',
        vi: 'Nếu quý khách cần giúp đỡ mang các túi hàng nặng, các nhân viên thân thiện mặc áo xanh của chúng tôi luôn sẵn lòng hỗ trợ gần cửa chính.'
      },
      {
        en: 'You can also pick up a free reusable canvas shopping bag at the customer service desk before you leave today.',
        vi: 'Quý khách cũng có thể nhận một túi vải canvas tái sử dụng miễn phí tại quầy dịch vụ khách hàng trước khi ra về hôm nay.'
      },
      {
        en: 'Green Market will close tonight at nine o\'clock, so please complete your purchases thirty minutes before closing time.',
        vi: 'Siêu thị Green Market sẽ đóng cửa lúc 9 giờ tối nay, vì vậy quý khách vui lòng hoàn tất mua sắm trước giờ đóng cửa 30 phút.'
      },
      {
        en: 'Thank you for shopping with us today, and we hope you have a wonderful weekend with your family.',
        vi: 'Cảm ơn quý khách đã mua sắm tại siêu thị hôm nay, chúc quý khách có một kỳ nghỉ cuối tuần tuyệt vời bên gia đình.'
      }
    ],
    questions: [
      {
        id: 'q_a1_2_1',
        type: 'main_idea',
        question: 'What is the main topic of the store announcement?',
        options: [
          'Weekend discounts on food items and information about store hours',
          'Instructions for applying for a cashier job',
          'A fire safety warning for all store employees',
          'A schedule for renovating the supermarket parking lot'
        ],
        correctIndex: 0,
        explanation: 'Thông báo giới thiệu các chương trình giảm giá cuối tuần (hoa quả, thịt, bánh mì) và nhắc nhở thời gian đóng cửa của siêu thị.'
      },
      {
        id: 'q_a1_2_2',
        type: 'detail',
        question: 'Which department offers a "buy one, get one free" promotion until six PM?',
        options: [
          'The fresh meat department with salmon and chicken breast',
          'The clothing department on the second floor',
          'The electronics department',
          'The flower shop near the entrance'
        ],
        correctIndex: 0,
        explanation: 'Đoạn thông báo nêu rõ: "fresh salmon and chicken breast in the meat department are buy one, get one free until six in the evening".'
      },
      {
        id: 'q_a1_2_3',
        type: 'vocab_context',
        question: 'In the announcement, what does the word "produce" refer to in the fresh produce section?',
        options: [
          'Fresh fruits and vegetables grown on farms',
          'Manufactured electronic kitchen gadgets',
          'Plastic bags and food containers',
          'Cleaning liquids and paper towels'
        ],
        correctIndex: 0,
        explanation: 'Trong ngữ cảnh siêu thị, danh từ "produce" dùng để chỉ nông sản tươi, đặc biệt là rau củ và trái cây tươi.'
      },
      {
        id: 'q_a1_2_4',
        type: 'detail',
        question: 'What time will Green Market close tonight?',
        options: [
          'At nine o\'clock (9:00 PM)',
          'At six o\'clock (6:00 PM)',
          'At eight thirty (8:30 PM)',
          'At ten o\'clock (10:00 PM)'
        ],
        correctIndex: 0,
        explanation: 'Người phát thanh nói: "Green Market will close tonight at nine o\'clock".'
      }
    ]
  },
  {
    id: 'listen_a1_3',
    title: 'Leo\'s Saturday Morning Routine in the Park',
    category: 'Daily Life',
    format: 'Story',
    level: 'A1',
    duration: '2:20',
    description: 'Câu chuyện giản dị về thói quen buổi sáng thứ Bảy của Leo cùng chú chó cưng tại công viên thành phố.',
    audioText: `Every Saturday morning, Leo wakes up early at seven o'clock. He likes Saturdays because he does not have to go to work at the bookstore. First, he puts on his comfortable blue sneakers and drinks a tall glass of cool water. Next, he prepares a bowl of dry food for his golden dog, Bruno. Bruno wags his tail happily because he knows it is time for their morning walk. They walk down the quiet street toward Central Park. The morning air feels cool, and the golden sunlight shines through the tall green trees. At the park, many people are exercising. Some neighbors are jogging along the path, while older people are doing gentle stretching on the grass. Leo throws a yellow tennis ball, and Bruno runs quickly across the soft green lawn to catch it. After playing for thirty minutes, Leo buys a warm blueberry muffin and sits on a wooden bench near the duck pond. While Leo enjoys his sweet breakfast snack, he watches little ducklings swim happily near the edge of the water. Bruno sits quietly beside the wooden bench, resting his tired paws on the cool grass. The morning visit gives both of them great energy for the rest of the sunny day. He feels relaxed and happy before starting his weekend chores.`,
    sentences: [
      {
        en: 'Every Saturday morning, Leo wakes up early at seven o\'clock.',
        vi: 'Mỗi sáng thứ Bảy, Leo đều thức dậy sớm vào lúc 7 giờ.'
      },
      {
        en: 'He likes Saturdays because he does not have to go to work at the bookstore.',
        vi: 'Anh ấy thích thứ Bảy vì không phải đi làm tại hiệu sách.'
      },
      {
        en: 'First, he puts on his comfortable blue sneakers and drinks a tall glass of cool water.',
        vi: 'Đầu tiên, anh xỏ đôi giày thể thao màu xanh êm ái và uống một ly nước mát đầy.'
      },
      {
        en: 'Next, he prepares a bowl of dry food for his golden dog, Bruno.',
        vi: 'Tiếp theo, anh chuẩn bị một bát thức ăn hạt khô cho chú chó lông vàng của mình, Bruno.'
      },
      {
        en: 'Bruno wags his tail happily because he knows it is time for their morning walk.',
        vi: 'Bruno vẫy đuôi vui sướng vì nó biết đã đến giờ đi dạo buổi sáng.'
      },
      {
        en: 'They walk down the quiet street toward Central Park.',
        vi: 'Họ cùng nhau đi bộ dọc theo con phố yên tĩnh hướng về phía Công viên Trung tâm.'
      },
      {
        en: 'The morning air feels cool, and the golden sunlight shines through the tall green trees.',
        vi: 'Không khí buổi sáng thật mát mẻ, và ánh nắng vàng chiếu xuyên qua những hàng cây xanh cao vút.'
      },
      {
        en: 'At the park, many people are exercising.',
        vi: 'Tại công viên, có rất nhiều người đang tập thể dục.'
      },
      {
        en: 'Some neighbors are jogging along the path, while older people are doing gentle stretching on the grass.',
        vi: 'Vài người hàng xóm đang chạy bộ dọc lối đi, trong khi những người lớn tuổi đang tập giãn cơ nhẹ nhàng trên thảm cỏ.'
      },
      {
        en: 'Leo throws a yellow tennis ball, and Bruno runs quickly across the soft green lawn to catch it.',
        vi: 'Leo ném một quả bóng tennis màu vàng, và Bruno chạy thật nhanh qua bãi cỏ xanh mềm để bắt lấy nó.'
      },
      {
        en: 'After playing for thirty minutes, Leo buys a warm blueberry muffin and sits on a wooden bench near the duck pond.',
        vi: 'Sau khi chơi đùa 30 phút, Leo mua một chiếc bánh nướng xốp việt quất ấm nóng và ngồi trên ghế gỗ gần hồ vịt.'
      },
      {
        en: 'While Leo enjoys his sweet breakfast snack, he watches little ducklings swim happily near the edge of the water.',
        vi: 'Trong khi Leo thưởng thức bữa điểm tâm ngọt ngào của mình, anh ngắm nhìn những chú vịt con bơi lội tung tăng gần mép nước.'
      },
      {
        en: 'Bruno sits quietly beside the wooden bench, resting his tired paws on the cool grass.',
        vi: 'Bruno ngồi ngoan ngoãn bên cạnh chiếc ghế gỗ, để đôi chân mỏi của mình nghỉ ngơi trên thảm cỏ mát rượi.'
      },
      {
        en: 'The morning visit gives both of them great energy for the rest of the sunny day.',
        vi: 'Chuyến dạo chơi buổi sáng mang lại cho cả hai nguồn năng lượng tuyệt vời cho khoảng thời gian còn lại của ngày nắng đẹp.'
      },
      {
        en: 'He feels relaxed and happy before starting his weekend chores.',
        vi: 'Anh cảm thấy thư thái và vui vẻ trước khi bắt đầu những công việc nhà cuối tuần.'
      }
    ],
    questions: [
      {
        id: 'q_a1_3_1',
        type: 'main_idea',
        question: 'What is the passage mostly about?',
        options: [
          'Leo\'s peaceful Saturday morning routine with his pet dog in the park',
          'How to train a dog to perform difficult tricks in competitions',
          'The daily work duties of a bookstore manager',
          'Cooking healthy meals for domestic pets'
        ],
        correctIndex: 0,
        explanation: 'Đoạn văn kể về các hoạt động quen thuộc vào sáng thứ Bảy của Leo cùng chú chó Bruno khi đi dạo tại công viên.'
      },
      {
        id: 'q_a1_3_2',
        type: 'detail',
        question: 'Where does Leo work on regular weekdays?',
        options: [
          'At a bookstore',
          'At a veterinary clinic',
          'At a bakery near the park',
          'At a sports equipment shop'
        ],
        correctIndex: 0,
        explanation: 'Câu văn thứ hai nêu: "he does not have to go to work at the bookstore" (anh ấy không phải đi làm tại hiệu sách).'
      },
      {
        id: 'q_a1_3_3',
        type: 'vocab_context',
        question: 'In the story, what does the word "jogging" mean?',
        options: [
          'Running at a steady and gentle pace for physical fitness',
          'Sleeping under a shady tree in the park',
          'Riding a bicycle very fast down a hill',
          'Swimming in a freshwater lake'
        ],
        correctIndex: 0,
        explanation: '"Jogging" là hành động chạy bộ với tốc độ vừa phải, đều đặn để rèn luyện sức khỏe ("running at a steady pace").'
      },
      {
        id: 'q_a1_3_4',
        type: 'sequence',
        question: 'What does Leo do immediately after playing ball with Bruno for thirty minutes?',
        options: [
          'He buys a warm muffin and sits on a bench near the duck pond',
          'He returns home to clean his bedroom floor',
          'He goes to work at the local bookstore',
          'He washes his dog with warm water'
        ],
        correctIndex: 0,
        explanation: 'Đoạn cuối nêu rõ trình tự: "After playing for thirty minutes, Leo buys a warm blueberry muffin and sits on a wooden bench near the duck pond".'
      }
    ]
  },
  {
    id: 'listen_a1_4',
    title: 'Finding the Office Cafeteria on the First Day',
    category: 'Workplace',
    format: 'Dialogue',
    level: 'A1',
    duration: '2:10',
    description: 'Nhân viên mới hỏi đường đến nhà ăn văn phòng và phòng in ấn trong ngày đầu tiên đi làm.',
    audioText: `Excuse me, David. Do you have a quick minute to help me?
Hi Anna! Welcome to our team. Yes, of course. What do you need?
Thank you! Since today is my first day at the company, I do not know where the lunch cafeteria is located. Could you show me the way?
Certainly! It is very easy to find. Take the main elevator down to the second floor. When the elevator doors open, turn left and walk past the glass conference room.
Is the cafeteria next to the conference room?
No, keep walking down the hallway. You will see a large blue sign that says Harmony Dining Hall. That is our cafeteria.
Great! Does the cafeteria serve vegetarian meals as well?
Yes, there is a fresh salad bar and two hot vegetarian soup options every day from eleven thirty until two in the afternoon.
That sounds delicious. One more quick question: where can I find the color printer to print my employee badge form?
The printing station is right here on our floor. Just walk past the water cooler, and it is on your right side.
Thank you so much for your warm help, David!
No problem at all, Anna. Enjoy your lunch!`,
    sentences: [
      {
        speaker: 'Anna',
        en: 'Excuse me, David. Do you have a quick minute to help me?',
        vi: 'Xin lỗi David, anh có chút thời gian giúp em một chút được không?'
      },
      {
        speaker: 'David',
        en: 'Hi Anna! Welcome to our team. Yes, of course. What do you need?',
        vi: 'Chào Anna! Chào mừng em đến với đội ngũ. Được chứ, em cần anh giúp gì nào?'
      },
      {
        speaker: 'Anna',
        en: 'Thank you! Since today is my first day at the company, I do not know where the lunch cafeteria is located. Could you show me the way?',
        vi: 'Cảm ơn anh! Vì hôm nay là ngày đầu tiên của em ở công ty nên em chưa biết nhà ăn trưa nằm ở đâu. Anh chỉ đường cho em với được không?'
      },
      {
        speaker: 'David',
        en: 'Certainly! It is very easy to find. Take the main elevator down to the second floor. When the elevator doors open, turn left and walk past the glass conference room.',
        vi: 'Chắc chắn rồi! Tìm dễ lắm. Em đi thang máy chính xuống tầng 2 nhé. Khi cửa thang máy mở ra, rẽ trái rồi đi qua phòng họp bằng kính.'
      },
      {
        speaker: 'Anna',
        en: 'Is the cafeteria next to the conference room?',
        vi: 'Nhà ăn có nằm ngay cạnh phòng họp không anh?'
      },
      {
        speaker: 'David',
        en: 'No, keep walking down the hallway. You will see a large blue sign that says Harmony Dining Hall. That is our cafeteria.',
        vi: 'Không, em cứ đi tiếp dọc theo hành lang. Em sẽ thấy một tấm biển lớn màu xanh ghi Nhà ăn Harmony. Đó chính là nhà ăn của chúng ta.'
      },
      {
        speaker: 'Anna',
        en: 'Great! Does the cafeteria serve vegetarian meals as well?',
        vi: 'Tuyệt quá! Nhà ăn có phục vụ cả đồ ăn chay không anh?'
      },
      {
        speaker: 'David',
        en: 'Yes, there is a fresh salad bar and two hot vegetarian soup options every day from eleven thirty until two in the afternoon.',
        vi: 'Có chứ, ở đó có quầy salad tươi và hai món súp chay nóng mỗi ngày từ 11 giờ 30 đến 2 giờ chiều.'
      },
      {
        speaker: 'Anna',
        en: 'That sounds delicious. One more quick question: where can I find the color printer to print my employee badge form?',
        vi: 'Nghe hấp dẫn quá. Cho em hỏi thêm một câu ngắn nữa: em có thể tìm máy in màu ở đâu để in mẫu thẻ nhân viên ạ?'
      },
      {
        speaker: 'David',
        en: 'The printing station is right here on our floor. Just walk past the water cooler, and it is on your right side.',
        vi: 'Khu vực in ấn ở ngay trên tầng của chúng mình luôn. Em chỉ cần đi qua cây nước uống, nó nằm ở phía bên tay phải.'
      },
      {
        speaker: 'Anna',
        en: 'Thank you so much for your warm help, David!',
        vi: 'Cảm ơn sự giúp đỡ nhiệt tình của anh nhiều nhé David!'
      },
      {
        speaker: 'David',
        en: 'No problem at all, Anna. Enjoy your lunch!',
        vi: 'Không có chi Anna ơi. Chúc em ăn trưa ngon miệng nhé!'
      }
    ],
    questions: [
      {
        id: 'q_a1_4_1',
        type: 'main_idea',
        question: 'Why is Anna speaking with David in the office?',
        options: [
          'She is a new employee asking for directions to the cafeteria and printer',
          'She is submitting her annual resignation letter',
          'She wants to schedule a formal client meeting on the second floor',
          'She is asking for a salary increase during probation'
        ],
        correctIndex: 0,
        explanation: 'Anna mới vào công ty ngày đầu tiên nên nhờ David hướng dẫn đường đến nhà ăn và phòng in ấn.'
      },
      {
        id: 'q_a1_4_2',
        type: 'detail',
        question: 'On which floor is the company lunch cafeteria located?',
        options: [
          'On the second floor',
          'On the fifth floor',
          'In the basement parking garage',
          'On the top roof terrace'
        ],
        correctIndex: 0,
        explanation: 'David hướng dẫn: "Take the main elevator down to the second floor" (Đi thang máy xuống tầng hai).'
      },
      {
        id: 'q_a1_4_3',
        type: 'vocab_context',
        question: 'In the conversation, what does the word "hallway" refer to?',
        options: [
          'A long passage or corridor in a building connecting rooms',
          'A computer software program used for sending emails',
          'A large outdoor parking space for cars',
          'A kitchen oven used for baking hot bread'
        ],
        correctIndex: 0,
        explanation: '"Hallway" là lối đi dài hoặc hành lang nối liền các phòng trong tòa nhà ("a corridor connecting rooms").'
      },
      {
        id: 'q_a1_4_4',
        type: 'detail',
        question: 'Where can Anna find the color printing station?',
        options: [
          'On their current floor, past the water cooler on the right side',
          'On the second floor inside the glass conference room',
          'Across the street at an outside commercial copy shop',
          'Inside the kitchen of the Harmony Dining Hall'
        ],
        correctIndex: 0,
        explanation: 'David nói: "The printing station is right here on our floor. Just walk past the water cooler, and it is on your right side".'
      }
    ]
  }
];
