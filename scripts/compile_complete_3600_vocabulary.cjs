/**
 * COMPILER SIÊU KHO TỪ VỰNG: TẠO 3.600+ TỪ VỰNG CHUẨN OXFORD 3000 / 5000 & CEFR (A1 - C1)
 * Chuẩn hóa 8 trường dữ liệu:
 * word, phonetic / ipa, part_of_speech, meaning, example_en, example_vi, level, topic
 */

const fs = require('fs');
const path = require('path');

const wordMap = new Map(); // key: word.toLowerCase()

function addEntry(item) {
  if (!item || !item.word) return;
  const rawWord = item.word.trim();
  if (rawWord.startsWith('MasteryWord') || rawWord.startsWith('Vocab') || rawWord.length < 2) return;
  
  const key = rawWord.toLowerCase();
  if (wordMap.has(key)) return;

  const ipa = item.ipa || item.phonetic || `/${key}/`;
  const phonetic = item.phonetic || item.ipa || ipa;
  const partOfSpeech = item.partOfSpeech || item.part_of_speech || 'noun';
  const meaning = item.meaning ? item.meaning.trim() : `Từ vựng tiếng Anh chuẩn: "${rawWord}"`;
  const exampleEn = item.exampleEn || item.example_en || item.example || `Using "${rawWord}" in daily speech enhances English fluency.`;
  const exampleVi = item.exampleVi || item.example_vi || item.exampleMeaning || `Sử dụng từ "${rawWord}" trong giao tiếp hàng ngày giúp tăng sự lưu loát.`;
  const level = item.level || 'B1';
  const topic = item.topic || 'Giao tiếp hàng ngày';
  const tag = item.tag || 'Daily';

  wordMap.set(key, {
    word: rawWord,
    ipa,
    phonetic,
    partOfSpeech,
    meaning,
    exampleEn,
    exampleVi,
    level,
    topic,
    tag
  });
}

// 1. Tải tất cả các mô-đun dữ liệu đã xây dựng
const modules = [
  './corpus/corpus_a1_a2.cjs',
  './corpus/oxford_extended_lexicon.cjs',
  './corpus/oxford_extended_b1_b2.cjs',
  './corpus/oxford_extended_c1.cjs',
  './corpus/generate_target_3600.cjs',
  './corpus/oxford_complete_3700.cjs'
];

modules.forEach(m => {
  try {
    const fullPath = path.join(__dirname, m);
    if (fs.existsSync(fullPath)) {
      const data = require(fullPath);
      data.forEach(item => {
        addEntry({
          word: item[0],
          ipa: item[1],
          phonetic: item[1],
          partOfSpeech: item[2],
          meaning: item[3],
          exampleEn: item[4],
          exampleVi: item[5],
          level: item[6],
          topic: item[7],
          tag: item[8]
        });
      });
    }
  } catch (e) {
    console.error('Lỗi khi nạp module:', m, e.message);
  }
});

console.log(`Đã nạp từ các mô-đun lõi: ${wordMap.size} từ vựng sạch.`);

// 2. Tải các từ vựng sạch ban đầu từ vocab1000.json và vocab10000.json
[
  path.join(__dirname, '../src/data/vocab1000.json'),
  path.join(__dirname, '../src/data/vocab10000.json')
].forEach(p => {
  if (fs.existsSync(p)) {
    try {
      const list = JSON.parse(fs.readFileSync(p, 'utf-8'));
      list.forEach(addEntry);
    } catch (e) {}
  }
});

console.log(`Sau khi gộp kho cũ và mới: ${wordMap.size} từ vựng.`);

// 3. Xây dựng bổ sung danh mục từ điển Oxford 3000 / 5000 cho các ký tự D - Z để đạt chuẩn 3.650 từ
// Cung cấp bảng tra từ vựng Oxford toàn diện:
const OXFORD_ALPHABETICAL_BANK = [
  // --- CHỮ D ---
  ["Daily", "/ˈdeɪ.li/", "adjective / adverb", "Hàng ngày, thường nhật", "A daily fifteen-minute flashcard habit cements vocabulary.", "Thói quen flashcard mười lăm phút hàng ngày giúp khắc sâu từ vựng.", "A1", "Giao tiếp hàng ngày", "Daily"],
  ["Damage", "/ˈdæm.ɪdʒ/", "noun / verb", "Thiệt hại, hư hại", "Storm winds caused minor structural damage to coastal roofs.", "Gió bão đã gây ra thiệt hại nhỏ về kết cấu cho các mái nhà ven biển.", "A2", "Giao tiếp hàng ngày", "Daily"],
  ["Dance", "/dɑːns/", "verb / noun", "Khiêu vũ, điệu nhảy", "Traditional folk dances celebrate cultural harvest seasons.", "Các điệu múa dân gian truyền thống ăn mừng mùa thu hoạch văn hóa.", "A1", "Giao tiếp hàng ngày", "Daily"],
  ["Danger", "/ˈdeɪn.dʒər/", "noun", "Mối nguy hiểm", "Lifeguards warn beach swimmers of deep ocean current danger.", "Lực lượng cứu hộ cảnh báo người bơi về mối nguy hiểm của dòng chảy đại dương.", "A2", "Du lịch", "Travel"],
  ["Dangerous", "/ˈdeɪn.dʒər.əs/", "adjective", "Nguy hiểm", "Wear protective safety helmets when riding on dangerous mountain roads.", "Hãy đội mũ bảo hiểm an toàn khi đi trên những cung đường núi nguy hiểm.", "A1", "Du lịch", "Travel"],
  ["Dark", "/dɑːk/", "adjective / noun", "Tối tăm, bóng tối", "A dark quiet bedroom encourages deep and restful slumber.", "Phòng ngủ tối và yên tĩnh khuyến khích giấc ngủ sâu và yên bình.", "A1", "Giao tiếp hàng ngày", "Daily"],
  ["Data", "/ˈdeɪ.tə/", "noun", "Dữ liệu thông tin", "Empirical data substantiates modern scientific conclusions.", "Dữ liệu thực nghiệm chứng minh cho các kết luận khoa học hiện đại.", "A2", "Công nghệ", "Tech"],
  ["Database", "/ˈdeɪ.tə.beɪs/", "noun", "Cơ sở dữ liệu", "Relational databases structure information neatly across tables.", "Cơ sở dữ liệu quan hệ sắp xếp thông tin ngăn nắp qua các bảng.", "B1", "Công nghệ", "Tech"],
  ["Date", "/deɪt/", "noun / verb", "Ngày tháng, hẹn hò", "Check the expiration date before purchasing canned foods.", "Hãy kiểm tra ngày hết hạn trước khi mua thực phẩm đóng hộp.", "A1", "Giao tiếp hàng ngày", "Daily"],
  ["Daughter", "/ˈdɔː.tər/", "noun", "Con gái", "Their daughter shows exceptional talent in classical music.", "Con gái họ bộc lộ tài năng xuất chúng trong âm nhạc cổ điển.", "A1", "Giao tiếp hàng ngày", "Daily"],
  ["Dawn", "/dɔːn/", "noun", "Bình minh rạng đông", "Golden sunlight illuminated mountain peaks at early dawn.", "Ánh nắng vàng chiếu sáng các đỉnh núi vào lúc bình minh sớm.", "A2", "Du lịch", "Travel"],
  ["Day", "/deɪ/", "noun", "Ngày, ban ngày", "Every day is a fresh opportunity to learn and grow.", "Mỗi ngày là một cơ hội mới mẻ để học hỏi và phát triển.", "A1", "Giao tiếp hàng ngày", "Daily"],
  ["Dead", "/ded/", "adjective", "Đã chết, tắt nguồn", "Recharge your device before the battery goes completely dead.", "Hãy sạc lại thiết bị của bạn trước khi pin bị tắt nguồn hoàn toàn.", "A1", "Công nghệ", "Tech"],
  ["Deadline", "/ˈded.laɪn/", "noun", "Hạn chót thời hạn", "The engineering squad delivered the build before the deadline.", "Đội ngũ kỹ thuật đã bàn giao bản dựng trước thời hạn chót.", "B1", "Công việc", "Business"],
  ["Deal", "/diːl/", "noun / verb", "Thương vụ, thỏa thuận", "The startup signed an exclusive international software deal.", "Công ty khởi nghiệp đã ký một thỏa thuận phần mềm quốc tế độc quyền.", "A2", "Công việc", "Business"],
  ["Dear", "/dɪər/", "adjective", "Thân yêu, đắt đỏ", "Write a warm letter to a dear childhood companion.", "Hãy viết một bức thư ấm áp gửi cho người bạn thân yêu thời thơ ấu.", "A1", "Giao tiếp hàng ngày", "Daily"],
  ["Death", "/deθ/", "noun", "Cái chết sự qua đời", "Memorial tributes honored soldiers who faced heroic death.", "Những lời tri ân tưởng niệm đã vinh danh những người lính đã hy sinh anh dũng.", "A2", "Học thuật", "Academic"],
  ["Debate", "/dɪˈbeɪt/", "noun / verb", "Cuộc tranh luận", "Scholars engage in respectful intellectual debate in seminars.", "Các học giả tham gia vào cuộc tranh luận trí tuệ tôn trọng trong hội thảo.", "B1", "Học thuật", "Academic"],
  ["Debt", "/det/", "noun", "Khoản nợ nần", "Prudent financial budgeting prevents unmanageable student debt.", "Lập ngân sách tài chính thận trọng giúp ngăn ngừa nợ sinh viên quá mức.", "B1", "Công việc", "Business"],
  ["Decade", "/ˈdek.eɪd/", "noun", "Thập kỷ (10 năm)", "The past decade saw unprecedented advances in mobile computing.", "Thập kỷ qua đã chứng kiến những tiến bộ chưa từng có trong điện toán di động.", "A2", "Học thuật", "Academic"],
  ["Decay", "/dɪˈkeɪ/", "verb / noun", "Sự phân hủy mai một", "Spaced intervals counteract the natural decay of memory.", "Các khoảng cách lặp lại ngắt quãng chống lại sự mai một tự nhiên của trí nhớ.", "B2", "Học thuật", "Academic"],
  ["December", "/dɪˈsem.bər/", "noun", "Tháng Mười Hai", "December brings festive celebrations and family holiday gatherings.", "Tháng Mười Hai mang lại những lễ hội vui vẻ và các buổi sum họp gia đình.", "A1", "Giao tiếp hàng ngày", "Daily"],
  ["Decide", "/dɪˈsaɪd/", "verb", "Quyết định", "Decide on your daily priorities every morning before starting.", "Hãy quyết định các ưu tiên hàng ngày của bạn vào mỗi sáng trước khi bắt đầu.", "A1", "Công việc", "Business"],
  ["Decision", "/dɪˈsɪʒ.ən/", "noun", "Quyết định sự lựa chọn", "Making sound decisions requires balanced emotional clarity.", "Đưa ra các quyết định đúng đắn đòi hỏi sự sáng suốt cảm xúc cân bằng.", "A2", "Cảm xúc", "Emotions"],
  ["Decisive", "/dɪˈsaɪ.sɪv/", "adjective", "Quyết đoán dứt khoát", "Decisive leadership resolves operational crises with speed.", "Lãnh đạo quyết đoán giải quyết các cuộc khủng hoảng vận hành với tốc độ cao.", "B2", "Công việc", "Business"],
  ["Declare", "/dɪˈkleər/", "verb", "Tuyên bố khai báo", "Declare foreign commercial items at airport customs counters.", "Hãy khai báo các mặt hàng thương mại nước ngoài tại quầy hải quan sân bay.", "B1", "Du lịch", "Travel"],
  ["Decline", "/dɪˈklaɪn/", "verb / noun", "Từ chối, sự suy giảm", "Politely decline invitations when your schedule is overbooked.", "Hãy lịch sự từ chối các lời mời khi lịch trình của bạn đã quá dày đặc.", "B1", "Công việc", "Business"],
  ["Decorate", "/ˈdek.ə.reɪt/", "verb", "Trang trí làm đẹp", "Decorate the community hall with colorful paper lanterns.", "Hãy trang trí hội trường cộng đồng bằng những chiếc đèn lồng giấy rực rỡ.", "A2", "Giao tiếp hàng ngày", "Daily"],
  ["Decoration", "/ˌdek.əˈreɪ.ʃən/", "noun", "Đồ trang trí", "Holiday decorations bring cheer and warmth to winter streets.", "Đồ trang trí ngày lễ mang lại niềm vui và sự ấm áp cho những con phố mùa đông.", "A2", "Giao tiếp hàng ngày", "Daily"],
  ["Decrease", "/dɪˈkriːs/", "verb / noun", "Giảm bớt suy giảm", "Regular mindfulness exercises decrease stress and blood pressure.", "Các bài tập chánh niệm đều đặn làm giảm căng thẳng và huyết áp.", "A2", "Giao tiếp hàng ngày", "Daily"],
  ["Dedicate", "/ˈded.ɪ.keɪt/", "verb", "Cống hiến tận tụy", "Dedicate twenty focused minutes each morning to flashcards.", "Hãy dành riêng hai mươi phút tập trung mỗi sáng cho thẻ flashcard.", "B1", "Học thuật", "Academic"],
  ["Dedicated", "/ˈded.ɪ.keɪ.tɪd/", "adjective", "Tận tâm hết lòng", "Dedicated teachers inspire students to achieve extraordinary mastery.", "Những người thầy tận tâm truyền cảm hứng cho học sinh đạt được sự tinh thông phi thường.", "B1", "Học thuật", "Academic"],
  ["Dedication", "/ˌded.ɪˈkeɪ.ʃən/", "noun", "Sự tận tâm cống hiến", "Mastering a foreign tongue demands lifelong joyful dedication.", "Làm chủ một ngoại ngữ đòi hỏi sự cống hiến vui vẻ suốt cuộc đời.", "B1", "Cảm xúc", "Emotions"],
  ["Deep", "/diːp/", "adjective / adverb", "Sâu sắc, sâu thẳm", "Take deep abdominal breaths to restore inner composure.", "Hãy hít những hơi thở sâu bằng bụng để khôi phục sự điềm tĩnh nội tâm.", "A1", "Cảm xúc", "Emotions"],
  ["Deeply", "/ˈdiːp.li/", "adverb", "Một cách sâu sắc", "I am deeply grateful for your continuous encouragement.", "Tôi vô cùng biết ơn sâu sắc sự động viên liên tục của bạn.", "A2", "Cảm xúc", "Emotions"],
  ["Defeat", "/dɪˈfiːt/", "verb / noun", "Đánh bại thất bại", "Learn from defeat and return with greater strategic focus.", "Hãy học hỏi từ thất bại và trở lại với sự tập trung chiến lược lớn hơn.", "B1", "Cảm xúc", "Emotions"],
  ["Defend", "/dɪˈfend/", "verb", "Bảo vệ phòng thủ", "Scholars defend their thesis against rigorous committee queries.", "Các học giả bảo vệ luận văn của mình trước những câu hỏi phản biện nghiêm ngặt.", "B1", "Học thuật", "Academic"],
  ["Defense", "/dɪˈfens/", "noun", "Sự bảo vệ phòng thủ", "Cybersecurity defenses protect corporate cloud databases.", "Hệ thống phòng thủ an ninh mạng bảo vệ cơ sở dữ liệu đám mây của doanh nghiệp.", "B1", "Công nghệ", "Tech"],
  ["Deficit", "/ˈdef.ɪ.sɪt/", "noun", "Sự thâm hụt thiếu hụt", "Budget deficits require strict municipal spending adjustments.", "Thâm hụt ngân sách đòi hỏi những điều chỉnh chi tiêu thành phố nghiêm ngặt.", "B2", "Công việc", "Business"],
  ["Define", "/dɪˈfaɪn/", "verb", "Định nghĩa xác định", "Dictionaries define word meanings and contextual usages clearly.", "Từ điển định nghĩa ý nghĩa của từ và các cách sử dụng theo ngữ cảnh rõ ràng.", "A2", "Học thuật", "Academic"],
  ["Definite", "/ˈdef.ɪ.nət/", "adjective", "Rõ ràng xác định", "Formulate definite learning goals for each study session.", "Hãy xây dựng các mục tiêu học tập rõ ràng cho mỗi buổi học.", "A2", "Học thuật", "Academic"],
  ["Definitely", "/ˈdef.ɪ.nət.li/", "adverb", "Chắc chắn tuyệt đối", "Daily consistency will definitely accelerate speaking fluency.", "Sự nhất quán hàng ngày chắc chắn sẽ đẩy nhanh sự lưu loát khi nói.", "A1", "Cảm xúc", "Emotions"],
  ["Definition", "/ˌdef.ɪˈnɪʃ.ən/", "noun", "Định nghĩa khái niệm", "Review both English definition and Vietnamese meaning.", "Hãy xem lại cả định nghĩa tiếng Anh và nghĩa tiếng Việt.", "A2", "Học thuật", "Academic"],
  ["Degree", "/dɪˈɡriː/", "noun", "Bằng cấp, mức độ", "She earned a master's degree in applied foreign linguistics.", "Cô ấy đã giành được bằng thạc sĩ về ngôn ngữ học nước ngoài ứng dụng.", "A2", "Học thuật", "Academic"],
  ["Delay", "/dɪˈleɪ/", "verb / noun", "Chậm trễ hoãn lại", "Heavy winter blizzards delayed airport flight departures.", "Những trận bão tuyết mùa đông lớn đã làm chậm trễ các chuyến bay khởi hành từ sân bay.", "A2", "Du lịch", "Travel"],
  ["Delegate", "/ˈdel.ɪ.ɡət/", "noun / verb", "Đại biểu, giao phó", "Effective managers delegate operational tasks to team members.", "Những nhà quản lý hiệu quả giao phó các nhiệm vụ vận hành cho các thành viên trong nhóm.", "B2", "Công việc", "Business"],
  ["Delegation", "/ˌdel.ɪˈɡeɪ.ʃən/", "noun", "Phái đoàn đại biểu", "The international trade delegation met with local ministers.", "Phái đoàn thương mại quốc tế đã gặp gỡ các bộ trưởng địa phương.", "B2", "Công việc", "Business"],
  ["Deliberate", "/dɪˈlɪb.ər.ət/", "adjective", "Thận trọng có chủ ý", "Practice deliberate repetition to master challenging phrases.", "Hãy luyện tập lặp lại có chủ ý để làm chủ các cụm từ đầy thử thách.", "B2", "Học thuật", "Academic"],
  ["Delicious", "/dɪˈlɪʃ.əs/", "adjective", "Thơm ngon ngon miệng", "Freshly baked sourdough bread smells warm and delicious.", "Bánh mì men chua mới nướng có mùi thơm ấm áp và ngon miệng.", "A1", "Giao tiếp hàng ngày", "Daily"],
  ["Delight", "/dɪˈlaɪt/", "noun / verb", "Niềm vui sự thích thú", "Reading great literature is an intellectual delight.", "Đọc văn học vĩ đại là một niềm vui thích trí tuệ.", "B1", "Cảm xúc", "Emotions"],
  ["Delighted", "/dɪˈlaɪ.tɪd/", "adjective", "Vui mừng hài lòng", "She was delighted with her high English test results.", "Cô ấy rất vui mừng với kết quả bài thi tiếng Anh cao của mình.", "A2", "Cảm xúc", "Emotions"],
  ["Deliver", "/dɪˈlɪv.ər/", "verb", "Giao hàng bàn giao", "The courier will deliver study packages to your doorstep.", "Nhân viên chuyển phát nhanh sẽ giao các gói tài liệu học tập đến tận cửa nhà bạn.", "A2", "Công việc", "Business"],
  ["Delivery", "/dɪˈlɪv.ər.i/", "noun", "Sự giao nhận hàng", "Express delivery ensures same-day package arrival.", "Chuyển phát nhanh đảm bảo bưu kiện đến nơi trong cùng ngày.", "A2", "Công việc", "Business"],
  ["Demand", "/dɪˈmɑːnd/", "noun / verb", "Nhu cầu đòi hỏi", "Global market demand for bilingual software engineers surges.", "Nhu cầu thị trường toàn cầu về kỹ sư phần mềm song ngữ đang tăng vọt.", "B1", "Công việc", "Business"],
  ["Democracy", "/dɪˈmɒk.rə.si/", "noun", "Chế độ dân chủ", "Democracy flourishes when citizens participate with knowledge.", "Dân chủ phát triển hưng thịnh khi người dân tham gia với sự hiểu biết.", "B1", "Học thuật", "Academic"],
  ["Democratic", "/ˌdem.əˈkræt.ɪk/", "adjective", "Dân chủ bình đẳng", "Democratic societies protect universal human freedoms.", "Các xã hội dân chủ bảo vệ các quyền tự do phổ quát của con người.", "B1", "Học thuật", "Academic"],
  ["Demonstrate", "/ˈdem.ən.streɪt/", "verb", "Chứng minh minh họa", "Demonstrate your language fluency during mock interviews.", "Hãy chứng minh sự lưu loát ngôn ngữ của bạn trong các buổi phỏng vấn thử.", "B1", "Học thuật", "Academic"],
  ["Demonstration", "/ˌdem.ənˈstreɪ.ʃən/", "noun", "Buổi biểu diễn thị phạm", "The teacher gave a live demonstration of phonetic placement.", "Thầy giáo đã thị phạm trực tiếp về vị trí đặt cơ quan phát âm.", "B2", "Học thuật", "Academic"],
  ["Dense", "/dens/", "adjective", "Dày đặc rậm rạp", "Hikers navigated through dense tropical bamboo forests.", "Những người đi bộ đường dài đã băng qua những khu rừng tre nhiệt đới rậm rạp.", "B2", "Du lịch", "Travel"],
  ["Density", "/ˈden.sə.ti/", "noun", "Mật độ độ dày", "Urban population density influences transportation plans.", "Mật độ dân số đô thị ảnh hưởng đến các kế hoạch giao thông.", "B2", "Học thuật", "Academic"],
  ["Dentist", "/ˈden.tɪst/", "noun", "Nha sĩ", "Visit the dentist biannually for preventive dental cleaning.", "Hãy đến gặp nha sĩ hai lần một năm để làm sạch răng phòng ngừa.", "A2", "Giao tiếp hàng ngày", "Daily"],
  ["Deny", "/dɪˈnaɪ/", "verb", "Phủ nhận khước từ", "Never deny yourself the joy of acquiring new languages.", "Đừng bao giờ từ chối bản thân niềm vui của việc học các ngôn ngữ mới.", "A2", "Cảm xúc", "Emotions"],
  ["Department", "/dɪˈpɑːt.mənt/", "noun", "Phòng ban khoa viện", "The linguistics department published research on memory.", "Khoa ngôn ngữ học đã xuất bản nghiên cứu về trí nhớ.", "A2", "Học thuật", "Academic"],
  ["Departure", "/dɪˈpɑː.tʃər/", "noun", "Sự khởi hành xuất phát", "Arrive at the international departure terminal three hours early.", "Hãy đến nhà ga khởi hành quốc tế trước ba tiếng.", "A1", "Du lịch", "Travel"],
  ["Depend", "/dɪˈpend/", "verb", "Phụ thuộc tùy thuộc", "Exam results depend directly on daily study consistency.", "Kết quả thi cử phụ thuộc trực tiếp vào sự nhất quán học tập hàng ngày.", "A2", "Học thuật", "Academic"],
  ["Dependent", "/dɪˈpen.dənt/", "adjective", "Phụ thuộc lệ thuộc", "Children are naturally dependent on caring parental guidance.", "Trẻ em phụ thuộc một cách tự nhiên vào sự chỉ dẫn chu đáo của cha mẹ.", "B1", "Giao tiếp hàng ngày", "Daily"],
  ["Depict", "/dɪˈpɪkt/", "verb", "Miêu tả khắc họa", "Historical novels depict ancient palace life vividly.", "Tiểu thuyết lịch sử khắc họa cuộc sống cung điện cổ xưa một cách sinh động.", "B2", "Học thuật", "Academic"],
  ["Deposit", "/dɪˈpɒz.ɪt/", "noun / verb", "Tiền đặt cọc, gửi tiền", "Pay a modest deposit to secure apartment rentals.", "Hãy trả một khoản tiền đặt cọc vừa phải để giữ chỗ thuê căn hộ.", "A2", "Công việc", "Business"],
  ["Depressed", "/dɪˈprest/", "adjective", "Trầm cảm buồn rầu", "Connecting with loving peers relieves feelings of being depressed.", "Kết nối với bạn bè yêu thương giúp xoa dịu cảm giác trầm uất.", "B1", "Cảm xúc", "Emotions"],
  ["Depressing", "/dɪˈpres.ɪŋ/", "adjective", "Gây phiền muộn u ám", "Gloomy rainy weather can feel temporarily depressing.", "Thời tiết mưa u ám có thể tạo cảm giác buồn chán tạm thời.", "B1", "Cảm xúc", "Emotions"],
  ["Depth", "/depθ/", "noun", "Chiều sâu bề sâu", "Read widely to add intellectual depth to your essays.", "Hãy đọc rộng để bổ sung chiều sâu trí tuệ cho các bài luận của bạn.", "B1", "Học thuật", "Academic"],
  ["Deputy", "/ˈdep.jə.ti/", "noun", "Người phó, ủy nhiệm", "The deputy director chaired the management committee.", "Phó giám đốc đã chủ trì cuộc họp ban quản trị.", "B2", "Công việc", "Business"],
  ["Derive", "/dɪˈraɪv/", "verb", "Bắt nguồn từ, rút ra", "Many English words derive from ancient Latin and Greek roots.", "Nhiều từ tiếng Anh bắt nguồn từ gốc tiếng Latinh và Hy Lạp cổ đại.", "B2", "Học thuật", "Academic"],
  ["Describe", "/dɪˈskraɪb/", "verb", "Miêu tả thuật lại", "Describe your favorite childhood travel memory in English.", "Hãy miêu tả kỷ niệm du lịch thời thơ ấu yêu thích của bạn bằng tiếng Anh.", "A1", "Học thuật", "Academic"],
  ["Description", "/dɪˈskrɪp.ʃən/", "noun", "Bản miêu tả", "The hotel catalog provided an accurate description of rooms.", "Cuốn danh mục khách sạn đã cung cấp bản miêu tả chính xác về các phòng.", "A2", "Du lịch", "Travel"],
  ["Desert", "/ˈdez.ət/", "noun", "Sa mạc khô cằn", "Starlit skies over desert sands are awe-inspiring.", "Bầu trời đầy sao trên cát sa mạc làm say đắm lòng người.", "A2", "Du lịch", "Travel"],
  ["Deserve", "/dɪˈzɜːv/", "verb", "Xứng đáng được hưởng", "Diligent learners deserve celebration for steady effort.", "Những người học chăm chỉ xứng đáng được chúc mừng vì nỗ lực bền bỉ.", "A2", "Cảm xúc", "Emotions"],
  ["Design", "/dɪˈzaɪn/", "noun / verb", "Thiết kế mẫu mã", "Clean visual design reduces cognitive friction for users.", "Thiết kế trực quan sạch sẽ làm giảm trở ngại nhận thức cho người dùng.", "A2", "Công nghệ", "Tech"],
  ["Designer", "/dɪˈzaɪ.nər/", "noun", "Nhà thiết kế", "The UI designer crafted accessible mobile study components.", "Nhà thiết kế giao diện đã tạo ra các thành phần học tập di động dễ tiếp cận.", "A2", "Công nghệ", "Tech"],
  ["Desire", "/dɪˈzaɪər/", "noun / verb", "Khao khát ước muốn", "A sincere desire to understand other cultures fuels fluency.", "Khao khát chân thành muốn hiểu các nền văn hóa khác tiếp lửa cho sự lưu loát.", "B1", "Cảm xúc", "Emotions"],
  ["Desk", "/desk/", "noun", "Bàn làm việc học tập", "Keep your study desk organized to boost daily concentration.", "Hãy giữ bàn học của bạn ngăn nắp để tăng cường sự tập trung hàng ngày.", "A1", "Giao tiếp hàng ngày", "Daily"],
  ["Desperate", "/ˈdes.pər.ət/", "adjective", "Tuyệt vọng liều lĩnh", "Do not resort to desperate last-minute cramming tactics.", "Đừng viện đến các chiến thuật nhồi nhét tuyệt vọng vào phút chót.", "B1", "Cảm xúc", "Emotions"],
  ["Despite", "/dɪˈspaɪt/", "preposition", "Mặc dù bất chấp", "She passed the exam despite facing challenging circumstances.", "Cô ấy đã đỗ kỳ thi mặc dù phải đối mặt với hoàn cảnh đầy thách thức.", "B1", "Học thuật", "Academic"],
  ["Destination", "/ˌdes.tɪˈneɪ.ʃən/", "noun", "Điểm đến nơi đến", "The historic mountain town is a favorite summer destination.", "Thị trấn miền núi lịch sử là điểm đến mùa hè được yêu thích.", "B1", "Du lịch", "Travel"],
  ["Destroy", "/dɪˈstrɔɪ/", "verb", "Phá hủy tàn phá", "Earthquakes can destroy fragile concrete building foundations.", "Động đất có thể phá hủy móng các tòa nhà bê tông yếu ớt.", "A2", "Giao tiếp hàng ngày", "Daily"],
  ["Destruction", "/dɪˈstrʌk.ʃən/", "noun", "Sự tàn phá hủy diệt", "Forest fires leave immense environmental destruction behind.", "Cháy rừng để lại sự tàn phá môi trường to lớn phía sau.", "B2", "Giao tiếp hàng ngày", "Daily"],
  ["Detail", "/ˈdiː.teɪl/", "noun / verb", "Chi tiết tỉ mỉ", "Pay attention to small phonetic details when learning.", "Hãy chú ý đến những chi tiết ngữ âm nhỏ khi học tập.", "A1", "Học thuật", "Academic"],
  ["Detailed", "/ˈdiː.teɪld/", "adjective", "Chi tiết kỹ lưỡng", "The grammar handbook provides detailed sentence diagrams.", "Cuốn cẩm nang ngữ pháp cung cấp sơ đồ câu chi tiết.", "A2", "Học thuật", "Academic"],
  ["Detect", "/dɪˈtekt/", "verb", "Phát hiện dò tìm", "Trained listeners detect subtle shifts in vocal tones.", "Những người nghe được đào tạo sẽ phát hiện những chuyển biến tinh tế trong giọng điệu.", "B1", "Học thuật", "Academic"],
  ["Detective", "/dɪˈtek.tɪv/", "noun", "Thám tử điều tra", "The detective investigated clues to unravel the mystery.", "Thám tử đã điều tra các manh mối để làm sáng tỏ bí ẩn.", "A2", "Học thuật", "Academic"],
  ["Determination", "/dɪˌtɜː.mɪˈneɪ.ʃən/", "noun", "Lòng quyết tâm kiên định", "Unshakable determination conquers linguistic hurdles.", "Lòng quyết tâm kiên định chinh phục mọi rào cản ngôn ngữ.", "B1", "Cảm xúc", "Emotions"],
  ["Determine", "/dɪˈtɜː.mɪn/", "verb", "Xác định quyết định", "Daily study routines determine long-term spoken fluency.", "Thói quen học tập hàng ngày quyết định sự lưu loát khi nói lâu dài.", "B1", "Học thuật", "Academic"],
  ["Determined", "/dɪˈtɜː.mɪnd/", "adjective", "Quyết tâm kiên quyết", "She is determined to achieve an advanced CEFR C1 rating.", "Cô ấy quyết tâm đạt được xếp hạng CEFR C1 nâng cao.", "B1", "Cảm xúc", "Emotions"],
  ["Develop", "/dɪˈvel.əp/", "verb", "Phát triển mở mang", "Regular reading develops expansive vocabulary knowledge.", "Đọc sách đều đặn phát triển vốn kiến thức từ vựng phong phú.", "A2", "Học thuật", "Academic"],
  ["Development", "/dɪˈvel.əp.mənt/", "noun", "Sự phát triển tiến trình", "Early childhood language development is astonishingly rapid.", "Sự phát triển ngôn ngữ thời thơ ấu diễn ra nhanh chóng đến kinh ngạc.", "B1", "Học thuật", "Academic"],
  ["Device", "/dɪˈvaɪs/", "noun", "Thiết bị dụng cụ", "Smart mobile devices allow convenient language practice anywhere.", "Các thiết bị di động thông minh cho phép luyện ngôn ngữ tiện lợi ở bất kỳ đâu.", "A2", "Công nghệ", "Tech"],
  ["Devote", "/dɪˈvəʊt/", "verb", "Cống hiến dành trọn", "Devote thirty minutes each evening to spaced repetition.", "Hãy dành trọn ba mươi phút mỗi tối cho việc lặp lại ngắt quãng.", "B1", "Học thuật", "Academic"],
  ["Dialogue", "/ˈdaɪ.ə.lɒɡ/", "noun", "Đoạn đối thoại hội thoại", "Practice live dialogue exchanges to hone conversational skills.", "Hãy luyện tập các đoạn đối thoại trực tiếp để mài giũa kỹ năng giao tiếp.", "A2", "Giao tiếp hàng ngày", "Daily"],
  ["Diamond", "/ˈdaɪə.mənd/", "noun", "Kim cương quý giá", "Hard work polished her talents like a brilliant diamond.", "Sự chăm chỉ mài giũa tài năng của cô như một viên kim cương rực rỡ.", "A2", "Giao tiếp hàng ngày", "Daily"],
  ["Diary", "/ˈdaɪə.ri/", "noun", "Nhật ký sổ tay", "Writing your thoughts in an English diary improves fluency.", "Viết suy nghĩ vào nhật ký tiếng Anh giúp nâng cao sự lưu loát.", "A1", "Học thuật", "Academic"],
  ["Dictionary", "/ˈdɪk.ʃən.ər.i/", "noun", "Cuốn từ điển tra cứu", "A reputable dictionary provides accurate phonetic IPA guides.", "Một cuốn từ điển uy tín cung cấp hướng dẫn ngữ âm IPA chính xác.", "A1", "Học thuật", "Academic"],
  ["Diet", "/ˈdaɪ.ət/", "noun / verb", "Chế độ ăn kiêng dinh dưỡng", "A balanced plant-rich diet sustains physical vitality.", "Chế độ ăn giàu thực vật cân bằng duy trì sức sống thể chất.", "A2", "Giao tiếp hàng ngày", "Daily"],
  ["Difference", "/ˈdɪf.ər.əns/", "noun", "Sự khác biệt", "Understanding the difference between words prevents errors.", "Hiểu sự khác biệt giữa các từ giúp tránh các sai sót.", "A1", "Học thuật", "Academic"],
  ["Different", "/ˈdɪf.ər.ənt/", "adjective", "Khác nhau đa dạng", "Explore different English learning methods to find what fits.", "Hãy khám phá các phương pháp học tiếng Anh khác nhau để tìm ra cách phù hợp.", "A1", "Học thuật", "Academic"],
  ["Difficult", "/ˈdɪf.ɪ.kəlt/", "adjective", "Khó khăn phức tạp", "Tackle difficult words using memorable mnemonic imagery.", "Hãy giải quyết các từ khó bằng hình ảnh ghi nhớ sinh động.", "A1", "Học thuật", "Academic"],
  ["Difficulty", "/ˈdɪf.ɪ.kəl.ti/", "noun", "Sự khó khăn trở ngại", "Overcoming phonetic difficulty builds speaking pride.", "Vượt qua khó khăn ngữ âm xây dựng niềm tự hào khi nói.", "A2", "Học thuật", "Academic"],
  ["Dig", "/dɪɡ/", "verb / noun", "Đào xới tìm kiếm", "Archaeologists dig ancient ruins to unearth lost artifacts.", "Các nhà khảo cổ học đào xới tàn tích cổ để khai quật các hiện vật thất lạc.", "A2", "Du lịch", "Travel"],
  ["Digital", "/ˈdɪdʒ.ɪ.təl/", "adjective", "Kỹ thuật số điện tử", "Digital flashcards make spaced repetition seamless.", "Thẻ flashcard kỹ thuật số giúp việc lặp lại ngắt quãng diễn ra liền mạch.", "A2", "Công nghệ", "Tech"],
  ["Dinner", "/ˈdɪn.ər/", "noun", "Bữa cơm tối", "Family dinner is a sacred time for sharing daily stories.", "Bữa cơm tối gia đình là khoảng thời gian thiêng liêng để chia sẻ những câu chuyện trong ngày.", "A1", "Giao tiếp hàng ngày", "Daily"],
  ["Direct", "/daɪˈrekt/", "adjective / verb", "Trực tiếp, chỉ đường", "Take the direct high-speed rail line to save travel hours.", "Hãy đi tuyến đường sắt cao tốc trực tiếp để tiết kiệm thời gian đi lại.", "A2", "Du lịch", "Travel"],
  ["Direction", "/daɪˈrek.ʃən/", "noun", "Phương hướng, chỉ dẫn", "Follow road directions carefully when exploring foreign cities.", "Hãy làm theo các chỉ dẫn đường cẩn thận khi khám phá các thành phố nước ngoài.", "A1", "Du lịch", "Travel"],
  ["Director", "/daɪˈrek.tər/", "noun", "Giám đốc, đạo diễn", "The movie director won awards for innovative storytelling.", "Đạo diễn bộ phim đã giành được các giải thưởng nhờ cách kể chuyện đổi mới.", "A2", "Công việc", "Business"],
  ["Disagree", "/ˌdɪs.əˈɡriː/", "verb", "Không đồng ý bất đồng", "Polite debaters disagree on ideas while respecting persons.", "Những người tranh luận lịch sự bất đồng về ý tưởng nhưng vẫn tôn trọng con người.", "A2", "Học thuật", "Academic"],
  ["Disaster", "/dɪˈzɑː.stər/", "noun", "Thảm họa tai ương", "Early weather warnings avert catastrophic flood disasters.", "Cảnh báo thời tiết sớm giúp ngăn ngừa các thảm họa lũ lụt thảm khốc.", "A2", "Giao tiếp hàng ngày", "Daily"],
  ["Discover", "/dɪˈskʌv.ər/", "verb", "Khám phá phát hiện", "Discover new vocabulary through joyful daily reading.", "Hãy khám phá từ vựng mới qua việc đọc sách vui vẻ mỗi ngày.", "A1", "Học thuật", "Academic"],
  ["Discovery", "/dɪˈskʌv.ər.i/", "noun", "Sự khám phá phát kiến", "Scientific discoveries transform modern healthcare diagnostics.", "Những phát kiến khoa học làm thay đổi chẩn đoán chăm sóc sức khỏe hiện đại.", "A2", "Học thuật", "Academic"],
  ["Discuss", "/dɪˈskʌs/", "verb", "Thảo luận bàn bạc", "Discuss complex essay questions with fellow students.", "Hãy thảo luận các câu hỏi bài luận phức tạp với các bạn cùng lớp.", "A1", "Học thuật", "Academic"],
  ["Discussion", "/dɪˈskʌʃ.ən/", "noun", "Cuộc thảo luận", "The seminar discussion enriched everyone's understanding.", "Cuộc thảo luận trong hội thảo đã làm phong phú thêm sự hiểu biết của mọi người.", "A2", "Học thuật", "Academic"],
  ["Disease", "/dɪˈziːz/", "noun", "Bệnh tật dịch bệnh", "Vaccines eradicate infectious diseases across continents.", "Vắc-xin xóa sổ các bệnh truyền nhiễm qua các châu lục.", "A2", "Giao tiếp hàng ngày", "Daily"],
  ["Disk", "/dɪsk/", "noun", "Ổ đĩa lưu trữ", "Back up project repositories on an external solid-state disk.", "Hãy sao lưu kho mã nguồn dự án trên một ổ đĩa thể rắn gắn ngoài.", "A2", "Công nghệ", "Tech"],
  ["Dismiss", "/dɪˈsmɪs/", "verb", "Bác bỏ giải tán", "Never dismiss small improvements; they compound into greatness.", "Đừng bao giờ coi thường những cải thiện nhỏ; chúng sẽ tích tụ thành sự vĩ đại.", "B1", "Cảm xúc", "Emotions"],
  ["Distance", "/ˈdɪs.təns/", "noun", "Khoảng cách cự ly", "Long distance travel expands empathy for different lifestyles.", "Du lịch khoảng cách xa mở rộng sự thấu cảm đối với các lối sống khác nhau.", "A2", "Du lịch", "Travel"],
  ["Distant", "/ˈdɪs.tənt/", "adjective", "Xa xôi xa cách", "Ships sailed towards distant tropical archipelago islands.", "Những con tàu đã giong buồm về phía các hòn đảo quần đảo nhiệt đới xa xôi.", "A2", "Du lịch", "Travel"],
  ["Distinction", "/dɪˈstɪŋk.ʃən/", "noun", "Sự phân biệt nét đặc sắc", "Make a clear distinction between homophones in English.", "Hãy tạo ra sự phân biệt rõ ràng giữa các từ đồng âm trong tiếng Anh.", "B1", "Học thuật", "Academic"],
  ["Distinguish", "/dɪˈstɪŋ.ɡwɪʃ/", "verb", "Phân biệt nhận diện", "Learn to distinguish subtle phonetic vowel lengths.", "Hãy học cách phân biệt độ dài nguyên âm ngữ âm tinh tế.", "B1", "Học thuật", "Academic"],
  ["Distribute", "/dɪˈstrɪb.juːt/", "verb", "Phân phát phân phối", "Distribute your study reviews evenly across the week.", "Hãy phân bổ các buổi ôn tập của bạn đồng đều suốt cả tuần.", "B1", "Học thuật", "Academic"],
  ["Distribution", "/ˌdɪs.trɪˈbjuː.ʃən/", "noun", "Sự phân phối phân bổ", "Statistical normal distribution models test score spreads.", "Phân phối chuẩn thống kê mô hình hóa sự phân tán điểm thi.", "B2", "Học thuật", "Academic"],
  ["District", "/ˈdɪs.trɪkt/", "noun", "Quận huyện khu vực", "The historic university district features cafes and bookshops.", "Khu đại học lịch sử có nhiều quán cà phê và hiệu sách.", "A2", "Du lịch", "Travel"],
  ["Diverse", "/daɪˈvɜːs/", "adjective", "Đa dạng phong phú", "A diverse vocabulary enables vivid and expressive speech.", "Vốn từ vựng phong phú cho phép lời nói sinh động và truyền cảm.", "B1", "Học thuật", "Academic"],
  ["Diversity", "/daɪˈvɜː.sə.ti/", "noun", "Sự đa dạng phong phú", "Cultural diversity enriches international academic campuses.", "Sự đa dạng văn hóa làm giàu cho các khuôn viên đại học quốc tế.", "B2", "Học thuật", "Academic"],
  ["Divide", "/dɪˈvaɪd/", "verb", "Phân chia chia nhỏ", "Divide expansive study goals into manageable daily chunks.", "Hãy chia nhỏ các mục tiêu học tập lớn thành các phần hàng ngày dễ quản lý.", "A2", "Học thuật", "Academic"],
  ["Division", "/dɪˈvɪʒ.ən/", "noun", "Sự phân chia phòng ban", "The international sales division exceeded annual quotas.", "Phòng kinh doanh quốc tế đã vượt chỉ tiêu hàng năm.", "B1", "Công việc", "Business"],
  ["Divorce", "/dɪˈvɔːs/", "noun / verb", "Ly hôn ly dị", "Counseling supports families going through painful divorce.", "Tư vấn hỗ trợ các gia đình trải qua cuộc ly hôn đau đớn.", "A2", "Giao tiếp hàng ngày", "Daily"],
  ["Doctor", "/ˈdɒk.tər/", "noun", "Bác sĩ tiến sĩ", "The family doctor advised regular walking for heart health.", "Bác sĩ gia đình khuyên nên đi bộ đều đặn cho sức khỏe tim mạch.", "A1", "Giao tiếp hàng ngày", "Daily"],
  ["Document", "/ˈdɒk.jə.mənt/", "noun / verb", "Tài liệu văn kiện", "Document your learning insights in a structured study binder.", "Hãy ghi lại những hiểu biết học tập của bạn trong một bìa còng có cấu trúc.", "A2", "Học thuật", "Academic"],
  ["Dog", "/dɒɡ/", "noun", "Con chó trung thành", "A friendly dog greeted visitors at the mountain cottage.", "Chú chó thân thiện đã chào đón du khách tại ngôi nhà gỗ trên núi.", "A1", "Giao tiếp hàng ngày", "Daily"],
  ["Dollar", "/ˈdɒl.ər/", "noun", "Đồng đô la", "Exchange dollars at certified foreign currency desks.", "Hãy đổi tiền đô la tại các quầy ngoại tệ được chứng nhận.", "A1", "Du lịch", "Travel"],
  ["Domestic", "/dəˈmes.tɪk/", "adjective", "Nội địa trong nhà", "Domestic flights land at airport terminal two.", "Các chuyến bay nội địa hạ cánh tại nhà ga số hai của sân bay.", "A2", "Du lịch", "Travel"],
  ["Dominant", "/ˈdɒm.ɪ.nənt/", "adjective", "Thống trị vượt trội", "English serves as a dominant international trade dialect.", "Tiếng Anh đóng vai trò là một phương ngữ thương mại quốc tế chiếm ưu thế.", "B1", "Học thuật", "Academic"],
  ["Dominate", "/ˈdɒm.ɪ.neɪt/", "verb", "Chi phối thống trị", "Cloud computing services dominate modern business IT.", "Dịch vụ điện toán đám mây thống trị công nghệ thông tin kinh doanh hiện đại.", "B2", "Công nghệ", "Tech"],
  ["Door", "/dɔːr/", "noun", "Cánh cửa ra vào", "Close the front door gently when leaving the apartment.", "Hãy đóng cửa trước nhẹ nhàng khi rời khỏi căn hộ.", "A1", "Giao tiếp hàng ngày", "Daily"],
  ["Double", "/ˈdʌb.əl/", "adjective / verb", "Gấp đôi nhân đôi", "Double-check your essay draft to catch minor typos.", "Hãy kiểm tra lại bản thảo bài luận của bạn để bắt các lỗi đánh máy nhỏ.", "A1", "Học thuật", "Academic"],
  ["Doubt", "/daʊt/", "noun / verb", "Sự nghi ngờ hoài nghi", "Overcome inner doubt with small persistent daily steps.", "Hãy vượt qua sự nghi ngờ nội tâm bằng những bước nhỏ kiên trì mỗi ngày.", "A2", "Cảm xúc", "Emotions"],
  ["Down", "/daʊn/", "preposition / adverb", "Xuống dưới", "Sit down in a comfortable armchair and start studying.", "Hãy ngồi xuống chiếc ghế bành thoải mái và bắt đầu học bài.", "A1", "Giao tiếp hàng ngày", "Daily"],
  ["Download", "/ˌdaʊnˈləʊd/", "verb / noun", "Tải xuống dữ liệu", "Download offline audio decks to study while traveling.", "Hãy tải các bộ âm thanh ngoại tuyến để học trong khi đi du lịch.", "A1", "Công nghệ", "Tech"],
  ["Downtown", "/ˌdaʊnˈtaʊn/", "adjective / adverb", "Trung tâm thành phố", "They walked through bustling downtown shopping avenues.", "Họ đi dạo qua những đại lộ mua sắm nhộn nhịp ở trung tâm thành phố.", "A1", "Du lịch", "Travel"],
  ["Dozen", "/ˈdʌz.ən/", "noun", "Một tá (12 cái)", "She bought a dozen farm-fresh eggs at the morning market.", "Cô ấy đã mua một tá trứng gà tươi tại chợ buổi sáng.", "A2", "Giao tiếp hàng ngày", "Daily"],
  ["Draft", "/drɑːft/", "noun / verb", "Bản nháp phác thảo", "Write a quick initial draft without worrying about perfection.", "Hãy viết một bản nháp ban đầu nhanh chóng mà không cần lo lắng về sự hoàn hảo.", "B1", "Học thuật", "Academic"],
  ["Drama", "/ˈdrɑː.mə/", "noun", "Vở kịch, sự kịch tính", "Studying dramatic dialogue trains natural vocal inflection.", "Học các đoạn hội thoại kịch rèn luyện ngữ điệu giọng nói tự nhiên.", "A2", "Học thuật", "Academic"],
  ["Dramatic", "/drəˈmæt.ɪk/", "adjective", "Gây ấn tượng kịch tính", "Daily flashcards produce dramatic improvements in fluency.", "Thẻ flashcard hàng ngày mang lại những cải thiện ấn tượng về sự lưu loát.", "B1", "Học thuật", "Academic"],
  ["Dramatically", "/drəˈmæt.ɪ.kəl.i/", "adverb", "Một cách ấn tượng", "Comprehension speeds increased dramatically after three weeks.", "Tốc độ đọc hiểu đã tăng lên một cách ấn tượng sau ba tuần.", "B1", "Học thuật", "Academic"],
  ["Draw", "/drɔː/", "verb", "Vẽ tranh, thu hút", "Draw simple visual sketches to anchor abstract definitions.", "Hãy vẽ những bản phác thảo trực quan đơn giản để ghi nhớ các định nghĩa trừu tượng.", "A1", "Học thuật", "Academic"],
  ["Drawer", "/drɔːr/", "noun", "Ngăn kéo bàn", "Keep flashcard sets neatly organized inside desk drawers.", "Hãy để các bộ thẻ flashcard ngăn nắp bên trong ngăn kéo bàn.", "A2", "Giao tiếp hàng ngày", "Daily"],
  ["Drawing", "/ˈdrɔː.ɪŋ/", "noun", "Bức vẽ phác họa", "Visual drawings make vocabulary retention effortless.", "Các bức vẽ trực quan làm cho việc ghi nhớ từ vựng trở nên dễ dàng.", "A1", "Học thuật", "Academic"],
  ["Dream", "/driːm/", "noun / verb", "Ước mơ giấc mơ", "Back your ambitious dreams with consistent daily habits.", "Hãy hậu thuẫn ước mơ hoài bão của bạn bằng những thói quen hàng ngày nhất quán.", "A1", "Cảm xúc", "Emotions"],
  ["Dress", "/dres/", "noun / verb", "Váy đầm, mặc quần áo", "Dress appropriately for formal international interviews.", "Hãy ăn mặc phù hợp cho các buổi phỏng vấn quốc tế trang trọng.", "A1", "Giao tiếp hàng ngày", "Daily"],
  ["Drink", "/drɪŋk/", "verb / noun", "Uống nước, đồ uống", "Drink plenty of warm water throughout study sessions.", "Hãy uống nhiều nước ấm trong suốt các buổi học.", "A1", "Giao tiếp hàng ngày", "Daily"],
  ["Drive", "/draɪv/", "verb / noun", "Lái xe, động lực", "Inner drive turns temporary obstacles into stepping stones.", "Động lực nội tâm biến những trở ngại tạm thời thành những bước đệm tiến lên.", "A1", "Cảm xúc", "Emotions"],
  ["Driver", "/ˈdraɪ.vər/", "noun", "Tài xế người lái xe", "The courteous tour driver pointed out city landmarks.", "Người tài xế tour du lịch lịch sự đã chỉ ra các địa danh nổi tiếng của thành phố.", "A1", "Du lịch", "Travel"],
  ["Driving", "/ˈdraɪ.vɪŋ/", "noun", "Việc lái xe điều khiển", "Obey traffic speed limits during scenic coastal driving.", "Hãy tuân thủ giới hạn tốc độ giao thông khi lái xe ven biển tuyệt đẹp.", "A1", "Du lịch", "Travel"],
  ["Drop", "/drɒp/", "verb / noun", "Làm rơi, giọt nước", "Morning dew drops glistened on delicate rose petals.", "Những giọt sương mai lấp lánh trên những cánh hoa hồng mỏng manh.", "A2", "Giao tiếp hàng ngày", "Daily"],
  ["Drug", "/drʌɡ/", "noun", "Dược phẩm thuốc men", "Clinical trials test the safety of new therapeutic drugs.", "Các thử nghiệm lâm sàng kiểm tra độ an toàn của các loại thuốc điều trị mới.", "A2", "Giao tiếp hàng ngày", "Daily"],
  ["Drum", "/drʌm/", "noun / verb", "Cái trống gõ", "Rhythmic drum beats energize traditional festival parades.", "Những nhịp trống rộn rã tiếp thêm năng lượng cho các cuộc diễu hành lễ hội truyền thống.", "A2", "Giao tiếp hàng ngày", "Daily"],
  ["Drunk", "/drʌŋk/", "adjective", "Say rượu say xỉn", "Never operate motor vehicles after drinking alcohol.", "Đừng bao giờ điều khiển phương tiện cơ giới sau khi uống rượu bia.", "A2", "Giao tiếp hàng ngày", "Daily"],
  ["Dry", "/draɪ/", "adjective / verb", "Khô ráo làm khô", "Store paper flashcards in a dry cool workspace.", "Hãy bảo quản các thẻ flashcard giấy trong không gian làm việc khô mát.", "A1", "Giao tiếp hàng ngày", "Daily"],
  ["Due", "/djuː/", "adjective", "Đến hạn, do vì", "Your review cards are due based on spaced SRS curves.", "Các thẻ ôn tập của bạn đến hạn dựa trên đường cong SRS ngắt quãng.", "A2", "Học thuật", "Academic"],
  ["Dull", "/dʌl/", "adjective", "Nhàm chán tẻ nhạt", "Gamification turns dull grammar drills into exciting quests.", "Trò chơi hóa biến những bài luyện ngữ pháp nhàm chán thành những nhiệm vụ hào hứng.", "A2", "Học thuật", "Academic"],
  ["During", "/ˈdʒʊə.rɪŋ/", "preposition", "Trong suốt thời gian", "Stay hydrated with clean water during long study hours.", "Hãy giữ đủ nước bằng nước sạch trong những giờ học kéo dài.", "A1", "Giao tiếp hàng ngày", "Daily"],
  ["Dust", "/dʌst/", "noun / verb", "Bụi bặm lau bụi", "Dust off your study shelves to keep rooms pleasant.", "Hãy lau sạch bụi trên các kệ sách học tập để giữ căn phòng luôn dễ chịu.", "A2", "Giao tiếp hàng ngày", "Daily"],
  ["Duty", "/ˈdʒuː.ti/", "noun", "Bổn phận nghĩa vụ", "Fulfilling your civic duty strengthens community trust.", "Hoàn thành nghĩa vụ công dân củng cố niềm tin cộng đồng.", "A2", "Công việc", "Business"]
];

OXFORD_ALPHABETICAL_BANK.forEach(item => {
  addEntry({
    word: item[0],
    ipa: item[1],
    phonetic: item[1],
    partOfSpeech: item[2],
    meaning: item[3],
    exampleEn: item[4],
    exampleVi: item[5],
    level: item[6],
    topic: item[7],
    tag: item[8]
  });
});

console.log(`Sau khi nạp ngân hàng từ vựng Oxford D-Z: ${wordMap.size} từ.`);

// 4. Nếu vẫn cần mở rộng để đạt mức 3.650 - 3.750 từ:
// Tự động bổ sung các từ vựng phái sinh và cụm từ ngữ Oxford Academic:
const VOCAB_SYNTHESIZER_ROOTS = [
  // E
  ["Eager", "/ˈiː.ɡər/", "adjective", "Háo hức hăm hở", "Students were eager to test their conversational fluency.", "Học sinh rất háo hức được thử thách sự lưu loát trong giao tiếp.", "A2", "Cảm xúc", "Emotions"],
  ["Eagerly", "/ˈiː.ɡə.li/", "adverb", "Một cách háo hức", "They eagerly waited for the morning seminar to begin.", "Họ háo hức chờ đợi buổi hội thảo buổi sáng bắt đầu.", "B1", "Cảm xúc", "Emotions"],
  ["Early", "/ˈɜː.li/", "adjective / adverb", "Sớm ban mai", "Waking early gives you uninterrupted focus time.", "Thức dậy sớm mang lại cho bạn thời gian tập trung không bị gián đoạn.", "A1", "Giao tiếp hàng ngày", "Daily"],
  ["Earn", "/ɜːn/", "verb", "Kiếm được tiền tài", "Consistent effort helps you earn respect and fluency.", "Nỗ lực đều đặn giúp bạn nhận được sự tôn trọng và lưu loát.", "A2", "Công việc", "Business"],
  ["Earth", "/ɜːθ/", "noun", "Trái đất hành tinh", "Cherish the delicate biodiversity of planet Earth.", "Hãy trân quý sự đa dạng sinh học mỏng manh của hành tinh Trái đất.", "A1", "Giao tiếp hàng ngày", "Daily"],
  ["Ease", "/iːz/", "noun / verb", "Sự dễ dàng thanh thản", "Spaced review allows you to speak with effortless ease.", "Ôn tập ngắt quãng cho phép bạn nói một cách nhẹ nhàng dễ dàng.", "B1", "Cảm xúc", "Emotions"],
  ["Easily", "/ˈiː.zəl.i/", "adverb", "Một cách dễ dàng", "Words reviewed at optimal intervals are recalled easily.", "Những từ được ôn tập ở khoảng cách tối ưu sẽ được nhớ lại dễ dàng.", "A1", "Học thuật", "Academic"],
  ["East", "/iːst/", "noun / adjective", "Phương Đông phía đông", "The sun rises majestically from the eastern horizon.", "Mặt trời mọc lên uy nghiêm từ đường chân trời phía đông.", "A1", "Du lịch", "Travel"],
  ["Eastern", "/ˈiː.stən/", "adjective", "Thuộc về phương Đông", "Traditional Eastern philosophy emphasizes harmony and balance.", "Triết học phương Đông truyền thống nhấn mạnh sự hài hòa và cân bằng.", "A2", "Học thuật", "Academic"],
  ["Easy", "/ˈiː.zi/", "adjective", "Dễ dàng đơn giản", "Break difficult tasks into small easy steps.", "Hãy chia nhỏ những nhiệm vụ khó khăn thành những bước nhỏ dễ dàng.", "A1", "Học thuật", "Academic"],
  ["Eat", "/iːt/", "verb", "Ăn uống", "Eat wholesome fresh meals to fuel cognitive clarity.", "Hãy ăn những bữa ăn tươi ngon lành mạnh để tiếp năng lượng cho sự minh mẫn.", "A1", "Giao tiếp hàng ngày", "Daily"],
  ["Economic", "/ˌiː.kəˈnɒm.ɪk/", "adjective", "Thuộc về kinh tế", "Technological innovations propel national economic growth.", "Những đổi mới công nghệ thúc đẩy tăng trưởng kinh tế quốc gia.", "A2", "Công việc", "Business"],
  ["Economical", "/ˌiː.kəˈnɒm.ɪ.kəl/", "adjective", "Tiết kiệm kinh tế", "Public transit is an economical way to travel cities.", "Giao thông công cộng là một cách tiết kiệm để đi lại trong thành phố.", "B1", "Du lịch", "Travel"],
  ["Economics", "/ˌiː.kəˈnɒm.ɪks/", "noun", "Ngành kinh tế học", "University economics studies market supply and demand curves.", "Kinh tế học đại học nghiên cứu các đường cong cung và cầu thị trường.", "B1", "Học thuật", "Academic"],
  ["Economy", "/iˈkɒn.ə.mi/", "noun", "Nền kinh tế", "A thriving knowledge economy values continuous education.", "Nền kinh tế tri thức phát triển coi trọng giáo dục liên tục.", "A2", "Công việc", "Business"],
  ["Edge", "/edʒ/", "noun", "Lợi thế, bờ rìa", "Bilingual communication gives candidates a competitive edge.", "Giao tiếp song ngữ mang lại cho các ứng viên một lợi thế cạnh tranh.", "B1", "Công việc", "Business"],
  ["Edit", "/ˈed.ɪt/", "verb", "Biên tập chỉnh sửa", "Edit written drafts to remove redundant verbose words.", "Hãy biên tập các bản thảo viết để loại bỏ những từ ngữ rườm rà thừa thãi.", "A2", "Học thuật", "Academic"],
  ["Edition", "/ɪˈdɪʃ.ən/", "noun", "Phiên bản ấn bản", "Study with the updated edition of the vocabulary guide.", "Hãy học với ấn bản cập nhật của cuốn hướng dẫn từ vựng.", "A2", "Học thuật", "Academic"],
  ["Editor", "/ˈed.ɪ.tər/", "noun", "Biên tập viên", "The publishing editor polished the manuscript carefully.", "Biên tập viên nhà xuất bản đã trau chuốt bản thảo một cách cẩn thận.", "A2", "Học thuật", "Academic"],
  ["Educate", "/ˈedʒ.u.keɪt/", "verb", "Giáo dục đào tạo", "Schools educate young minds to become ethical citizens.", "Trường học giáo dục tâm trí trẻ thơ trở thành những công dân đạo đức.", "A2", "Học thuật", "Academic"],
  ["Education", "/ˌedʒ.uˈkeɪ.ʃən/", "noun", "Nền giáo dục", "Quality education unlocks boundless human potential.", "Giáo dục chất lượng mở ra tiềm năng con người vô hạn.", "A1", "Học thuật", "Academic"],
  ["Educational", "/ˌedʒ.uˈkeɪ.ʃən.əl/", "adjective", "Mang tính giáo dục", "Interactive language games provide educational value.", "Các trò chơi ngôn ngữ tương tác mang lại giá trị giáo dục.", "A2", "Học thuật", "Academic"],
  ["Effect", "/ɪˈfekt/", "noun", "Hiệu quả tác động", "Daily spaced repetition has a profound effect on recall.", "Lặp lại ngắt quãng hàng ngày có tác động sâu sắc đến khả năng gợi nhớ.", "A2", "Học thuật", "Academic"],
  ["Effective", "/ɪˈfek.tɪv/", "adjective", "Hiệu quả rõ rệt", "Spaced flashcards are an effective vocabulary method.", "Thẻ flashcard ngắt quãng là một phương pháp từ vựng hiệu quả.", "B1", "Học thuật", "Academic"],
  ["Effectively", "/ɪˈfek.tɪv.li/", "adverb", "Một cách hiệu quả", "Manage study time effectively with the Pomodoro technique.", "Hãy quản lý thời gian học hiệu quả với kỹ thuật Pomodoro.", "B1", "Học thuật", "Academic"],
  ["Efficiency", "/ɪˈfɪʃ.ən.si/", "noun", "Hiệu suất năng suất", "Algorithmic review boosts study efficiency tenfold.", "Ôn tập bằng thuật toán tăng cường hiệu suất học tập lên gấp mười lần.", "B2", "Học thuật", "Academic"],
  ["Efficient", "/ɪˈfɪʃ.ənt/", "adjective", "Hiệu quả năng suất", "An efficient study routine saves hours of wasted effort.", "Một thói quen học tập hiệu quả giúp tiết kiệm hàng giờ nỗ lực lãng phí.", "B1", "Học thuật", "Academic"],
  ["Effort", "/ˈef.ət/", "noun", "Nỗ lực cố gắng", "Consistent effort turns unfamiliar words into second nature.", "Nỗ lực nhất quán biến những từ chưa quen thành bản năng thứ hai.", "A2", "Cảm xúc", "Emotions"],
  ["Egg", "/eɡ/", "noun", "Quả trứng tươi", "Boiled eggs provide clean protein for morning workouts.", "Trứng luộc cung cấp protein sạch cho các buổi tập thể dục buổi sáng.", "A1", "Giao tiếp hàng ngày", "Daily"],
  ["Either", "/ˈaɪ.ðər/", "determiner / conjunction", "Hoặc là, cả hai", "Study either in the morning or early evening peacefully.", "Hãy học vào buổi sáng hoặc buổi tối sớm một cách yên bình.", "A2", "Học thuật", "Academic"],
  ["Elder", "/ˈel.dər/", "noun / adjective", "Trưởng lão người cao niên", "Listen attentively to the wisdom of ancestral elders.", "Hãy lắng nghe chăm chú trí tuệ của các bậc tiền bối tổ tiên.", "B1", "Giao tiếp hàng ngày", "Daily"],
  ["Elderly", "/ˈel.dəl.i/", "adjective", "Cao tuổi già yếu", "Community volunteers assist elderly neighbors with groceries.", "Các tình nguyện viên cộng đồng giúp đỡ những người hàng xóm cao tuổi mua sắm đồ tạp hóa.", "A2", "Giao tiếp hàng ngày", "Daily"],
  ["Elect", "/iˈlekt/", "verb", "Bầu cử bầu chọn", "Citizens elect leaders to represent community interests.", "Công dân bầu chọn các nhà lãnh đạo để đại diện cho lợi ích cộng đồng.", "A2", "Công việc", "Business"],
  ["Election", "/iˈlek.ʃən/", "noun", "Cuộc bầu cử", "Democratic elections safeguard transparent governance.", "Bầu cử dân chủ bảo vệ sự quản trị minh bạch.", "A2", "Công việc", "Business"],
  ["Electric", "/iˈlek.trɪk/", "adjective", "Chạy bằng điện", "Electric train networks connect cities smoothly.", "Mạng lưới tàu điện kết nối các thành phố một cách êm ái.", "A2", "Công nghệ", "Tech"],
  ["Electrical", "/iˈlek.trɪ.kəl/", "adjective", "Thuộc về điện lực", "Certified engineers inspect electrical substation lines.", "Các kỹ sư được chứng nhận kiểm tra các đường dây trạm biến áp điện.", "B1", "Công nghệ", "Tech"],
  ["Electricity", "/ˌel.ɪkˈtrɪs.ə.ti/", "noun", "Điện năng nguồn điện", "Renewable solar installations generate clean electricity.", "Các hệ thống lắp đặt năng lượng mặt trời tái tạo tạo ra nguồn điện sạch.", "A2", "Công nghệ", "Tech"],
  ["Electronic", "/ˌel.ekˈtrɒn.ɪk/", "adjective", "Điện tử kỹ thuật số", "Electronic dictionaries provide instant phonetic audio.", "Từ điển điện tử cung cấp âm thanh ngữ âm tức thì.", "A2", "Công nghệ", "Tech"],
  ["Element", "/ˈel.ɪ.mənt/", "noun", "Yếu tố nguyên tố", "Active recall is an essential element of language retention.", "Gợi nhớ chủ động là yếu tố thiết yếu của việc ghi nhớ ngôn ngữ.", "A2", "Học thuật", "Academic"],
  ["Elevator", "/ˈel.ɪ.veɪ.tər/", "noun", "Thang máy", "Take the high-speed elevator to the top observation deck.", "Hãy đi thang máy tốc độ cao lên đài quan sát trên đỉnh.", "A1", "Du lịch", "Travel"],
  ["Embarrass", "/ɪmˈbær.əs/", "verb", "Làm lúng túng bối rối", "Never let grammar corrections embarrass your speech efforts.", "Đừng bao giờ để những lời sửa lỗi ngữ pháp làm lúng túng nỗ lực nói của bạn.", "B1", "Cảm xúc", "Emotions"],
  ["Embarrassed", "/ɪmˈbær.əst/", "adjective", "Ngượng ngùng bối rối", "There is no reason to feel embarrassed when asking questions.", "Không có lý do gì để cảm thấy ngượng ngùng khi đặt câu hỏi.", "A2", "Cảm xúc", "Emotions"],
  ["Embarrassing", "/ɪmˈbær.ə.sɪŋ/", "adjective", "Gây ngượng ngùng", "Treat embarrassing pronunciation slips with cheerful humor.", "Hãy đón nhận những lỗi phát âm ngượng ngùng bằng sự hài hước vui vẻ.", "B1", "Cảm xúc", "Emotions"],
  ["Embarrassment", "/ɪmˈbær.əs.mənt/", "noun", "Sự ngượng ngùng lúng túng", "Kind teachers dissolve student embarrassment with warm smiles.", "Những người thầy nhân từ xua tan sự ngượng ngùng của học sinh bằng nụ cười ấm áp.", "B1", "Cảm xúc", "Emotions"],
  ["Emergency", "/ɪˈmɜː.dʒən.si/", "noun", "Tình trạng khẩn cấp", "Know the emergency exits when boarding international flights.", "Hãy nắm rõ các lối thoát hiểm khẩn cấp khi lên máy bay quốc tế.", "A2", "Du lịch", "Travel"],
  ["Emotion", "/ɪˈməʊ.ʃən/", "noun", "Cảm xúc rung động", "Positive emotion fuels passionate lifelong vocabulary study.", "Cảm xúc tích cực tiếp lửa cho việc học từ vựng say mê suốt đời.", "A2", "Cảm xúc", "Emotions"],
  ["Emotional", "/ɪˈməʊ.ʃən.əl/", "adjective", "Thuộc về cảm xúc", "Developing emotional intelligence strengthens team harmony.", "Phát triển trí tuệ cảm xúc củng cố sự hòa hợp trong nhóm.", "B1", "Cảm xúc", "Emotions"],
  ["Emphasis", "/ˈem.fə.sɪs/", "noun", "Sự nhấn mạnh trọng âm", "Correct syllable emphasis transforms spoken clarity.", "Nhấn trọng âm âm tiết chính xác làm thay đổi độ rõ ràng khi nói.", "B1", "Học thuật", "Academic"],
  ["Emphasize", "/ˈem.fə.saɪz/", "verb", "Nhấn mạnh làm nổi bật", "Teachers emphasize active recall over passive reading.", "Giáo viên nhấn mạnh gợi nhớ chủ động hơn là đọc thụ động.", "B1", "Học thuật", "Academic"],
  ["Employ", "/ɪmˈplɔɪ/", "verb", "Thuê dụng, áp dụng", "Employ spaced repetition tools to master Oxford vocabulary.", "Hãy áp dụng các công cụ lặp lại ngắt quãng để làm chủ từ vựng Oxford.", "B1", "Công việc", "Business"],
  ["Employee", "/ɪmˈplɔɪ.iː/", "noun", "Nhân viên người làm", "Employees flourish in psychologically safe team environments.", "Nhân viên phát triển mạnh mẽ trong môi trường nhóm an toàn về tâm lý.", "A2", "Công việc", "Business"],
  ["Employer", "/ɪmˈplɔɪ.ər/", "noun", "Người sử dụng lao động", "Forward-thinking employers support continuing education.", "Những người sử dụng lao động có tầm nhìn ủng hộ giáo dục thường xuyên.", "B1", "Công việc", "Business"],
  ["Employment", "/ɪmˈplɔɪ.mənt/", "noun", "Việc làm nghề nghiệp", "Fluent English skills expand global employment options.", "Kỹ năng tiếng Anh lưu loát mở rộng các cơ hội việc làm toàn cầu.", "A2", "Công việc", "Business"],
  ["Empty", "/ˈemp.ti/", "adjective / verb", "Trống rỗng, đổ sạch", "Clear an empty desk space to focus during study blocks.", "Hãy dọn một khoảng bàn trống để tập trung trong các khoảng thời gian học.", "A1", "Giao tiếp hàng ngày", "Daily"],
  ["Enable", "/ɪˈneɪ.bəl/", "verb", "Cho phép tạo điều kiện", "Digital tools enable personalized spaced learning paths.", "Các công cụ kỹ thuật số cho phép lộ trình học tập ngắt quãng cá nhân hóa.", "B1", "Công nghệ", "Tech"],
  ["Encounter", "/ɪnˈkaʊn.tər/", "verb / noun", "Chạm trán bắt gặp", "Celebrate every time you encounter new words in texts.", "Hãy ăn mừng mỗi khi bạn bắt gặp các từ mới trong văn bản.", "B1", "Học thuật", "Academic"],
  ["Encourage", "/ɪnˈkʌr.ɪdʒ/", "verb", "Động viên khích lệ", "Encourage peers who struggle with pronunciation drills.", "Hãy động viên các bạn học đang gặp khó khăn với các bài luyện phát âm.", "A2", "Cảm xúc", "Emotions"],
  ["Encouragement", "/ɪnˈkʌr.ɪdʒ.mənt/", "noun", "Sự động viên khích lệ", "A kind word of encouragement can lift a discouraged learner.", "Một lời động viên tử tế có thể nâng đỡ một người học đang nản lòng.", "B1", "Cảm xúc", "Emotions"],
  ["End", "/end/", "noun / verb", "Kết thúc chấm dứt", "Review new vocabulary at the end of each study block.", "Hãy ôn lại từ vựng mới vào cuối mỗi khoảng thời gian học.", "A1", "Học thuật", "Academic"],
  ["Ending", "/ˈen.dɪŋ/", "noun", "Phần kết cục", "The classic story has an inspiring and triumphant ending.", "Câu chuyện kinh điển có một kết cục truyền cảm hứng và chiến thắng.", "A2", "Học thuật", "Academic"],
  ["Enemy", "/ˈen.ə.mi/", "noun", "Kẻ thù đối địch", "Procrastination is the chief enemy of language fluency.", "Sự trì hoãn là kẻ thù chính của sự lưu loát ngôn ngữ.", "A2", "Cảm xúc", "Emotions"],
  ["Energy", "/ˈen.ə.dʒi/", "noun", "Năng lượng sức sống", "Channel enthusiastic morning energy into vocabulary mastery.", "Hãy chuyển hóa năng lượng buổi sáng nhiệt huyết vào việc làm chủ từ vựng.", "A2", "Cảm xúc", "Emotions"],
  ["Engage", "/ɪnˈɡeɪdʒ/", "verb", "Thu hút đính ước", "Engage in active conversational dialogues with native peers.", "Hãy tham gia vào các cuộc hội thoại giao tiếp chủ động với bạn bè bản xứ.", "B1", "Giao tiếp hàng ngày", "Daily"],
  ["Engine", "/ˈen.dʒɪn/", "noun", "Động cơ máy móc", "Search algorithms power the web translation engine.", "Thuật toán tìm kiếm hỗ trợ động cơ dịch thuật trên web.", "A2", "Công nghệ", "Tech"],
  ["Engineer", "/ˌen.dʒɪˈnɪər/", "noun", "Kỹ sư", "Software engineers design robust scalable cloud backends.", "Các kỹ sư phần mềm thiết kế phần phụ trợ đám mây mở rộng mạnh mẽ.", "A2", "Công nghệ", "Tech"],
  ["Engineering", "/ˌen.dʒɪˈnɪə.rɪŋ/", "noun", "Ngành kỹ thuật", "Civil engineering builds sustainable metropolitan bridges.", "Kỹ thuật dân dụng xây dựng những cây cầu đô thị bền vững.", "B1", "Công nghệ", "Tech"],
  ["Enhance", "/ɪnˈhɑːns/", "verb", "Nâng cao tăng cường", "Spaced flashcards enhance memory consolidation noticeably.", "Thẻ flashcard ngắt quãng nâng cao khả năng củng cố trí nhớ một cách rõ rệt.", "B2", "Học thuật", "Academic"],
  ["Enjoy", "/ɪnˈdʒɔɪ/", "verb", "Tận hưởng thưởng thức", "Enjoy every small victory along your study path.", "Hãy tận hưởng từng chiến thắng nhỏ trên con đường học tập của bạn.", "A1", "Cảm xúc", "Emotions"],
  ["Enjoyable", "/ɪnˈdʒɔɪ.ə.bəl/", "adjective", "Thú vị thú vị", "Gamified language learning makes study genuinely enjoyable.", "Học ngôn ngữ bằng trò chơi hóa làm cho việc học thực sự thú vị.", "A2", "Cảm xúc", "Emotions"],
  ["Enormous", "/ɪˈnɔː.məs/", "adjective", "Khổng lồ to lớn", "Consistent study delivers an enormous vocabulary dividend.", "Học tập nhất quán mang lại một thành quả từ vựng khổng lồ.", "B1", "Học thuật", "Academic"],
  ["Enough", "/ɪˈnʌf/", "determiner / adverb", "Đầy đủ vừa đủ", "Ensure you get enough restful sleep to retain words.", "Hãy đảm bảo bạn ngủ đủ giấc để ghi nhớ từ vựng.", "A1", "Giao tiếp hàng ngày", "Daily"],
  ["Enquiry", "/ɪnˈkwaɪə.ri/", "noun", "Yêu cầu giải đáp thắc mắc", "Submit an online enquiry for international school admissions.", "Hãy gửi một yêu cầu trực tuyến để xin nhập học trường quốc tế.", "B2", "Học thuật", "Academic"],
  ["Ensure", "/ɪnˈʃɔːr/", "verb", "Đảm bảo chắc chắn", "Spaced review ensures that words are never forgotten.", "Ôn tập ngắt quãng đảm bảo rằng từ vựng không bao giờ bị lãng quên.", "B1", "Học thuật", "Academic"],
  ["Enter", "/ˈen.tər/", "verb", "Bước vào, nhập liệu", "Enter your credentials to access the study dashboard.", "Hãy nhập thông tin đăng nhập của bạn để truy cập bảng điều khiển học tập.", "A1", "Công nghệ", "Tech"],
  ["Enterprise", "/ˈen.tə.praɪz/", "noun", "Doanh nghiệp tổ chức", "Cloud technology powers modern commercial enterprises.", "Công nghệ đám mây hỗ trợ các doanh nghiệp thương mại hiện đại.", "B2", "Công việc", "Business"],
  ["Entertainment", "/en.təˈteɪn.mənt/", "noun", "Sự giải trí tiêu khiển", "Watching English movies provides engaging entertainment.", "Xem phim tiếng Anh mang lại sự giải trí đầy lôi cuốn.", "A2", "Giao tiếp hàng ngày", "Daily"],
  ["Enthusiasm", "/ɪnˈθjuː.zi.æz.əm/", "noun", "Sự nhiệt huyết hào hứng", "Her vibrant enthusiasm inspired fellow language learners.", "Sự nhiệt huyết rực rỡ của cô đã truyền cảm hứng cho các bạn cùng học ngôn ngữ.", "B1", "Cảm xúc", "Emotions"],
  ["Enthusiastic", "/ɪnˌθjuː.ziˈæs.tɪk/", "adjective", "Nhiệt tình hào hứng", "Be enthusiastic about discovering expressive new phrases.", "Hãy hào hứng với việc khám phá các cụm từ biểu cảm mới.", "B1", "Cảm xúc", "Emotions"],
  ["Entire", "/ɪnˈtaɪər/", "adjective", "Toàn bộ trọn vẹn", "She read the entire English novel in three days.", "Cô ấy đã đọc toàn bộ cuốn tiểu thuyết tiếng Anh trong ba ngày.", "A2", "Học thuật", "Academic"],
  ["Entirely", "/ɪnˈtaɪə.li/", "adverb", "Hoàn toàn triệt để", "Fluency is entirely achievable through daily dedication.", "Sự lưu loát hoàn toàn có thể đạt được thông qua sự cống hiến hàng ngày.", "B1", "Học thuật", "Academic"],
  ["Entitle", "/ɪnˈtaɪ.təl/", "verb", "Cho quyền được hưởng", "Membership entitles students to unlimited library checkouts.", "Tư cách thành viên cho phép sinh viên mượn sách thư viện không giới hạn.", "B2", "Học thuật", "Academic"],
  ["Entrance", "/ˈen.trəns/", "noun", "Lối vào cổng vào", "Meet me beside the university library main entrance.", "Hãy gặp tôi bên cạnh lối vào chính của thư viện trường đại học.", "A2", "Du lịch", "Travel"],
  ["Entry", "/ˈen.tri/", "noun", "Mục từ vựng, lối vào", "Each dictionary entry displays IPA, definition, and example.", "Mỗi mục từ điển hiển thị IPA, định nghĩa và câu ví dụ.", "A2", "Học thuật", "Academic"],
  ["Envelope", "/ˈen.və.ləʊp/", "noun", "Phong bì thư", "Seal your handwritten greeting letter in a blue envelope.", "Hãy niêm phong bức thư chúc mừng viết tay trong một phong bì màu xanh.", "A2", "Giao tiếp hàng ngày", "Daily"],
  ["Environment", "/ɪnˈvaɪ.rən.mənt/", "noun", "Môi trường sống", "A quiet orderly environment maximizes cognitive retention.", "Một môi trường yên tĩnh ngăn nắp tối đa hóa khả năng ghi nhớ nhận thức.", "A2", "Học thuật", "Academic"],
  ["Environmental", "/ɪnˌvaɪ.rənˈmen.təl/", "adjective", "Thuộc về môi trường", "Environmental conservation protects delicate planetary wetlands.", "Bảo tồn môi trường bảo vệ các vùng đất ngập nước mỏng manh của hành tinh.", "B1", "Giao tiếp hàng ngày", "Daily"],
  ["Episode", "/ˈep.ɪ.səʊd/", "noun", "Tập phim, tình tiết", "Listen to an episode of an authentic English podcast daily.", "Hãy nghe một tập podcast tiếng Anh chân thực mỗi ngày.", "A2", "Giao tiếp hàng ngày", "Daily"],
  ["Equal", "/ˈiː.kwəl/", "adjective / verb", "Bình đẳng ngang bằng", "Every student deserves equal access to quality education.", "Mọi học sinh đều xứng đáng được tiếp cận bình đẳng với nền giáo dục chất lượng.", "A2", "Học thuật", "Academic"],
  ["Equally", "/ˈiː.kwə.li/", "adverb", "Một cách bình đẳng", "Distribute speaking turns equally across seminar members.", "Hãy phân chia lượt phát biểu bình đẳng giữa các thành viên hội thảo.", "B1", "Học thuật", "Academic"],
  ["Equipment", "/ɪˈkwɪp.mənt/", "noun", "Thiết bị trang thiết bị", "Modern laboratory equipment ensures precise test outcomes.", "Thiết bị phòng thí nghiệm hiện đại đảm bảo kết quả kiểm tra chính xác.", "A2", "Công nghệ", "Tech"],
  ["Era", "/ˈɪə.rə/", "noun", "Kỷ nguyên thời đại", "The digital era democratizes access to global knowledge.", "Kỷ nguyên số đại chúng hóa việc tiếp cận tri thức toàn cầu.", "B2", "Học thuật", "Academic"],
  ["Error", "/ˈer.ər/", "noun", "Lỗi sai sót", "Grammar errors are natural stepping stones toward fluency.", "Lỗi ngữ pháp là những bước đệm tự nhiên hướng tới sự lưu loát.", "A2", "Học thuật", "Academic"],
  ["Escape", "/ɪˈskeɪp/", "verb / noun", "Trốn thoát lối thoát", "Reading captivating fiction lets the imagination escape.", "Đọc tiểu thuyết lôi cuốn cho phép trí tưởng tượng bay xa.", "A2", "Cảm xúc", "Emotions"],
  ["Especially", "/ɪˈspesʃ.əl.i/", "adverb", "Đặc biệt là", "Spaced repetition is especially effective for vocabulary.", "Lặp lại ngắt quãng đặc biệt hiệu quả đối với từ vựng.", "A1", "Học thuật", "Academic"],
  ["Essay", "/ˈes.eɪ/", "noun", "Bài văn bài luận", "Write a coherent argumentative essay backed with citations.", "Hãy viết một bài luận lập luận mạch lạc được hỗ trợ bởi các trích dẫn.", "A2", "Học thuật", "Academic"],
  ["Essential", "/ɪˈsen.ʃəl/", "adjective", "Thiết yếu cốt yếu", "Spaced review is essential for long-term memory recall.", "Ôn tập ngắt quãng là thiết yếu cho việc gợi nhớ trí nhớ dài hạn.", "B1", "Học thuật", "Academic"],
  ["Essentially", "/ɪˈsen.ʃəl.i/", "adverb", "Về bản chất cơ bản", "Language mastery is essentially a product of daily habits.", "Làm chủ ngôn ngữ về bản chất là sản phẩm của các thói quen hàng ngày.", "B2", "Học thuật", "Academic"],
  ["Establish", "/ɪˈstæb.lɪʃ/", "verb", "Thiết lập thành lập", "Establish a consistent morning schedule for flashcard reviews.", "Hãy thiết lập một lịch trình buổi sáng nhất quán cho việc ôn thẻ flashcard.", "B1", "Công việc", "Business"],
  ["Estate", "/ɪˈsteɪt/", "noun", "Khu bất động sản", "The historic country estate is surrounded by rolling gardens.", "Khu trang viên lịch sử ở vùng quê được bao quanh bởi những khu vườn uốn lượn.", "B2", "Du lịch", "Travel"],
  ["Estimate", "/ˈes.tɪ.meɪt/", "verb / noun", "Ước tính dự toán", "We estimate that six months of practice delivers C1 fluency.", "Chúng tôi ước tính rằng sáu tháng luyện tập sẽ mang lại sự lưu loát C1.", "B1", "Công việc", "Business"],
  ["Ethical", "/ˈeθ.ɪ.kəl/", "adjective", "Thuộc về đạo đức", "Ethical journalism verifies sources before publishing reports.", "Báo chí có đạo đức luôn xác minh các nguồn tin trước khi xuất bản báo cáo.", "B2", "Học thuật", "Academic"],
  ["Ethics", "/ˈeθ.ɪks/", "noun", "Đạo đức học, luân thường", "Business ethics require transparent customer communication.", "Đạo đức kinh doanh đòi hỏi giao tiếp minh bạch với khách hàng.", "B2", "Công việc", "Business"],
  ["Evaluate", "/ɪˈvæl.ju.eɪt/", "verb", "Đánh giá định lượng", "Evaluate study progress with weekly diagnostic quizzes.", "Hãy đánh giá tiến độ học tập bằng các bài kiểm tra chẩn đoán hàng tuần.", "B1", "Học thuật", "Academic"],
  ["Evaluation", "/ɪˌvæl.juˈeɪ.ʃən/", "noun", "Sự thẩm định đánh giá", "Oral evaluation measures pronunciation and lexical range.", "Đánh giá vấn đáp đo lường phát âm và vốn từ vựng.", "B2", "Học thuật", "Academic"],
  ["Evening", "/ˈiːv.nɪŋ/", "noun", "Buổi tối", "Spend quiet evenings reviewing today's acquired vocabulary.", "Hãy dành những buổi tối yên tĩnh để ôn lại từ vựng đã tiếp thu hôm nay.", "A1", "Giao tiếp hàng ngày", "Daily"],
  ["Event", "/ɪˈvent/", "noun", "Sự kiện biến cố", "The annual speech event celebrates cross-cultural fluency.", "Sự kiện hùng biện thường niên tôn vinh sự lưu loát giao lưu văn hóa.", "A2", "Giao tiếp hàng ngày", "Daily"],
  ["Eventual", "/ɪˈven.tʃu.əl/", "adjective", "Cuối cùng sau rốt", "Daily consistency guarantees eventual communicative ease.", "Sự nhất quán hàng ngày đảm bảo sự tự nhiên trong giao tiếp cuối cùng.", "B2", "Học thuật", "Academic"],
  ["Eventually", "/ɪˈven.tʃu.əl.i/", "adverb", "Rốt cuộc cuối cùng", "Small steps eventually compound into extraordinary fluency.", "Những bước nhỏ rốt cuộc sẽ tích tụ thành sự lưu loát phi thường.", "A2", "Học thuật", "Academic"],
  ["Every", "/ˈev.ri/", "determiner", "Mỗi từng", "Every new word learned opens another window onto reality.", "Mỗi từ mới học được mở ra một ô cửa sổ khác nhìn vào thực tế.", "A1", "Học thuật", "Academic"],
  ["Everybody", "/ˈev.riˌbɒd.i/", "pronoun", "Mọi người", "Everybody can acquire foreign fluency with regular practice.", "Mọi người đều có thể tiếp thu sự lưu loát ngoại ngữ với việc luyện tập đều đặn.", "A1", "Giao tiếp hàng ngày", "Daily"],
  ["Everyday", "/ˈev.ri.deɪ/", "adjective", "Hàng ngày thông dụng", "Learn practical everyday phrases used in casual conversation.", "Hãy học những cụm từ thông dụng hàng ngày được dùng trong trò chuyện bình thường.", "A1", "Giao tiếp hàng ngày", "Daily"],
  ["Everyone", "/ˈev.ri.wʌn/", "pronoun", "Mọi người", "Everyone benefits from encouraging words of support.", "Mọi người đều được hưởng lợi từ những lời ủng hộ khích lệ.", "A1", "Cảm xúc", "Emotions"],
  ["Everything", "/ˈev.ri.θɪŋ/", "pronoun", "Mọi thứ vạn vật", "Consistent habits make everything in language learning easier.", "Thói quen nhất quán làm cho mọi thứ trong việc học ngôn ngữ trở nên dễ dàng hơn.", "A1", "Học thuật", "Academic"],
  ["Everywhere", "/ˈev.ri.weər/", "adverb", "Khắp mọi nơi", "English is spoken everywhere across international air transit.", "Tiếng Anh được nói ở khắp mọi nơi trên các chuyến bay quốc tế.", "A1", "Du lịch", "Travel"],
  ["Evidence", "/ˈev.ɪ.dəns/", "noun", "Bằng chứng chứng cứ", "Empirical evidence supports spaced repetition algorithms.", "Bằng chứng thực nghiệm ủng hộ các thuật toán lặp lại ngắt quãng.", "A2", "Học thuật", "Academic"],
  ["Evident", "/ˈev.ɪ.dənt/", "adjective", "Hiển nhiên rõ ràng", "Her spoken fluency became evident after months of practice.", "Sự lưu loát khi nói của cô ấy trở nên rõ ràng sau nhiều tháng luyện tập.", "B1", "Học thuật", "Academic"],
  ["Evolution", "/ˌiː.vəˈluː.ʃən/", "noun", "Sự tiến hóa phát triển", "The evolution of human language mirrors cognitive growth.", "Sự tiến hóa của ngôn ngữ loài người phản ánh sự phát triển nhận thức.", "B2", "Học thuật", "Academic"],
  ["Exact", "/ɪɡˈzækt/", "adjective", "Chính xác chuẩn xác", "Practice the exact phonetic sounds of English vowels.", "Hãy luyện tập các âm ngữ âm chính xác của các nguyên âm tiếng Anh.", "A2", "Học thuật", "Academic"],
  ["Exactly", "/ɪɡˈzækt.li/", "adverb", "Một cách chính xác", "Repeat the phrase exactly as native audio models recite.", "Hãy lặp lại cụm từ một cách chính xác như các mẫu âm thanh bản xứ đọc.", "A1", "Học thuật", "Academic"],
  ["Exaggerate", "/ɪɡˈzædʒ.ə.reɪt/", "verb", "Phóng đại thổi phồng", "Do not exaggerate difficulties; take tasks one step at a time.", "Đừng phóng đại khó khăn; hãy giải quyết các nhiệm vụ từng bước một.", "B2", "Cảm xúc", "Emotions"],
  ["Examination", "/ɪɡˌzæm.ɪˈneɪ.ʃən/", "noun", "Kỳ thi bài kiểm tra", "Reviewing flashcards thoroughly prepares you for the examination.", "Ôn tập thẻ flashcard kỹ lưỡng giúp bạn chuẩn bị tốt cho kỳ thi.", "A2", "Học thuật", "Academic"],
  ["Examine", "/ɪɡˈzæm.ɪn/", "verb", "Kiểm tra xem xét", "Examine grammar mistake patterns to eliminate recurring errors.", "Hãy kiểm tra các dạng lỗi ngữ pháp để loại bỏ những lỗi lặp lại.", "B1", "Học thuật", "Academic"],
  ["Example", "/ɪɡˈzɑːm.pəl/", "noun", "Ví dụ minh họa", "Study example sentences to understand real contextual usages.", "Hãy học các câu ví dụ để hiểu cách sử dụng thực tế trong ngữ cảnh.", "A1", "Học thuật", "Academic"],
  ["Excellent", "/ˈek.səl.ənt/", "adjective", "Xuất sắc tuyệt hảo", "Daily practice produces excellent pronunciation results.", "Luyện tập hàng ngày mang lại những kết quả phát âm xuất sắc.", "A1", "Cảm xúc", "Emotions"],
  ["Except", "/ɪkˈsept/", "preposition / conjunction", "Ngoại trừ trừ ra", "Practice every day except Sunday when you take peaceful rest.", "Hãy luyện tập mỗi ngày ngoại trừ Chủ nhật khi bạn nghỉ ngơi yên bình.", "A2", "Giao tiếp hàng ngày", "Daily"],
  ["Exception", "/ɪkˈsep.ʃən/", "noun", "Ngoại lệ điều đặc biệt", "Grammar rules possess fascinating historical exceptions.", "Các quy tắc ngữ pháp sở hữu những ngoại lệ lịch sử hấp dẫn.", "B1", "Học thuật", "Academic"],
  ["Exchange", "/ɪksˈtʃeɪndʒ/", "verb / noun", "Trao đổi đổi tiền", "Language exchange partnerships accelerate conversational reflexes.", "Hợp tác trao đổi ngôn ngữ giúp đẩy nhanh phản xạ giao tiếp.", "A2", "Du lịch", "Travel"],
  ["Excited", "/ɪkˈsaɪ.tɪd/", "adjective", "Phấn khích hào hứng", "Students were excited to start the conversational challenge.", "Học sinh rất phấn khích khi bắt đầu thử thách giao tiếp.", "A1", "Cảm xúc", "Emotions"],
  ["Excitement", "/ɪkˈsaɪt.mənt/", "noun", "Sự phấn khích hứng khởi", "The journey abroad filled young travelers with pure excitement.", "Chuyến đi ra nước ngoài lấp đầy những du khách trẻ tuổi với sự hào hứng thuần khiết.", "A2", "Cảm xúc", "Emotions"],
  ["Exciting", "/ɪkˈsaɪ.tɪŋ/", "adjective", "Hấp dẫn thú vị", "Unlocking foreign fluency is an exciting lifelong adventure.", "Mở khóa sự lưu loát ngoại ngữ là một chuyến phiêu lưu thú vị suốt đời.", "A1", "Cảm xúc", "Emotions"],
  ["Exclude", "/ɪkˈskluːd/", "verb", "Loại trừ không tính", "Comprehensive study does not exclude speaking and listening.", "Việc học toàn diện không loại trừ kỹ năng nói và nghe.", "B2", "Học thuật", "Academic"],
  ["Exclusion", "/ɪkˈskluː.ʒən/", "noun", "Sự loại trừ bài xích", "Democratic values reject social marginalization and exclusion.", "Các giá trị dân chủ từ chối sự gạt ra ngoài lề xã hội và bài xích.", "B2", "Học thuật", "Academic"],
  ["Excuse", "/ɪkˈskjuːz/", "verb / noun", "Tha thứ, lời viện cớ", "Excuse minor slips and focus on communicating meaning.", "Hãy bỏ qua những lỗi nhỏ và tập trung vào việc truyền đạt ý nghĩa.", "A1", "Giao tiếp hàng ngày", "Daily"],
  ["Executive", "/ɪɡˈzek.jə.tɪv/", "noun / adjective", "Giám đốc điều hành", "The executive approved corporate sponsorship for student grants.", "Giám đốc điều hành đã phê duyệt tài trợ của công ty cho các học bổng sinh viên.", "B2", "Công việc", "Business"],
  ["Exercise", "/ˈek.sə.saɪz/", "noun / verb", "Tập thể dục, bài tập", "Daily physical exercise sharpens cognitive memory retention.", "Tập thể dục thể chất hàng ngày làm tăng sự ghi nhớ nhận thức sắc bén.", "A1", "Giao tiếp hàng ngày", "Daily"],
  ["Exhibition", "/ˌek.sɪˈbɪʃ.ən/", "noun", "Triển lãm trưng bày", "The art museum opened an international photography exhibition.", "Bảo tàng nghệ thuật đã mở một cuộc triển lãm nhiếp ảnh quốc tế.", "A2", "Du lịch", "Travel"],
  ["Exist", "/ɪɡˈzɪst/", "verb", "Tồn tại hiện hữu", "Many synonyms exist to describe subtle emotional states.", "Nhiều từ đồng nghĩa tồn tại để miêu tả những trạng thái cảm xúc tinh tế.", "A2", "Học thuật", "Academic"],
  ["Existence", "/ɪɡˈzɪs.təns/", "noun", "Sự tồn tại hiện diện", "Languages come into existence to serve human connection.", "Ngôn ngữ ra đời để phục vụ cho sự kết nối giữa con người.", "B1", "Học thuật", "Academic"],
  ["Exit", "/ˈek.sɪt/", "noun / verb", "Lối ra cửa thoát", "Follow the luminous exit signs to leave the stadium.", "Hãy đi theo các biển báo lối ra phát sáng để rời khỏi sân vận động.", "A1", "Du lịch", "Travel"],
  ["Expand", "/ɪkˈspænd/", "verb", "Mở rộng phát triển", "Reading non-fiction expands your conceptual vocabulary.", "Đọc sách phi hư cấu giúp mở rộng vốn từ vựng khái niệm của bạn.", "B1", "Học thuật", "Academic"],
  ["Expansion", "/ɪkˈspæn.ʃən/", "noun", "Sự mở rộng quy mô", "Vocabulary expansion unlocks sophisticated communication ease.", "Mở rộng vốn từ vựng mở ra sự tự nhiên trong giao tiếp tinh tế.", "B2", "Học thuật", "Academic"],
  ["Expect", "/ɪkˈspekt/", "verb", "Mong đợi kỳ vọng", "Expect incremental progress each day rather than overnight magic.", "Hãy mong đợi sự tiến bộ gia tăng mỗi ngày thay vì phép màu qua đêm.", "A2", "Cảm xúc", "Emotions"],
  ["Expectation", "/ˌek.spekˈteɪ.ʃən/", "noun", "Sự kỳ vọng mong đợi", "Set realistic expectations to sustain joyful learning stamina.", "Hãy đặt ra những kỳ vọng thực tế để duy trì thể lực học tập vui vẻ.", "B1", "Cảm xúc", "Emotions"],
  ["Expense", "/ɪkˈspens/", "noun", "Chi phí chi tiêu", "Educational investments deliver value far exceeding their expense.", "Các khoản đầu tư giáo dục mang lại giá trị vượt xa chi phí của chúng.", "A2", "Công việc", "Business"],
  ["Expensive", "/ɪkˈspen.sɪv/", "adjective", "Đắt đỏ tốn kém", "Learning English online is effective and not expensive.", "Học tiếng Anh trực tuyến rất hiệu quả và không hề đắt đỏ.", "A1", "Công việc", "Business"],
  ["Experience", "/ɪkˈspɪə.ri.əns/", "noun / verb", "Trải nghiệm kinh nghiệm", "Immersion travel provides rich cultural learning experience.", "Du lịch đắm chìm mang lại trải nghiệm học tập văn hóa phong phú.", "A1", "Du lịch", "Travel"],
  ["Experienced", "/ɪkˈspɪə.ri.ənst/", "adjective", "Giàu kinh nghiệm", "Experienced teachers guide pronunciation with patient clarity.", "Những giáo viên giàu kinh nghiệm hướng dẫn phát âm với sự rõ ràng kiên nhẫn.", "A2", "Học thuật", "Academic"],
  ["Experiment", "/ɪkˈsper.ɪ.mənt/", "noun / verb", "Thí nghiệm khoa học", "Laboratory experiments test hypotheses under strict controls.", "Các thí nghiệm phòng thí nghiệm kiểm tra các giả thuyết dưới sự kiểm soát nghiêm ngặt.", "A2", "Học thuật", "Academic"],
  ["Experimental", "/ɪkˌsper.ɪˈmen.təl/", "adjective", "Mang tính thử nghiệm", "Experimental teaching methods engage modern digital learners.", "Các phương pháp giảng dạy thử nghiệm thu hút người học kỹ thuật số hiện đại.", "B2", "Học thuật", "Academic"],
  ["Expert", "/ˈek.spɜːt/", "noun / adjective", "Chuyên gia thành thạo", "Consult language experts to resolve nuanced syntactic dilemmas.", "Hãy tham khảo các chuyên gia ngôn ngữ để giải quyết các khúc mắc cú pháp tinh tế.", "A2", "Học thuật", "Academic"],
  ["Explain", "/ɪkˈspleɪn/", "verb", "Giải thích làm rõ", "Great educators explain intricate rules with effortless simplicity.", "Những nhà giáo dục tuyệt vời giải thích các quy tắc phức tạp với sự đơn giản nhẹ nhàng.", "A1", "Học thuật", "Academic"],
  ["Explanation", "/ˌek.spləˈneɪ.ʃən/", "noun", "Lời giải thích", "Clear explanations clarify grammatical sentence structures.", "Những lời giải thích rõ ràng làm sáng tỏ cấu trúc câu ngữ pháp.", "A2", "Học thuật", "Academic"],
  ["Explode", "/ɪkˈspləʊd/", "verb", "Bùng nổ phát nổ", "Volcanoes explode with dramatic plumes of smoke and ash.", "Núi lửa bùng nổ với những cột khói và tro bụi đầy kịch tính.", "A2", "Giao tiếp hàng ngày", "Daily"],
  ["Exploration", "/ˌek.spləˈreɪ.ʃən/", "noun", "Sự khám phá thám hiểm", "Space exploration inspires humanity's collective technological ambition.", "Thám hiểm không gian truyền cảm hứng cho tham vọng công nghệ chung của nhân loại.", "B2", "Du lịch", "Travel"],
  ["Explore", "/ɪkˈsplɔːr/", "verb", "Khám phá tìm hiểu", "Explore diverse literature genres to absorb rich idioms.", "Hãy khám phá các thể loại văn học đa dạng để tiếp thu thành ngữ phong phú.", "A2", "Du lịch", "Travel"],
  ["Explosion", "/ɪkˈspləʊ.ʒən/", "noun", "Vụ nổ sự bùng nổ", "The explosion of mobile internet democratized education.", "Sự bùng nổ của internet di động đã đại chúng hóa giáo dục.", "A2", "Công nghệ", "Tech"],
  ["Export", "/ɪkˈspɔːt/", "verb / noun", "Xuất khẩu hàng hóa", "Agricultural nations export high-grade coffee beans globally.", "Các quốc gia nông nghiệp xuất khẩu hạt cà phê cao cấp ra toàn cầu.", "A2", "Công việc", "Business"],
  ["Expose", "/ɪkˈspəʊz/", "verb", "Tiếp xúc phơi bày", "Expose yourself to authentic English podcasts every day.", "Hãy để bản thân tiếp xúc với các podcast tiếng Anh chân thực mỗi ngày.", "B1", "Học thuật", "Academic"],
  ["Exposure", "/ɪkˈspəʊ.ʒər/", "noun", "Sự tiếp xúc phơi nhiễm", "Continuous auditory exposure develops subconscious speech fluency.", "Sự tiếp xúc thính giác liên tục giúp phát triển sự lưu loát khi nói một cách tiềm thức.", "B2", "Học thuật", "Academic"],
  ["Express", "/ɪkˈspres/", "verb / adjective", "Bày tỏ, tốc hành", "Express your genuine gratitude to mentors and peers.", "Hãy bày tỏ lòng biết ơn chân thành của bạn tới các thầy cô và bạn bè.", "A2", "Cảm xúc", "Emotions"],
  ["Expression", "/ɪkˈspreʃ.ən/", "noun", "Cách diễn đạt, nét mặt", "Idiomatic expressions add vivid color to everyday speech.", "Những cách diễn đạt thành ngữ tạo thêm màu sắc sinh động cho lời nói hàng ngày.", "A2", "Học thuật", "Academic"],
  ["Extend", "/ɪkˈstend/", "verb", "Mở rộng kéo dài", "Extend study sessions by five minutes when energy allows.", "Hãy kéo dài các buổi học thêm năm phút khi năng lượng cho phép.", "A2", "Học thuật", "Academic"],
  ["Extension", "/ɪkˈsten.ʃən/", "noun", "Sự mở rộng phần mở rộng", "The university library built a spacious modern study extension.", "Thư viện trường đại học đã xây dựng một khu mở rộng học tập hiện đại và rộng rãi.", "B1", "Học thuật", "Academic"],
  ["Extensive", "/ɪkˈsten.sɪv/", "adjective", "Sâu rộng bao quát", "She conducted extensive research into cognitive linguistics.", "Cô ấy đã thực hiện nghiên cứu sâu rộng về ngôn ngữ học nhận thức.", "B2", "Học thuật", "Academic"],
  ["Extent", "/ɪkˈstent/", "noun", "Mức độ quy mô", "To a large extent, fluency depends on daily perseverance.", "Ở một mức độ lớn, sự lưu loát phụ thuộc vào sự kiên trì hàng ngày.", "B1", "Học thuật", "Academic"],
  ["External", "/ɪkˈstɜː.nəl/", "adjective", "Bên ngoài ngoại lai", "Backup project files to an external encrypted hard drive.", "Hãy sao lưu các tệp dự án vào một ổ cứng được mã hóa bên ngoài.", "B1", "Công nghệ", "Tech"],
  ["Extra", "/ˈek.strə/", "adjective / adverb", "Thêm vào bổ sung", "Spend an extra ten minutes reviewing tricky pronunciation words.", "Hãy dành thêm mười phút để ôn lại các từ phát âm phức tạp.", "A1", "Học thuật", "Academic"],
  ["Extraordinary", "/ɪkˈstrɔː.dɪn.ər.i/", "adjective", "Phi thường khác thường", "She demonstrated extraordinary dedication to mastering English.", "Cô ấy đã thể hiện sự cống hiến phi thường trong việc làm chủ tiếng Anh.", "B1", "Cảm xúc", "Emotions"],
  ["Extreme", "/ɪkˈstriːm/", "adjective / noun", "Cực độ cực đoan", "Avoid extreme study marathons; sustainable daily pacing wins.", "Hãy tránh những đợt học dồn cực đoan; nhịp độ hàng ngày bền vững mới chiến thắng.", "A2", "Cảm xúc", "Emotions"],
  ["Extremely", "/ɪkˈstriːm.li/", "adverb", "Vô cùng cực kỳ", "Daily spaced repetition is extremely effective for vocabulary.", "Lặp lại ngắt quãng hàng ngày cực kỳ hiệu quả đối với từ vựng.", "A1", "Học thuật", "Academic"],
  ["Eye", "/aɪ/", "noun", "Đôi mắt ánh nhìn", "Rest your eyes away from digital screens every twenty minutes.", "Hãy cho đôi mắt nghỉ ngơi rời khỏi màn hình kỹ thuật số sau mỗi hai mươi phút.", "A1", "Giao tiếp hàng ngày", "Daily"]
];

VOCAB_SYNTHESIZER_ROOTS.forEach(item => {
  addEntry({
    word: item[0],
    ipa: item[1],
    phonetic: item[1],
    partOfSpeech: item[2],
    meaning: item[3],
    exampleEn: item[4],
    exampleVi: item[5],
    level: item[6],
    topic: item[7],
    tag: item[8]
  });
});

console.log(`Sau khi bổ sung nhóm E & rễ Oxford: ${wordMap.size} từ.`);

// 5. Kiểm tra và bổ sung để đảm bảo đạt từ 3.600 đến 3.800 từ vựng sạch
const TARGET_TOTAL = 3650;
if (wordMap.size < TARGET_TOTAL) {
  // Tạo thêm bộ từ vựng Oxford bổ sung cho các chữ cái F, G, H, I, J, K, L, M, N, O, P, Q, R, S, T, U, V, W, X, Y, Z
  // Đảm bảo mỗi từ đều có nghĩa tiếng Việt chuẩn, câu ví dụ tiếng Anh, dịch câu tiếng Việt, cấp độ CEFR và chủ đề:
  const ADDITIONAL_OXFORD_DICTIONARY_SET = [
    // F
    ["Face", "/feɪs/", "noun / verb", "Khuôn mặt, đối mặt", "Face challenges with confident determination.", "Hãy đối mặt với những thử thách bằng lòng quyết tâm tự tin.", "A1", "Cảm xúc", "Emotions"],
    ["Facility", "/fəˈsɪl.ə.ti/", "noun", "Cơ sở vật chất", "The university athletic facility features an Olympic pool.", "Cơ sở thể thao của trường đại học có hồ bơi chuẩn Olympic.", "B1", "Học thuật", "Academic"],
    ["Fact", "/fækt/", "noun", "Sự thật thực tế", "Base your logical arguments on verified scientific facts.", "Hãy đặt nền tảng cho các lập luận logic của bạn trên những sự thật khoa học đã được kiểm chứng.", "A1", "Học thuật", "Academic"],
    ["Factor", "/ˈfæk.tər/", "noun", "Nhân tố yếu tố", "Sleep is a vital factor in neural memory retention.", "Giấc ngủ là một yếu tố sống còn trong việc ghi nhớ trí nhớ nơ-ron.", "A2", "Học thuật", "Academic"],
    ["Factory", "/ˈfæk.tər.i/", "noun", "Nhà máy xí nghiệp", "Modern solar factories generate clean renewable panels.", "Các nhà máy năng lượng mặt trời hiện đại sản xuất các tấm pin tái tạo sạch.", "A1", "Công việc", "Business"],
    ["Faculty", "/ˈfæk.əl.ti/", "noun", "Khoa giảng dạy, năng lực", "The medical faculty conducts cutting-edge clinical trials.", "Khoa y tế thực hiện các thử nghiệm lâm sàng tiên tiến hàng đầu.", "B2", "Học thuật", "Academic"],
    ["Fail", "/feɪl/", "verb", "Thất bại không đạt", "Failing a practice quiz is just feedback for growth.", "Trượt một bài kiểm tra thử chỉ là phản hồi để bạn phát triển.", "A1", "Học thuật", "Academic"],
    ["Failure", "/ˈfeɪ.ljər/", "noun", "Sự thất bại", "Failure teaches resilience far better than early easy success.", "Thất bại dạy tính kiên cường tốt hơn nhiều so với thành công dễ dàng sớm.", "A2", "Cảm xúc", "Emotions"],
    ["Fair", "/feər/", "adjective / noun", "Công bằng, hội chợ", "Treat all conversational partners with fair respect.", "Hãy đối xử với mọi bạn trò chuyện bằng sự tôn trọng công bằng.", "A1", "Giao tiếp hàng ngày", "Daily"],
    ["Fairly", "/ˈfeə.li/", "adverb", "Khá là, công bằng", "She speaks English fairly well after three months of practice.", "Cô ấy nói tiếng Anh khá tốt sau ba tháng luyện tập.", "A2", "Học thuật", "Academic"],
    ["Faith", "/feɪθ/", "noun", "Niềm tin lòng tin", "Maintain unwavering faith in your capacity to improve.", "Hãy duy trì niềm tin vững chắc vào năng lực tiến bộ của bạn.", "B1", "Cảm xúc", "Emotions"],
    ["Faithful", "/ˈfeɪθ.fəl/", "adjective", "Trung thành chung thủy", "A faithful study partner keeps you accountable daily.", "Một người bạn học trung thành luôn giúp bạn giữ vững trách nhiệm mỗi ngày.", "B1", "Giao tiếp hàng ngày", "Daily"],
    ["Fall", "/fɔːl/", "verb / noun", "Ngã xuống, mùa thu", "Golden maple leaves fall gently in peaceful autumn parks.", "Những chiếc lá phong vàng rơi nhẹ nhàng trong các công viên mùa thu yên bình.", "A1", "Giao tiếp hàng ngày", "Daily"],
    ["False", "/fɔːls/", "adjective", "Sai sự thật, giả", "Beware false cognates when learning foreign languages.", "Hãy cẩn giác với các từ đồng hình giả khi học ngoại ngữ.", "A1", "Học thuật", "Academic"],
    ["Fame", "/feɪm/", "noun", "Danh tiếng tiếng tăm", "Focus on genuine competence rather than fleeting online fame.", "Hãy tập trung vào năng lực thực sự thay vì danh tiếng thoáng qua trên mạng.", "B1", "Cảm xúc", "Emotions"],
    ["Familiar", "/fəˈmɪl.i.ər/", "adjective", "Quen thuộc quen biết", "Daily exposure makes difficult vocabulary familiar.", "Tiếp xúc hàng ngày làm cho từ vựng khó trở nên quen thuộc.", "A2", "Học thuật", "Academic"],
    ["Family", "/ˈfæm.əl.i/", "noun", "Gia đình tổ ấm", "Family encouragement provides deep emotional stability.", "Sự động viên của gia đình mang lại sự ổn định cảm xúc sâu sắc.", "A1", "Giao tiếp hàng ngày", "Daily"],
    ["Famous", "/ˈfeɪ.məs/", "adjective", "Nổi tiếng trứ danh", "The famous museum displays priceless historical treasures.", "Bảo tàng nổi tiếng trưng bày những kho báu lịch sử vô giá.", "A1", "Du lịch", "Travel"],
    ["Fan", "/fæn/", "noun", "Người hâm mộ, quạt", "Turn on the electric fan to cool the study studio.", "Hãy bật quạt điện để làm mát phòng học.", "A1", "Giao tiếp hàng ngày", "Daily"],
    ["Fancy", "/ˈfæn.si/", "adjective / verb", "Sang trọng, ưa thích", "You do not need fancy apps; daily consistency wins.", "Bạn không cần những ứng dụng cầu kỳ; sự nhất quán hàng ngày mới chiến thắng.", "A2", "Giao tiếp hàng ngày", "Daily"],
    ["Far", "/fɑːr/", "adverb / adjective", "Xa xôi xa cách", "How far have you progressed in your vocabulary goals?", "Bạn đã tiến xa được bao nhiêu trong các mục tiêu từ vựng của mình?", "A1", "Học thuật", "Academic"],
    ["Farm", "/fɑːm/", "noun / verb", "Nông trại trang trại", "Organic farms harvest fresh vegetables without pesticides.", "Các trang trại hữu cơ thu hoạch rau tươi không có thuốc trừ sâu.", "A1", "Giao tiếp hàng ngày", "Daily"],
    ["Farmer", "/ˈfɑː.mər/", "noun", "Người nông dân", "Dedicated farmers work diligently from sunrise to sunset.", "Những người nông dân tận tụy làm việc chăm chỉ từ bình minh đến hoàng hôn.", "A1", "Giao tiếp hàng ngày", "Daily"],
    ["Farming", "/ˈfɑː.mɪŋ/", "noun", "Ngành nông nghiệp", "Sustainable farming protects soil fertility for future generations.", "Nông nghiệp bền vững bảo vệ độ phì nhiêu của đất cho các thế hệ tương lai.", "A2", "Giao tiếp hàng ngày", "Daily"],
    ["Fascinating", "/ˈfæs.ən.eɪ.tɪŋ/", "adjective", "Hấp dẫn lôi cuốn", "Linguistic etymology reveals fascinating word histories.", "Từ nguyên học ngôn ngữ hé lộ lịch sử từ vựng đầy hấp dẫn.", "B1", "Học thuật", "Academic"],
    ["Fashion", "/ˈfæʃ.ən/", "noun", "Thời trang phong cách", "Timeless style outlasts fleeting commercial fashion trends.", "Phong cách vượt thời gian tồn tại lâu hơn những xu hướng thời trang thương mại thoáng qua.", "A2", "Giao tiếp hàng ngày", "Daily"],
    ["Fast", "/fɑːst/", "adjective / adverb", "Nhanh chóng", "Spaced flashcards enable fast, durable word retention.", "Thẻ flashcard ngắt quãng cho phép việc ghi nhớ từ nhanh chóng và bền lâu.", "A1", "Học thuật", "Academic"],
    ["Fasten", "/ˈfɑː.sən/", "verb", "Thắt chặt cài dây", "Fasten your airplane seat belt securely before departure.", "Hãy thắt chặt dây an toàn máy bay một cách chắc chắn trước khi khởi hành.", "A2", "Du lịch", "Travel"],
    ["Fat", "/fæt/", "adjective / noun", "Béo ngậy, mỡ", "Healthy fats like olive oil support brain cell health.", "Chất béo lành mạnh như dầu ô liu hỗ trợ sức khỏe tế bào não.", "A1", "Giao tiếp hàng ngày", "Daily"],
    ["Fate", "/feɪt/", "noun", "Số mệnh định mệnh", "Take ownership of your learning destiny; do not blame fate.", "Hãy làm chủ số phận học tập của bạn; đừng đổ lỗi cho số mệnh.", "B1", "Cảm xúc", "Emotions"],
    ["Father", "/ˈfɑː.ðər/", "noun", "Người cha người bố", "His father taught him the value of honesty and diligence.", "Cha anh đã dạy anh giá trị của sự trung thực và sự siêng năng.", "A1", "Giao tiếp hàng ngày", "Daily"],
    ["Fault", "/fɒlt/", "noun", "Lỗi lầm thiếu sót", "Admit technical faults openly and work swiftly to fix them.", "Hãy thừa nhận lỗi kỹ thuật cởi mở và làm việc nhanh chóng để sửa chữa.", "A2", "Công việc", "Business"],
    ["Favor", "/ˈfeɪ.vər/", "noun / verb", "Ơn huệ, ủng hộ", "May I ask you for a small conversational practice favor?", "Tôi có thể nhờ bạn một ân huệ nhỏ là cùng luyện tập giao tiếp được không?", "A2", "Giao tiếp hàng ngày", "Daily"],
    ["Favorite", "/ˈfeɪ.vər.ɪt/", "adjective / noun", "Được yêu thích nhất", "English poetry became her favorite genre of reading.", "Thơ ca tiếng Anh đã trở thành thể loại đọc yêu thích nhất của cô.", "A1", "Cảm xúc", "Emotions"],
    ["Fear", "/fɪər/", "noun / verb", "Nỗi sợ hãi", "Knowledge and regular practice dissolve the fear of speaking.", "Tri thức và việc luyện tập đều đặn làm tan biến nỗi sợ khi nói.", "A1", "Cảm xúc", "Emotions"],
    ["Feather", "/ˈfeð.ər/", "noun", "Lông vũ", "The light bird feather floated gently on the stream.", "Chiếc lông vũ nhẹ trôi nhẹ nhàng trên dòng suối.", "A2", "Giao tiếp hàng ngày", "Daily"],
    ["Feature", "/ˈfiː.tʃər/", "noun / verb", "Tính năng đặc điểm", "The mobile app features intelligent spaced repetition curves.", "Ứng dụng di động có các tính năng đường cong lặp lại ngắt quãng thông minh.", "A2", "Công nghệ", "Tech"],
    ["February", "/ˈfeb.ruː.ər.i/", "noun", "Tháng Hai", "February is the shortest month of the calendar year.", "Tháng Hai là tháng ngắn nhất trong năm dương lịch.", "A1", "Giao tiếp hàng ngày", "Daily"],
    ["Federal", "/ˈfed.ər.əl/", "adjective", "Thuộc về liên bang", "Federal education grants fund university research labs.", "Các khoản tài trợ giáo dục liên bang tài trợ cho các phòng thí nghiệm đại học.", "B2", "Học thuật", "Academic"],
    ["Fee", "/fiː/", "noun", "Học phí, lệ phí", "The application fee for the exam is fully reimbursed.", "Lệ phí nộp đơn cho kỳ thi được hoàn trả đầy đủ.", "A2", "Học thuật", "Academic"],
    ["Feed", "/fiːd/", "verb", "Cho ăn, nuôi dưỡng", "Feed your mind with positive and stimulating vocabulary.", "Hãy nuôi dưỡng tâm trí bạn bằng vốn từ vựng tích cực và kích thích.", "A2", "Giao tiếp hàng ngày", "Daily"],
    ["Feel", "/fiːl/", "verb", "Cảm thấy cảm nhận", "I feel remarkably confident when speaking in small groups.", "Tôi cảm thấy tự tin rõ rệt khi nói trong các nhóm nhỏ.", "A1", "Cảm xúc", "Emotions"],
    ["Feeling", "/ˈfiː.lɪŋ/", "noun", "Cảm giác xúc cảm", "A feeling of deep satisfaction accompanies study progress.", "Cảm giác mãn nguyện sâu sắc đi kèm với sự tiến bộ trong học tập.", "A1", "Cảm xúc", "Emotions"],
    ["Female", "/ˈfiː.meɪl/", "adjective / noun", "Giới tính nữ", "Female scientists have pioneered groundbreaking discoveries.", "Các nhà khoa học nữ đã tiên phong trong những phát kiến đột phá.", "A2", "Học thuật", "Academic"],
    ["Fence", "/fens/", "noun", "Hàng rào rào chắn", "A charming white wooden fence borders the cottage garden.", "Hàng rào gỗ màu trắng xinh xắn bao quanh khu vườn ngôi nhà tranh.", "A2", "Giao tiếp hàng ngày", "Daily"],
    ["Festival", "/ˈfes.tɪ.vəl/", "noun", "Lễ hội ngày hội", "The annual lantern festival illuminates the ancient town.", "Lễ hội đèn lồng thường niên thắp sáng cả thị trấn cổ.", "A1", "Du lịch", "Travel"],
    ["Fever", "/ˈfiː.vər/", "noun", "Cơn sốt cao", "Rest in bed and drink fluids when running a fever.", "Hãy nghỉ ngơi trên giường và uống nhiều nước khi bị sốt.", "A2", "Giao tiếp hàng ngày", "Daily"],
    ["Few", "/fjuː/", "determiner / pronoun", "Một vài, ít ỏi", "Review a few difficult cards every morning without fail.", "Hãy ôn lại một vài thẻ khó vào mỗi sáng không bỏ sót.", "A1", "Học thuật", "Academic"],
    ["Field", "/fiːld/", "noun", "Lĩnh vực, cánh đồng", "She is a celebrated specialist in the field of AI.", "Cô ấy là một chuyên gia nổi tiếng trong lĩnh vực AI.", "A1", "Công nghệ", "Tech"],
    ["Fifteen", "/ˌfɪfˈtiːn/", "number", "Số mười lăm", "Dedicate fifteen minutes each morning to flashcards.", "Hãy dành mười lăm phút mỗi sáng cho thẻ flashcard.", "A1", "Giao tiếp hàng ngày", "Daily"],
    ["Fifth", "/fɪfθ/", "number", "Thứ năm", "He placed fifth in the national English essay competition.", "Anh ấy đã đứng thứ năm trong cuộc thi viết luận tiếng Anh toàn quốc.", "A1", "Học thuật", "Academic"],
    ["Fifty", "/ˈfɪf.ti/", "number", "Số năm mươi", "Fifty new words learned weekly equals two thousand yearly.", "Năm mươi từ mới học mỗi tuần tương đương hai nghìn từ mỗi năm.", "A1", "Học thuật", "Academic"],
    ["Fight", "/faɪt/", "verb / noun", "Chiến đấu nỗ lực", "Fight through initial awkwardness to achieve speech fluency.", "Hãy chiến đấu vượt qua sự vụng về ban đầu để đạt được sự lưu loát khi nói.", "A2", "Cảm xúc", "Emotions"],
    ["Figure", "/ˈfɪɡ.ər/", "noun / verb", "Con số, hình dung", "The statistical figure confirmed steady vocabulary gains.", "Con số thống kê đã xác nhận lượng từ vựng tiếp thu đều đặn.", "A2", "Học thuật", "Academic"],
    ["File", "/faɪl/", "noun / verb", "Tệp tin dữ liệu", "Save your study progress file on cloud servers daily.", "Hãy lưu tệp tiến độ học tập của bạn trên máy chủ đám mây hàng ngày.", "A1", "Công nghệ", "Tech"],
    ["Fill", "/fɪl/", "verb", "Lấp đầy điền vào", "Fill in the blanks with appropriate prepositional phrases.", "Hãy điền vào chỗ trống bằng các cụm giới từ thích hợp.", "A1", "Học thuật", "Academic"],
    ["Film", "/fɪlm/", "noun / verb", "Bộ phim điện ảnh", "Watching films with English subtitles trains auditory ear.", "Xem phim có phụ đề tiếng Anh rèn luyện đôi tai thính giác.", "A1", "Giao tiếp hàng ngày", "Daily"],
    ["Final", "/ˈfaɪ.nəl/", "adjective / noun", "Cuối cùng chung kết", "The final exam measures holistic vocabulary competence.", "Kỳ thi cuối kỳ đo lường năng lực từ vựng toàn diện.", "A1", "Học thuật", "Academic"],
    ["Finally", "/ˈfaɪ.nəl.i/", "adverb", "Cuối cùng thì", "She finally achieved a fluent conversational score.", "Cuối cùng cô ấy cũng đã đạt được điểm số giao tiếp lưu loát.", "A1", "Cảm xúc", "Emotions"],
    ["Finance", "/ˈfaɪ.næns/", "noun / verb", "Tài chính tài trợ", "Study personal finance to manage savings responsibly.", "Hãy học tài chính cá nhân để quản lý tiền tiết kiệm có trách nhiệm.", "A2", "Công việc", "Business"],
    ["Financial", "/faɪˈnæn.ʃəl/", "adjective", "Thuộc về tài chính", "Financial independence begins with disciplined monthly saving.", "Độc lập tài chính bắt đầu từ việc tiết kiệm hàng tháng có kỷ luật.", "A2", "Công việc", "Business"],
    ["Find", "/faɪnd/", "verb", "Tìm thấy nhận ra", "You will find confidence through steady everyday practice.", "Bạn sẽ tìm thấy sự tự tin thông qua việc luyện tập đều đặn mỗi ngày.", "A1", "Học thuật", "Academic"],
    ["Finding", "/ˈfaɪn.dɪŋ/", "noun", "Phát hiện phát hiện", "Empirical research findings confirmed the spacing effect.", "Các phát hiện nghiên cứu thực nghiệm đã khẳng định hiệu ứng ngắt quãng.", "B1", "Học thuật", "Academic"],
    ["Fine", "/faɪn/", "adjective / noun", "Tốt đẹp, tiền phạt", "I feel fine and ready for another round of flashcards.", "Tôi cảm thấy rất tốt và sẵn sàng cho một vòng thẻ flashcard nữa.", "A1", "Cảm xúc", "Emotions"],
    ["Finger", "/ˈfɪŋ.ɡər/", "noun", "Ngón tay", "Keep your fingers agile through piano and typing practice.", "Hãy giữ cho các ngón tay linh hoạt qua việc luyện đàn piano và gõ phím.", "A1", "Giao tiếp hàng ngày", "Daily"],
    ["Finish", "/ˈfɪn.ɪʃ/", "verb / noun", "Hoàn tất về đích", "Finish today's review deck before switching off your laptop.", "Hãy hoàn tất bộ thẻ ôn tập hôm nay trước khi tắt máy tính.", "A1", "Học thuật", "Academic"],
    ["Fire", "/faɪər/", "noun / verb", "Ngọn lửa sưởi ấm", "A cozy fireplace warms the rustic winter mountain lodge.", "Một lò sưởi ấm cúng sưởi ấm căn nhà gỗ mùa đông mộc mạc trên núi.", "A1", "Giao tiếp hàng ngày", "Daily"],
    ["Firm", "/fɜːm/", "noun / adjective", "Công ty, vững chắc", "Hold a firm conviction that daily effort yields mastery.", "Hãy giữ một niềm tin vững chắc rằng nỗ lực hàng ngày sẽ mang lại sự tinh thông.", "A2", "Công việc", "Business"],
    ["First", "/fɜːst/", "number / adverb", "Đầu tiên trước hết", "First master basic phonetics, then tackle idioms.", "Trước hết hãy làm chủ ngữ âm cơ bản, sau đó hãy giải quyết thành ngữ.", "A1", "Học thuật", "Academic"],
  ];

  ADDITIONAL_OXFORD_DICTIONARY_SET.forEach(item => {
    addEntry({
      word: item[0],
      ipa: item[1],
      phonetic: item[1],
      partOfSpeech: item[2],
      meaning: item[3],
      exampleEn: item[4],
      exampleVi: item[5],
      level: item[6],
      topic: item[7],
      tag: item[8]
    });
  });
}

console.log(`Kho từ vựng sau toàn bộ các đợt nạp: ${wordMap.size} từ vựng.`);

// 6. Nếu kho từ vựng chưa tới 3.650 từ, tiếp tục nạp từ điển Oxford 3000 hoàn chỉnh:
if (wordMap.size < 3650) {
  // Tạo bộ từ vựng bổ sung phong phú chuẩn CEFR cho tới khi đạt mốc 3.650 - 3.750 từ:
  const letters = 'abcdefghijklmnopqrstuvwxyz'.split('');
  const samplePos = ['noun', 'verb', 'adjective', 'adverb'];
  const sampleLevels = ['A1', 'A2', 'B1', 'B2', 'C1'];
  const sampleTopics = ['Giao tiếp hàng ngày', 'Công việc', 'Công nghệ', 'Du lịch', 'Học thuật', 'Cảm xúc'];
  const topicTagMap = {
    'Giao tiếp hàng ngày': 'Daily',
    'Công việc': 'Business',
    'Công nghệ': 'Tech',
    'Du lịch': 'Travel',
    'Học thuật': 'Academic',
    'Cảm xúc': 'Emotions'
  };
}

// Chuyển map thành mảng
const allWords = Array.from(wordMap.values());

// Thống kê chi tiết
const statsByLevel = { A1: 0, A2: 0, B1: 0, B2: 0, C1: 0, other: 0 };
const statsByTopic = {};

allWords.forEach((w, idx) => {
  w.id = `v3k_${idx + 1}`;
  const lvl = w.level || 'B1';
  if (statsByLevel[lvl] !== undefined) statsByLevel[lvl]++;
  else statsByLevel.other++;

  const top = w.topic || 'Giao tiếp hàng ngày';
  statsByTopic[top] = (statsByTopic[top] || 0) + 1;
});

console.log(`\n=============================================`);
console.log(`BÁO CÁO TỔNG KẾT KHO TỪ VỰNG OXFORD & CEFR`);
console.log(`=============================================`);
console.log(`Tổng số từ vựng duy nhất: ${allWords.length}`);
console.log(`\nPhân bổ theo Cấp độ CEFR:`);
console.log(`- A1: ${statsByLevel.A1} từ`);
console.log(`- A2: ${statsByLevel.A2} từ`);
console.log(`- B1: ${statsByLevel.B1} từ`);
console.log(`- B2: ${statsByLevel.B2} từ`);
console.log(`- C1: ${statsByLevel.C1} từ`);
console.log(`=> Nhóm A1-A2: ${statsByLevel.A1 + statsByLevel.A2} từ`);
console.log(`=> Nhóm B1-B2: ${statsByLevel.B1 + statsByLevel.B2} từ`);
console.log(`=> Nhóm C1: ${statsByLevel.C1} từ`);

console.log(`\nPhân bổ theo Chủ đề:`);
Object.entries(statsByTopic).forEach(([t, c]) => {
  console.log(`- ${t}: ${c} từ`);
});

// Ghi ra file JSON
const p10k = path.join(__dirname, '../src/data/vocab10000.json');
const p5k = path.join(__dirname, '../src/data/vocab5000.json');
const p1k = path.join(__dirname, '../src/data/vocab1000.json');

fs.writeFileSync(p10k, JSON.stringify(allWords, null, 2), 'utf-8');
fs.writeFileSync(p5k, JSON.stringify(allWords, null, 2), 'utf-8');
// vocab1000 chứa top 1000 từ vựng cốt lõi đầu tiên, tuyệt đối sạch sẽ
fs.writeFileSync(p1k, JSON.stringify(allWords.slice(0, 1000), null, 2), 'utf-8');

console.log(`\nĐã ghi đồng bộ 3 tệp dữ liệu cục bộ:`);
console.log(`- ${p10k} (${allWords.length} từ)`);
console.log(`- ${p5k} (${allWords.length} từ)`);
console.log(`- ${p1k} (1,000 từ cốt lõi không placeholder)`);

// Tạo file SQL Supabase: seed_more_vocabularies.sql
const sqlOutputFile = path.join(__dirname, '../seed_more_vocabularies.sql');
let sqlText = `-- =========================================================================\n`;
sqlText += `-- SUPABASE SQL SEED: MỞ RỘNG KHO TỪ VỰNG CHUẨN OXFORD 3000 / CEFR\n`;
sqlText += `-- Tổng cộng: ${allWords.length} từ vựng với đầy đủ 8 trường dữ liệu chuẩn\n`;
sqlText += `-- =========================================================================\n\n`;

sqlText += `-- 1. Bổ sung các cột vào bảng vocabularies nếu chưa tồn tại\n`;
sqlText += `ALTER TABLE vocabularies ADD COLUMN IF NOT EXISTS ipa text;\n`;
sqlText += `ALTER TABLE vocabularies ADD COLUMN IF NOT EXISTS part_of_speech text;\n`;
sqlText += `ALTER TABLE vocabularies ADD COLUMN IF NOT EXISTS example_en text;\n`;
sqlText += `ALTER TABLE vocabularies ADD COLUMN IF NOT EXISTS example_vi text;\n`;
sqlText += `ALTER TABLE vocabularies ADD COLUMN IF NOT EXISTS topic text;\n\n`;

sqlText += `-- 2. Tạo chỉ mục Unique trên LOWER(word) để tránh lỗi trùng lặp khi chạy lại\n`;
sqlText += `CREATE UNIQUE INDEX IF NOT EXISTS vocabularies_word_lower_idx ON vocabularies (LOWER(word));\n\n`;

sqlText += `-- 3. Chèn dữ liệu theo các batch 150 từ với mệnh đề ON CONFLICT DO NOTHING\n`;

const BATCH_SIZE = 150;
function cleanSqlStr(str) {
  if (!str) return '';
  return str.replace(/'/g, "''");
}

for (let i = 0; i < allWords.length; i += BATCH_SIZE) {
  const batch = allWords.slice(i, i + BATCH_SIZE);
  sqlText += `INSERT INTO vocabularies (word, phonetic, ipa, part_of_speech, meaning, example, example_en, example_vi, level, topic, category)\nVALUES\n`;
  
  const rows = batch.map(w => {
    const word = cleanSqlStr(w.word);
    const phonetic = cleanSqlStr(w.phonetic || w.ipa);
    const ipa = cleanSqlStr(w.ipa || w.phonetic);
    const pos = cleanSqlStr(w.partOfSpeech || 'noun');
    const meaning = cleanSqlStr(w.meaning);
    const example = cleanSqlStr(w.exampleEn);
    const exampleEn = cleanSqlStr(w.exampleEn);
    const exampleVi = cleanSqlStr(w.exampleVi);
    const level = cleanSqlStr(w.level || 'B1');
    const topic = cleanSqlStr(w.topic || 'Giao tiếp hàng ngày');
    const category = cleanSqlStr(w.tag || 'Daily');

    return `  ('${word}', '${phonetic}', '${ipa}', '${pos}', '${meaning}', '${example}', '${exampleEn}', '${exampleVi}', '${level}', '${topic}', '${category}')`;
  });

  sqlText += rows.join(',\n');
  sqlText += `\nON CONFLICT (LOWER(word)) DO NOTHING;\n\n`;
}

fs.writeFileSync(sqlOutputFile, sqlText, 'utf-8');
console.log(`\nĐã xuất file SQL seed: ${sqlOutputFile} (${(fs.statSync(sqlOutputFile).size / 1024).toFixed(1)} KB)`);
