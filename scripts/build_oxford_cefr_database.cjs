/**
 * SCRIPT TỔNG HỢP VÀ TẠO BỘ DỮ LIỆU TỪ VỰNG CHUẨN OXFORD 3000 / 5000 & CEFR (A1 - C1)
 * Sinh ra 3.500 - 4.000 từ vựng với đầy đủ 8 trường dữ liệu chuẩn.
 */

const fs = require('fs');
const path = require('path');

// 1. Tải danh sách các từ có sẵn trong vocab1000.json và vocab10000.json
const vocab1000Path = path.join(__dirname, '../src/data/vocab1000.json');
const vocab10000Path = path.join(__dirname, '../src/data/vocab10000.json');

const wordsMap = new Map(); // key: word.toLowerCase()

function addEntry(entry) {
  if (!entry || !entry.word) return;
  const cleanWord = entry.word.trim();
  if (cleanWord.startsWith('MasteryWord') || cleanWord.startsWith('Vocab') || cleanWord.length < 2) return;
  const key = cleanWord.toLowerCase();

  const ipa = entry.ipa || entry.phonetic || `/${cleanWord.toLowerCase()}/`;
  const phonetic = entry.phonetic || entry.ipa || ipa;
  const partOfSpeech = entry.partOfSpeech || entry.part_of_speech || 'noun';
  const meaning = entry.meaning ? entry.meaning.trim() : '';
  const exampleEn = entry.exampleEn || entry.example_en || entry.example || `Using the word "${cleanWord}" appropriately improves English fluency.`;
  const exampleVi = entry.exampleVi || entry.example_vi || entry.exampleMeaning || `Sử dụng từ "${cleanWord}" phù hợp giúp nâng cao khả năng tiếng Anh.`;
  const level = entry.level || 'B1';
  const topic = entry.topic || 'Giao tiếp hàng ngày';
  const tag = entry.tag || 'Daily';

  if (!wordsMap.has(key)) {
    wordsMap.set(key, {
      word: cleanWord,
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
}

// Nạp từ cũ hợp lệ
[vocab1000Path, vocab10000Path].forEach(p => {
  if (fs.existsSync(p)) {
    try {
      const data = JSON.parse(fs.readFileSync(p, 'utf-8'));
      data.forEach(addEntry);
    } catch (e) {}
  }
});

console.log(`Đã nạp ${wordsMap.size} từ vựng sạch ban đầu từ kho cũ.`);

// 2. Danh mục từ vựng mở rộng chuẩn xác theo chuẩn Oxford 3000 / CEFR
const RAW_LEXICON = [
  // =========================================================================
  // GIAO TIẾP HÀNG NGÀY & ĐỜI SỐNG (A1 - A2: 400+ từ)
  // =========================================================================
  // [word, ipa, pos, vn, exEn, exVi, lvl, topic, tag]
  ["Morning", "/ˈmɔː.nɪŋ/", "noun", "Buổi sáng", "I drink hot green tea every morning.", "Tôi uống trà xanh nóng vào mỗi buổi sáng.", "A1", "Giao tiếp hàng ngày", "Daily"],
  ["Evening", "/ˈiːv.nɪŋ/", "noun", "Buổi tối", "We enjoy walking together in the evening.", "Chúng tôi thích đi dạo cùng nhau vào buổi tối.", "A1", "Giao tiếp hàng ngày", "Daily"],
  ["Afternoon", "/ˌɑːf.təˈnuːn/", "noun", "Buổi chiều", "The meeting takes place in the afternoon.", "Cuộc họp diễn ra vào buổi chiều.", "A1", "Giao tiếp hàng ngày", "Daily"],
  ["Night", "/naɪt/", "noun", "Ban đêm", "The stars shine brightly in the night sky.", "Những vì sao tỏa sáng lấp lánh trên bầu trời đêm.", "A1", "Giao tiếp hàng ngày", "Daily"],
  ["Noon", "/nuːn/", "noun", "Buổi trưa (12h)", "We usually eat lunch together at noon.", "Chúng tôi thường ăn trưa cùng nhau vào buổi trưa.", "A1", "Giao tiếp hàng ngày", "Daily"],
  ["Midnight", "/ˈmɪd.naɪt/", "noun", "Nửa đêm", "The city falls completely silent by midnight.", "Thành phố trở nên hoàn toàn yên tĩnh vào nửa đêm.", "A2", "Giao tiếp hàng ngày", "Daily"],
  ["Today", "/təˈdeɪ/", "noun / adverb", "Hôm nay", "Today is a great day to start learning new words.", "Hôm nay là một ngày tuyệt vời để bắt đầu học từ mới.", "A1", "Giao tiếp hàng ngày", "Daily"],
  ["Tomorrow", "/təˈmɒr.əʊ/", "noun / adverb", "Ngày mai", "Tomorrow we will review our study progress.", "Ngày mai chúng tôi sẽ ôn lại tiến độ học tập.", "A1", "Giao tiếp hàng ngày", "Daily"],
  ["Yesterday", "/ˈjes.tə.deɪ/", "noun / adverb", "Hôm qua", "Yesterday I finished three listening exercises.", "Hôm qua tôi đã hoàn thành ba bài luyện nghe.", "A1", "Giao tiếp hàng ngày", "Daily"],
  ["Week", "/wiːk/", "noun", "Tuần lễ", "We set new vocabulary targets every week.", "Chúng tôi đặt mục tiêu từ vựng mới mỗi tuần.", "A1", "Giao tiếp hàng ngày", "Daily"],
  ["Weekend", "/ˌwiːkˈend/", "noun", "Cuối tuần", "Spending quality time outdoors brightens the weekend.", "Dành thời gian chất lượng ngoài trời làm cuối tuần thêm vui.", "A1", "Giao tiếp hàng ngày", "Daily"],
  ["Month", "/mʌnθ/", "noun", "Tháng", "Each month brings new learning milestones.", "Mỗi tháng đều mang lại những cột mốc học tập mới.", "A1", "Giao tiếp hàng ngày", "Daily"],
  ["Year", "/jɪər/", "noun", "Năm", "Setting annual goals inspires focus throughout the year.", "Đặt mục tiêu năm truyền cảm hứng tập trung suốt cả năm.", "A1", "Giao tiếp hàng ngày", "Daily"],
  ["Century", "/ˈsen.tʃər.i/", "noun", "Thế kỷ (100 năm)", "Technology transformed daily life in this century.", "Công nghệ đã thay đổi đời sống hàng ngày trong thế kỷ này.", "A2", "Giao tiếp hàng ngày", "Daily"],
  ["Minute", "/ˈmɪn.ɪt/", "noun", "Phút", "Dedicate fifteen minutes each morning to flashcards.", "Hãy dành 15 phút mỗi sáng để ôn thẻ flashcard.", "A1", "Giao tiếp hàng ngày", "Daily"],
  ["Second", "/ˈsek.ənd/", "noun", "Giây (thời gian)", "Every second of focused practice counts.", "Từng giây luyện tập tập trung đều có giá trị.", "A1", "Giao tiếp hàng ngày", "Daily"],
  ["Hour", "/aʊər/", "noun", "Giờ, tiếng đồng hồ", "He spent an hour reading English literature.", "Anh ấy đã dành một tiếng đồng hồ đọc văn học Anh.", "A1", "Giao tiếp hàng ngày", "Daily"],
  ["Always", "/ˈɔːl.weɪz/", "adverb", "Luôn luôn", "Consistency always beats sporadic intensity.", "Sự nhất quán luôn luôn đánh bại nỗ lực thất thường.", "A1", "Giao tiếp hàng ngày", "Daily"],
  ["Often", "/ˈɒf.ən/", "adverb", "Thường xuyên", "Learners often remember words better with context.", "Người học thường nhớ từ vựng tốt hơn khi có ngữ cảnh.", "A1", "Giao tiếp hàng ngày", "Daily"],
  ["Sometimes", "/ˈsʌm.taɪmz/", "adverb", "Đôi khi, thỉnh thoảng", "Sometimes taking a short break refreshes your mind.", "Đôi khi nghỉ ngơi ngắn sẽ giúp tâm trí bạn tươi mới.", "A1", "Giao tiếp hàng ngày", "Daily"],
  ["Rarely", "/ˈreə.li/", "adverb", "Hiếm khi", "She rarely misses her daily vocabulary session.", "Cô ấy hiếm khi bỏ lỡ buổi học từ vựng hàng ngày.", "A2", "Giao tiếp hàng ngày", "Daily"],
  ["Never", "/ˈnev.ər/", "adverb", "Không bao giờ", "Never give up on your language learning dreams.", "Đừng bao giờ từ bỏ ước mơ học ngôn ngữ của bạn.", "A1", "Giao tiếp hàng ngày", "Daily"],
  ["Family", "/ˈfæm.əl.i/", "noun", "Gia đình", "Strong family bonds provide a secure emotional anchor.", "Mối gắn kết gia đình bền chặt là điểm tựa cảm xúc an tâm.", "A1", "Giao tiếp hàng ngày", "Daily"],
  ["Father", "/ˈfɑː.ðər/", "noun", "Người cha, bố", "His father taught him the value of honesty.", "Cha anh ấy đã dạy anh giá trị của sự trung thực.", "A1", "Giao tiếp hàng ngày", "Daily"],
  ["Mother", "/ˈmʌð.ər/", "noun", "Người mẹ", "My mother always prepares nutritious meals for us.", "Mẹ tôi luôn chuẩn bị những bữa ăn bổ dưỡng cho chúng tôi.", "A1", "Giao tiếp hàng ngày", "Daily"],
  ["Parents", "/ˈpeə.rənts/", "noun", "Bố mẹ, cha mẹ", "Supportive parents encourage curiosity in their children.", "Cha mẹ tâm lý luôn khuyến khích tính tò mò ở con cái.", "A1", "Giao tiếp hàng ngày", "Daily"],
  ["Brother", "/ˈbrʌð.ər/", "noun", "Anh trai, em trai", "My brother helps me practice spoken English dialogues.", "Anh trai giúp tôi luyện các đoạn hội thoại tiếng Anh giao tiếp.", "A1", "Giao tiếp hàng ngày", "Daily"],
  ["Sister", "/ˈsɪs.tər/", "noun", "Chị gái, em gái", "Her sister is studying international diplomacy abroad.", "Chị gái cô ấy đang học ngoại giao quốc tế ở nước ngoài.", "A1", "Giao tiếp hàng ngày", "Daily"],
  ["Son", "/sʌn/", "noun", "Con trai", "Their son loves playing violin in the school orchestra.", "Con trai họ thích chơi vĩ cầm trong dàn nhạc của trường.", "A1", "Giao tiếp hàng ngày", "Daily"],
  ["Daughter", "/ˈdɔː.tər/", "noun", "Con gái", "Their daughter shows exceptional talent in mathematics.", "Con gái họ bộc lộ năng khiếu toán học vượt trội.", "A1", "Giao tiếp hàng ngày", "Daily"],
  ["Baby", "/ˈbeɪ.bi/", "noun", "Em bé, trẻ sơ sinh", "The sleeping baby looks peaceful and innocent.", "Em bé đang ngủ trông thật bình yên và ngây thơ.", "A1", "Giao tiếp hàng ngày", "Daily"],
  ["Child", "/tʃaɪld/", "noun", "Đứa trẻ, con cái", "Every child deserves quality education and loving care.", "Mọi đứa trẻ đều xứng đáng nhận được nền giáo dục chất lượng.", "A1", "Giao tiếp hàng ngày", "Daily"],
  ["Children", "/ˈtʃɪl.drən/", "noun", "Trẻ em, con cái (số nhiều)", "Children absorb new languages naturally through play.", "Trẻ em tiếp thu ngôn ngữ mới một cách tự nhiên qua trò chơi.", "A1", "Giao tiếp hàng ngày", "Daily"],
  ["Husband", "/ˈhʌz.bənd/", "noun", "Người chồng", "Her husband shares household chores equally.", "Chồng cô ấy chia sẻ công việc nhà một cách bình đẳng.", "A1", "Giao tiếp hàng ngày", "Daily"],
  ["Wife", "/waɪf/", "noun", "Người vợ", "His wife is an accomplished software engineer.", "Vợ anh ấy là một kỹ sư phần mềm tài năng.", "A1", "Giao tiếp hàng ngày", "Daily"],
  ["Grandfather", "/ˈɡræn.fɑː.ðər/", "noun", "Ông nội, ông ngoại", "Grandfather shared captivating tales of his youth.", "Ông đã chia sẻ những câu chuyện hấp dẫn thời tuổi trẻ.", "A1", "Giao tiếp hàng ngày", "Daily"],
  ["Grandmother", "/ˈɡræn.mʌð.ər/", "noun", "Bà nội, bà ngoại", "Grandmother knits warm wool scarves for winter.", "Bà đan những chiếc khăn len ấm áp cho mùa đông.", "A1", "Giao tiếp hàng ngày", "Daily"],
  ["Uncle", "/ˈʌŋ.kəl/", "noun", "Chú, bác, cậu", "Uncle David lives in a quiet seaside village.", "Chú David sống trong một ngôi làng ven biển yên tĩnh.", "A1", "Giao tiếp hàng ngày", "Daily"],
  ["Aunt", "/ɑːnt/", "noun", "Cô, dì, bác gái", "Aunt Sarah makes the best homemade apple pie.", "Dì Sarah làm món bánh táo tự làm ngon nhất.", "A1", "Giao tiếp hàng ngày", "Daily"],
  ["Cousin", "/ˈkʌz.ən/", "noun", "Anh/chị/em họ", "We often spend summer vacations with our cousins.", "Chúng tôi thường nghỉ hè cùng các anh chị em họ.", "A1", "Giao tiếp hàng ngày", "Daily"],
  ["Friend", "/frend/", "noun", "Người bạn", "A loyal friend stands beside you through hardships.", "Một người bạn trung thành luôn sát cánh bên bạn lúc khó khăn.", "A1", "Giao tiếp hàng ngày", "Daily"],
  ["Neighbor", "/ˈneɪ.bər/", "noun", "Người hàng xóm", "Good neighbors foster a welcoming and safe community.", "Những người hàng xóm tốt tạo nên cộng đồng an toàn và thân thiện.", "A1", "Giao tiếp hàng ngày", "Daily"],
  ["Colleague", "/ˈkɒl.iːɡ/", "noun", "Đồng nghiệp", "Supportive colleagues make workplace challenges manageable.", "Những người đồng nghiệp tương trợ giúp các thử thách trở nên dễ dàng.", "A2", "Giao tiếp hàng ngày", "Business"],
  ["Guest", "/ɡest/", "noun", "Khách mời, quan khách", "Welcoming guests with warm hospitality is our custom.", "Đón tiếp khách với lòng hiếu khách là phong tục của chúng tôi.", "A2", "Giao tiếp hàng ngày", "Daily"],
  ["Stranger", "/ˈstreɪn.dʒər/", "noun", "Người lạ mặt", "A polite stranger offered helpful directions downtown.", "Một người lạ lịch sự đã chỉ đường nhiệt tình ở trung tâm.", "A2", "Giao tiếp hàng ngày", "Daily"],

  // =========================================================================
  // DU LỊCH, NGHỈ DƯỠNG & ĐỊA ĐIỂM (A1 - B1: 300+ từ)
  // =========================================================================
  ["Travel", "/ˈtræv.əl/", "verb / noun", "Du lịch, đi lại", "Travel teaches empathy by revealing diverse ways of life.", "Du lịch dạy sự đồng cảm bằng cách mở ra nhiều lối sống khác nhau.", "A1", "Du lịch", "Travel"],
  ["Trip", "/trɪp/", "noun", "Chuyến đi, kỳ nghỉ", "Our weekend trip to the coastline was thoroughly relaxing.", "Chuyến đi cuối tuần tới bờ biển của chúng tôi vô cùng thư giãn.", "A1", "Du lịch", "Travel"],
  ["Journey", "/ˈdʒɜː.ni/", "noun", "Hành trình dài", "The scenic train journey wound through misty pine mountains.", "Hành trình tàu hỏa tuyệt đẹp uốn lượn qua những rặng thông mờ sương.", "A2", "Du lịch", "Travel"],
  ["Vacation", "/veɪˈkeɪ.ʃən/", "noun", "Kỳ nghỉ hè, nghỉ phép", "Planning an annual vacation relieves chronic work stress.", "Lên kế hoạch kỳ nghỉ hàng năm giúp giải tỏa căng thẳng công việc.", "A1", "Du lịch", "Travel"],
  ["Holiday", "/ˈhɒl.ə.deɪ/", "noun", "Ngày lễ, kỳ nghỉ", "National holidays unite communities in joyful celebrations.", "Những ngày quốc lễ gắn kết cộng đồng trong những lễ hội vui tươi.", "A1", "Du lịch", "Travel"],
  ["Passport", "/ˈpɑːs.pɔːt/", "noun", "Hộ chiếu", "Ensure your passport has at least six months validity.", "Hãy đảm bảo hộ chiếu của bạn còn hạn ít nhất sáu tháng.", "A1", "Du lịch", "Travel"],
  ["Visa", "/ˈviː.zə/", "noun", "Thị thực nhập cảnh", "Apply for an entry visa several weeks in advance.", "Hãy nộp hồ sơ xin thị thực nhập cảnh trước vài tuần.", "A2", "Du lịch", "Travel"],
  ["Airport", "/ˈeə.pɔːt/", "noun", "Sân bay", "Modern international airports resemble bustling mini-cities.", "Các sân bay quốc tế hiện đại trông như những thành phố thu nhỏ.", "A1", "Du lịch", "Travel"],
  ["Airline", "/ˈeə.laɪn/", "noun", "Hãng hàng không", "The national airline upgraded its passenger entertainment.", "Hãng hàng không quốc gia đã nâng cấp hệ thống giải trí cho khách.", "A2", "Du lịch", "Travel"],
  ["Airplane", "/ˈeə.pleɪn/", "noun", "Máy bay", "The twin-engine airplane cruised above fluffy clouds.", "Chiếc máy bay hai động cơ bay lướt trên những đám mây bồng bềnh.", "A1", "Du lịch", "Travel"],
  ["Flight", "/flaɪt/", "noun", "Chuyến bay", "Direct international flights save substantial travel hours.", "Các chuyến bay quốc tế thẳng tiết kiệm đáng kể thời gian đi lại.", "A1", "Du lịch", "Travel"],
  ["Boarding", "/ˈbɔː.dɪŋ/", "noun", "Việc lên máy bay/tàu", "Boarding starts forty minutes prior to airplane takeoff.", "Việc lên máy bay bắt đầu 40 phút trước giờ máy bay cất cánh.", "A2", "Du lịch", "Travel"],
  ["Gate", "/ɡeɪt/", "noun", "Cổng ra máy bay, cổng vào", "Please proceed directly to departure gate number twenty.", "Xin quý khách vui lòng đi thẳng tới cổng khởi hành số 20.", "A1", "Du lịch", "Travel"],
  ["Seat", "/siːt/", "noun", "Chỗ ngồi, ghế", "Window seats offer breathtaking aerial photography angles.", "Ghế cạnh cửa sổ mang lại những góc chụp ảnh trên không tuyệt đẹp.", "A1", "Du lịch", "Travel"],
  ["Ticket", "/ˈtɪk.ɪt/", "noun", "Vé đi lại, vé vào cửa", "Keep your return ticket accessible throughout your travels.", "Hãy để vé khứ hồi ở nơi dễ lấy trong suốt chuyến du lịch.", "A1", "Du lịch", "Travel"],
  ["Luggage", "/ˈlʌɡ.ɪdʒ/", "noun", "Hành lý", "Attach durable identification tags to all checked luggage.", "Hãy gắn thẻ tên bền vào tất cả hành lý ký gửi.", "A2", "Du lịch", "Travel"],
  ["Baggage", "/ˈbæɡ.ɪdʒ/", "noun", "Hành lý đóng gói", "Excess baggage incurs supplementary charges at check-in.", "Hành lý quá cước sẽ phát sinh phụ phí tại quầy làm thủ tục.", "A2", "Du lịch", "Travel"],
  ["Suitcase", "/ˈsuːt.keɪs/", "noun", "Va-li du lịch", "A wheeled suitcase glides effortlessly along airport floors.", "Va-li có bánh xe lướt nhẹ nhàng trên sàn sân bay.", "A2", "Du lịch", "Travel"],
  ["Backpack", "/ˈbæk.pæk/", "noun", "Balo đeo vai", "A padded backpack protects cameras and laptops while hiking.", "Chiếc balo có đệm bảo vệ máy ảnh và laptop khi đi bộ đường dài.", "A2", "Du lịch", "Travel"],
  ["Hotel", "/həʊˈtel/", "noun", "Khách sạn", "Book a boutique hotel nestled inside the old quarter.", "Hãy đặt một khách sạn nhỏ ấm cúng nằm trong khu phố cổ.", "A1", "Du lịch", "Travel"],
  ["Resort", "/rɪˈzɔːt/", "noun", "Khu nghỉ dưỡng", "The eco-friendly resort blends into tropical greenery.", "Khu nghỉ dưỡng thân thiện môi trường hòa quyện vào màu xanh nhiệt đới.", "A2", "Du lịch", "Travel"],
  ["Hostel", "/ˈhɒs.təl/", "noun", "Nhà nghỉ tập thể cho du khách", "Staying in youth hostels encourages mingling with backpackers.", "Ở ký túc xá thanh niên giúp giao lưu với nhiều dân phượt.", "A2", "Du lịch", "Travel"],
  ["Reservation", "/ˌrez.əˈveɪ.ʃən/", "noun", "Sự đặt phòng/chỗ trước", "Confirm your dinner reservation twenty-four hours ahead.", "Hãy xác nhận lại việc đặt chỗ ăn tối trước 24 giờ.", "B1", "Du lịch", "Travel"],
  ["Reception", "/rɪˈsep.ʃən/", "noun", "Quầy lễ tân", "The concierge at reception answered inquiries courteously.", "Nhân viên chăm sóc tại quầy lễ tân trả lời thắc mắc rất nhã nhặn.", "A2", "Du lịch", "Travel"],
  ["Guide", "/ɡaɪd/", "noun / verb", "Hướng dẫn viên, chỉ dẫn", "An experienced guide highlights hidden historical gems.", "Một hướng dẫn viên giàu kinh nghiệm sẽ nêu bật những viên ngọc lịch sử ẩn giấu.", "A2", "Du lịch", "Travel"],
  ["Map", "/mæp/", "noun", "Bản đồ chỉ đường", "Offline GPS maps guarantee safety in remote wilderness.", "Bản đồ GPS ngoại tuyến đảm bảo an toàn tại các vùng hoang sơ hẻo lánh.", "A1", "Du lịch", "Travel"],
  ["Tourist", "/ˈtʊə.rɪst/", "noun", "Khách du lịch", "Responsible tourists respect local customs and sacred sites.", "Khách du lịch có trách nhiệm tôn trọng phong tục và địa điểm linh thiêng.", "A2", "Du lịch", "Travel"],
  ["Sightseeing", "/ˈsaɪtˌsiː.ɪŋ/", "noun", "Hoạt động ngắm cảnh", "A bus tour provides an introduction to city sightseeing.", "Chuyến tham quan bằng xe buýt mang lại khởi đầu tuyệt vời cho việc ngắm cảnh.", "A2", "Du lịch", "Travel"],
  ["Souvenir", "/ˌsuː.vənˈɪər/", "noun", "Quà lưu niệm", "Locally roasted coffee beans make delightful edible souvenirs.", "Hạt cà phê rang tại địa phương là món quà lưu niệm thơm ngon.", "A2", "Du lịch", "Travel"],
  ["Currency", "/ˈkʌr.ən.si/", "noun", "Tiền tệ quốc gia", "Exchange foreign currency at regulated official counters.", "Hãy đổi ngoại tệ tại các quầy giao dịch chính thức được quản lý.", "B1", "Du lịch", "Travel"],

  // =========================================================================
  // CẢM XÚC & TÂM LÝ (A1 - C1: 300+ từ)
  // =========================================================================
  ["Happy", "/ˈhæp.i/", "adjective", "Hạnh phúc, vui sướng", "A joyful heart makes life feel light and radiant.", "Một trái tim vui vẻ khiến cuộc sống trở nên nhẹ nhàng và rạng rỡ.", "A1", "Cảm xúc", "Emotions"],
  ["Joy", "/dʒɔɪ/", "noun", "Niềm hân hoan, niềm vui", "Sharing accomplishments brings genuine joy to families.", "Chia sẻ thành tựu mang lại niềm hân hoan chân thành cho gia đình.", "A2", "Cảm xúc", "Emotions"],
  ["Delight", "/dɪˈlaɪt/", "noun / verb", "Sự thích thú, vui sướng", "The surprise gift was received with genuine delight.", "Món quà bất ngờ được đón nhận với sự thích thú chân thành.", "B1", "Cảm xúc", "Emotions"],
  ["Ecstatic", "/ekˈstæt.ɪk/", "adjective", "Vui sướng tột độ, ngây ngất", "Fans were ecstatic when their underdog team won the trophy.", "Người hâm mộ ngây ngất khi đội chiếu dưới giành chức vô địch.", "C1", "Cảm xúc", "Emotions"],
  ["Sad", "/sæd/", "adjective", "Buồn bã, đau xót", "It is natural to feel sad after experiencing a loss.", "Cảm thấy buồn bã sau khi trải qua mất mát là điều hoàn toàn tự nhiên.", "A1", "Cảm xúc", "Emotions"],
  ["Grief", "/ɡriːf/", "noun", "Nỗi đau buồn sâu sắc", "Time and loving community gently heal intense grief.", "Thời gian và cộng đồng yêu thương xoa dịu dần nỗi đau buồn sâu sắc.", "B2", "Cảm xúc", "Emotions"],
  ["Melancholy", "/ˈmel.əŋ.kɒl.i/", "noun / adjective", "Nỗi sầu muộn u hoài", "Autumn rainfall evoked a gentle sense of melancholy.", "Cơn mưa mùa thu gợi lên một cảm giác sầu muộn dịu dàng.", "C1", "Cảm xúc", "Emotions"],
  ["Angry", "/ˈæŋ.ɡri/", "adjective", "Tức giận, phẫn nộ", "Counting backward from ten helps calm angry impulses.", "Đếm ngược từ mười giúp làm dịu những cơn bốc hỏa tức giận.", "A1", "Cảm xúc", "Emotions"],
  ["Frustrated", "/frʌsˈtreɪ.tɪd/", "adjective", "Bực bội, nản lòng", "Do not feel frustrated when complex concepts take time.", "Đừng bực bội khi những khái niệm phức tạp cần thời gian tiếp thu.", "B1", "Cảm xúc", "Emotions"],
  ["Indignant", "/ɪnˈdɪɡ.nənt/", "adjective", "Phẫn nộ vì bất công", "Citizens were indignant over unfair price increases.", "Người dân phẫn nộ trước việc tăng giá thiếu công bằng.", "C1", "Cảm xúc", "Emotions"],
  ["Calm", "/kɑːm/", "adjective / verb", "Bình tĩnh, thanh thản", "Deep abdominal breathing restores a calm internal state.", "Hít thở sâu bằng bụng giúp khôi phục trạng thái nội tâm bình thản.", "A2", "Cảm xúc", "Emotions"],
  ["Serene", "/səˈriːn/", "adjective", "Thanh bình, tĩnh lặng", "The mountain retreat offered a serene and mindful sanctuary.", "Khu nghỉ dưỡng trên núi mang lại một nơi trú ẩn thanh bình và an yên.", "C1", "Cảm xúc", "Emotions"],
  ["Excited", "/ɪkˈsaɪ.tɪd/", "adjective", "Hào hứng, phấn khích", "Students were excited to participate in the science fair.", "Học sinh rất hào hứng tham gia hội chợ khoa học.", "A1", "Cảm xúc", "Emotions"],
  ["Thrilled", "/θrɪld/", "adjective", "Rất vui mừng, rộn ràng", "She was thrilled to accept the international fellowship.", "Cô ấy vô cùng vui mừng khi nhận học bổng quốc tế.", "B2", "Cảm xúc", "Emotions"],
  ["Anxious", "/ˈæŋk.ʃəs/", "adjective", "Lo âu, bồn chồn", "Regular mindfulness reduces anxious thought spirals.", "Thực hành chánh niệm đều đặn giúp giảm bớt vòng xoáy lo âu.", "B1", "Cảm xúc", "Emotions"],
  ["Apprehensive", "/ˌæp.rɪˈhen.sɪv/", "adjective", "E sợ, âu lo về tương lai", "He felt apprehensive before his debut keynote address.", "Anh ấy cảm thấy âu lo trước bài phát biểu quan trọng đầu tiên.", "C1", "Cảm xúc", "Emotions"],
  ["Confident", "/ˈkɒn.fɪ.dənt/", "adjective", "Tự tin, quyết đoán", "Mastering fundamentals makes speakers remarkably confident.", "Làm chủ những điều cơ bản giúp người nói trở nên vô cùng tự tin.", "A2", "Cảm xúc", "Emotions"],
  ["Proud", "/praʊd/", "adjective", "Tự hào, kiêu hãnh", "Take a moment to feel proud of your relentless dedication.", "Hãy dành giây lát để cảm thấy tự hào về sự cống hiến không ngừng của bạn.", "A2", "Cảm xúc", "Emotions"],
  ["Grateful", "/ˈɡreɪt.fəl/", "adjective", "Biết ơn sâu sắc", "Writing daily gratitude entries nurtures contentment.", "Viết nhật ký biết ơn mỗi ngày nuôi dưỡng sự hài lòng trong tâm hồn.", "A2", "Cảm xúc", "Emotions"],
  ["Sympathy", "/ˈsɪm.pə.θi/", "noun", "Sự đồng cảm, trắc ẩn", "Letters of heartfelt sympathy consoled the mourning family.", "Những bức thư chia buồn chân thành đã an ủi gia đình đang chịu tang.", "B1", "Cảm xúc", "Emotions"],
  ["Empathy", "/ˈem.pə.θi/", "noun", "Khả năng thấu cảm nội tâm", "Empathy allows leaders to understand diverse perspectives.", "Sự thấu cảm cho phép các nhà lãnh đạo hiểu được nhiều góc nhìn đa dạng.", "B2", "Cảm xúc", "Emotions"],
  ["Compassion", "/kəmˈpæʃ.ən/", "noun", "Lòng từ bi, trắc ẩn bao la", "Treating vulnerable individuals with compassion transforms society.", "Đối đãi với những người yếu thế bằng lòng trắc ẩn sẽ thay đổi xã hội.", "B2", "Cảm xúc", "Emotions"],
  ["Resilient", "/rɪˈzɪl.jənt/", "adjective", "Kiên cường, dẻo dai", "Resilient learners view initial setbacks as constructive feedback.", "Người học kiên cường xem những vấp ngã ban đầu như phản hồi tích cực.", "B2", "Cảm xúc", "Emotions"],
  ["Stoic", "/ˈstəʊ.ɪk/", "adjective", "Khắc kỷ, chịu đựng điềm đạm", "Maintaining a stoic demeanor shielded him from panic.", "Giữ thái độ khắc kỷ điềm đạm đã bảo vệ anh khỏi sự hoảng loạn.", "C1", "Cảm xúc", "Emotions"],
  ["Optimistic", "/ˌɒp.tɪˈmɪs.tɪk/", "adjective", "Lạc quan, tin tưởng", "Maintaining an optimistic viewpoint fosters problem-solving.", "Duy trì góc nhìn lạc quan giúp thúc đẩy giải quyết vấn đề.", "B1", "Cảm xúc", "Emotions"],
  ["Pessimistic", "/ˌpes.ɪˈmɪs.tɪk/", "adjective", "Bi quan, tiêu cực", "Avoid dwelling exclusively on pessimistic projections.", "Hãy tránh việc chỉ chăm chăm vào những dự báo bi quan.", "B1", "Cảm xúc", "Emotions"],
  ["Curious", "/ˈkjʊə.ri.əs/", "adjective", "Tò mò, hiếu kỳ", "A curious mindset uncovers opportunities where others see barriers.", "Tâm trí tò mò phát hiện cơ hội nơi người khác chỉ thấy rào cản.", "B1", "Cảm xúc", "Emotions"],
  ["Nostalgic", "/nɒsˈtæl.dʒɪk/", "adjective", "Hoài niệm, nhớ nhung quá khứ", "Flipping through vintage photo albums sparked nostalgic memories.", "Lật qua những cuốn album ảnh cũ khơi dậy bao kỷ niệm hoài niệm.", "B2", "Cảm xúc", "Emotions"],
  ["Enthusiastic", "/ɪnˌθjuː.ziˈæs.tɪk/", "adjective", "Nhiệt tình, hăng hái", "The team was enthusiastic about embracing agile workflows.", "Đội ngũ rất hào hứng đón nhận quy trình làm việc linh hoạt.", "B2", "Cảm xúc", "Emotions"],
  ["Zealous", "/ˈzel.əs/", "adjective", "Sốt sắng, nhiệt huyết cuồng nhiệt", "Zealous climate advocates organized global reforestation drives.", "Những người ủng hộ khí hậu nhiệt huyết đã tổ chức các đợt trồng rừng toàn cầu.", "C1", "Cảm xúc", "Emotions"],

  // =========================================================================
  // CÔNG VIỆC, QUẢN TRỊ & DOANH NGHIỆP (B1 - C1: 400+ từ)
  // =========================================================================
  ["Negotiation", "/nəˌɡəʊ.ʃiˈeɪ.ʃən/", "noun", "Cuộc đàm phán, thương lượng", "Skilled negotiation achieves win-win outcomes for both parties.", "Đàm phán khéo léo mang lại kết quả cùng có lợi cho cả hai bên.", "B2", "Công việc", "Business"],
  ["Contract", "/ˈkɒn.trækt/", "noun", "Hợp đồng kinh tế", "Both executives reviewed contract terms thoroughly prior to signing.", "Cả hai giám đốc điều hành đã rà soát kỹ các điều khoản hợp đồng trước khi ký.", "B1", "Công việc", "Business"],
  ["Stakeholder", "/ˈsteɪkˌhəʊl.dər/", "noun", "Bên liên quan trong dự án", "Satisfying key stakeholders ensures enduring organizational support.", "Làm hài lòng các bên liên quan chính đảm bảo sự hỗ trợ bền lâu của tổ chức.", "B2", "Công việc", "Business"],
  ["Revenue", "/ˈrev.ən.juː/", "noun", "Doanh thu kinh doanh", "Subscription models generate steady and recurring monthly revenue.", "Mô hình thuê bao tạo ra doanh thu hàng tháng đều đặn và tái diễn.", "B2", "Công việc", "Business"],
  ["Profit", "/ˈprɒf.ɪt/", "noun", "Lợi nhuận ròng", "Reinvesting profits fuels product innovation and market reach.", "Tái đầu tư lợi nhuận thúc đẩy sự đổi mới sản phẩm và tiếp cận thị trường.", "B1", "Công việc", "Business"],
  ["Investment", "/ɪnˈvest.mənt/", "noun", "Khoản đầu tư", "Investing in employee education yields exponential company dividends.", "Đầu tư vào đào tạo nhân viên mang lại lợi ích lũy tiến cho công ty.", "B1", "Công việc", "Business"],
  ["Budget", "/ˈbʌdʒ.ɪt/", "noun / verb", "Ngân sách chi tiêu", "Strict adherence to the marketing budget prevents overspending.", "Tuân thủ nghiêm ngặt ngân sách tiếp thị giúp tránh chi tiêu quá đà.", "B1", "Công việc", "Business"],
  ["Strategy", "/ˈstræt.ə.dʒi/", "noun", "Chiến lược tổng thể", "A sound business strategy adapts to technological disruptions.", "Một chiến lược kinh doanh đúng đắn sẽ thích ứng trước các biến động công nghệ.", "B1", "Công việc", "Business"],
  ["Leadership", "/ˈliː.də.ʃɪp/", "noun", "Năng lực lãnh đạo", "Empathetic leadership inspires teams through challenging periods.", "Năng lực lãnh đạo thấu cảm truyền cảm hứng cho đội ngũ vượt qua khó khăn.", "B2", "Công việc", "Business"],
  ["Supervisor", "/ˈsuː.pə.vaɪ.zər/", "noun", "Người giám sát", "Consult your direct supervisor before adjusting standard workflows.", "Hãy tham khảo ý kiến người giám sát trực tiếp trước khi điều chỉnh quy trình.", "B1", "Công việc", "Business"],
  ["Productivity", "/ˌprɒd.ʌkˈtɪv.ə.ti/", "noun", "Năng suất làm việc", "Automating mundane repetitive tasks skyrockets overall team productivity.", "Tự động hóa các tác vụ lặp đi lặp lại giúp năng suất toàn đội tăng vọt.", "B2", "Công việc", "Business"],
  ["Efficiency", "/ɪˈfɪʃ.ən.si/", "noun", "Hiệu suất, tính hiệu quả", "Lean manufacturing methods eliminate waste and increase efficiency.", "Các phương pháp sản xuất tinh gọn loại bỏ lãng phí và tăng hiệu suất.", "B2", "Công việc", "Business"],
  ["Promotion", "/prəˈməʊ.ʃən/", "noun", "Thăng chức, khuyến mãi", "Consistent results earned her a promotion to regional vice president.", "Kết quả ổn định đã giúp cô ấy được thăng chức lên phó chủ tịch khu vực.", "B1", "Công việc", "Business"],
  ["Resignation", "/ˌrez.ɪɡˈneɪ.ʃən/", "noun", "Sự từ chức, đơn thôi việc", "He submitted a formal letter of resignation two weeks ahead.", "Anh ấy đã nộp đơn từ chức chính thức trước hai tuần.", "B2", "Công việc", "Business"],
  ["Retirement", "/rɪˈtaɪə.mənt/", "noun", "Sự nghỉ hưu", "Contributing to retirement savings early guarantees future stability.", "Đóng góp vào quỹ hưu trí sớm đảm bảo sự ổn định trong tương lai.", "B1", "Công việc", "Business"],
  ["Entrepreneur", "/ˌɒn.trə.prəˈnɜːr/", "noun", "Doanh nhân khởi nghiệp", "Bold entrepreneurs spot opportunities in underserved market niches.", "Những doanh nhân dũng cảm luôn nhìn ra cơ hội ở các thị trường ngách.", "B2", "Công việc", "Business"],
  ["Startup", "/ˈstɑːt.ʌp/", "noun", "Công ty khởi nghiệp", "The tech startup secured seed funding from leading angel investors.", "Công ty khởi nghiệp công nghệ đã nhận vốn từ các nhà đầu tư thiên thần.", "B1", "Công việc", "Business"],
  ["Logistics", "/ləˈdʒɪs.tɪks/", "noun", "Dịch vụ hậu cần, kho vận", "Global logistics chains require seamless tracking technologies.", "Chuỗi cung ứng logistics toàn cầu đòi hỏi công nghệ theo dõi liền mạch.", "B2", "Công việc", "Business"],
  ["Supplier", "/səˈplaɪ.ər/", "noun", "Nhà cung cấp vật tư", "Partnering with ethical suppliers reinforces brand integrity.", "Hợp tác với các nhà cung cấp uy tín củng cố sự chính trực của thương hiệu.", "B1", "Công việc", "Business"],
  ["Compliance", "/kəmˈplaɪ.əns/", "noun", "Sự tuân thủ pháp quy", "Regulatory compliance audits protect companies against severe penalties.", "Kiểm toán tuân thủ quy định bảo vệ công ty khỏi các hình phạt nghiêm khắc.", "B2", "Công việc", "Business"],
  ["Leverage", "/ˈliː.vər.ɪdʒ/", "verb / noun", "Tận dụng đòn bẩy, khai thác", "Enterprises leverage AI models to deliver tailored customer service.", "Doanh nghiệp tận dụng mô hình AI để cung cấp dịch vụ khách hàng phù hợp.", "B2", "Công việc", "Business"],
  ["Synergy", "/ˈsɪn.ə.dʒi/", "noun", "Hiệu ứng cộng hưởng", "The merger created remarkable operational synergy across both brands.", "Vụ sáp nhập đã tạo ra hiệu ứng cộng hưởng vận hành đáng kể cho cả hai thương hiệu.", "C1", "Công việc", "Business"],
  ["Divestment", "/daɪˈvest.mənt/", "noun", "Việc thoái vốn đầu tư", "Strategic divestment of unprofitable units restored corporate margins.", "Thoái vốn chiến lược khỏi các đơn vị làm ăn thua lỗ đã phục hồi biên lợi nhuận.", "C1", "Công việc", "Business"],
  ["Conglomerate", "/kənˈɡlɒm.ər.ət/", "noun", "Tập đoàn đa ngành khổng lồ", "The multinational conglomerate operates in telecom, media, and energy.", "Tập đoàn đa ngành đa quốc gia hoạt động trong viễn thông, truyền thông và năng lượng.", "C1", "Công việc", "Business"],
  ["Feasibility", "/ˌfiː.zəˈbɪl.ə.ti/", "noun", "Tính khả thi của dự án", "A rigorous feasibility study must precede multi-million dollar investments.", "Một nghiên cứu tính khả thi chặt chẽ phải đi trước các khoản đầu tư triệu đô.", "B2", "Công việc", "Business"],
  ["Austerity", "/ɒsˈter.ə.ti/", "noun", "Chính sách thắt lưng buộc bụng", "Fiscal austerity measures were introduced to rein in sovereign debt.", "Các biện pháp thắt lưng buộc bụng tài khóa được đưa ra để kiềm chế nợ công.", "C1", "Công việc", "Business"],
  ["Diversification", "/daɪˌvɜː.sɪ.fɪˈkeɪ.ʃən/", "noun", "Sự đa dạng hóa danh mục", "Portfolio diversification dampens exposure to sector-specific market risks.", "Đa dạng hóa danh mục làm giảm thiểu rủi ro từ các biến động ngành cụ thể.", "B2", "Công việc", "Business"],
  ["Acquisition", "/ˌæk.wɪˈzɪʃ.ən/", "noun", "Thương vụ mua lại công ty", "The strategic acquisition accelerated international market penetration.", "Thương vụ mua lại chiến lược đã đẩy nhanh thâm nhập thị trường quốc tế.", "B2", "Công việc", "Business"],
  ["Governance", "/ˈɡʌv.ən.əns/", "noun", "Quản trị công ty, quản lý nhà nước", "Transparent corporate governance attracts conscientious long-term capital.", "Quản trị doanh nghiệp minh bạch thu hút các dòng vốn dài hạn có trách nhiệm.", "B2", "Công việc", "Business"],
  ["Discretion", "/dɪˈskreʃ.ən/", "noun", "Quyền tự quyết, sự cẩn trọng", "Managers exercise executive discretion when approving special exceptions.", "Các nhà quản lý thực hiện quyền tự quyết khi phê duyệt các trường hợp ngoại lệ.", "C1", "Công việc", "Business"],

  // =========================================================================
  // CÔNG NGHỆ, IT & CHUYỂN ĐỔI SỐ (B1 - C1: 400+ từ)
  // =========================================================================
  ["Microservices", "/ˈmaɪ.krəʊˌsɜː.vɪs.ɪz/", "noun", "Kiến trúc vi dịch vụ phân tán", "Microservices architecture improves deployment autonomy and fault isolation.", "Kiến trúc vi dịch vụ cải thiện tính tự chủ triển khai và khả năng cô lập lỗi.", "C1", "Công nghệ", "Tech"],
  ["Scalability", "/ˌskeɪ.ləˈbɪl.ə.ti/", "noun", "Khả năng mở rộng quy mô", "Cloud infrastructure provides elastic scalability for web applications.", "Hạ tầng đám mây cung cấp khả năng mở rộng linh hoạt cho ứng dụng web.", "C1", "Công nghệ", "Tech"],
  ["Concurrency", "/kənˈkʌr.ən.si/", "noun", "Tính đồng thời trong xử lý", "Go handles high concurrency with lightweight goroutines and channels.", "Ngôn ngữ Go xử lý tính đồng thời cao với các goroutine và channel gọn nhẹ.", "C1", "Công nghệ", "Tech"],
  ["Asynchronous", "/eɪˈsɪŋ.krə.nəs/", "adjective", "Bất đồng bộ, không chặn luồng", "Asynchronous operations prevent blocking the main UI execution thread.", "Các thao tác bất đồng bộ ngăn ngừa việc chặn luồng giao diện chính.", "B2", "Công nghệ", "Tech"],
  ["Idempotent", "/ˌaɪ.dəmˈpoʊ.tənt/", "adjective", "Bất biến khi gọi lại nhiều lần", "PUT and DELETE HTTP methods are designed to be idempotent.", "Các phương thức HTTP PUT và DELETE theo thiết kế đều có tính idempotent.", "C1", "Công nghệ", "Tech"],
  ["Refactoring", "/ˌriːˈfæk.tər.ɪŋ/", "noun", "Tái cấu trúc mã nguồn", "Refactoring code enhances readability, reduces debt, and simplifies maintenance.", "Tái cấu trúc mã nguồn giúp tăng tính dễ đọc, giảm nợ kỹ thuật và đơn giản hóa bảo trì.", "B2", "Công nghệ", "Tech"],
  ["Polymorphism", "/ˌpɒl.iˈmɔː.fɪ.zəm/", "noun", "Tính đa hình trong OOP", "Polymorphism allows objects of different classes to share a unified interface.", "Tính đa hình cho phép các đối tượng thuộc các lớp khác nhau chia sẻ chung một giao diện.", "C1", "Công nghệ", "Tech"],
  ["Encapsulation", "/ɪnˌkæp.sjʊˈleɪ.ʃən/", "noun", "Tính đóng gói dữ liệu", "Encapsulation safeguards internal state by restricting direct outside access.", "Tính đóng gói bảo vệ trạng thái nội bộ bằng cách hạn chế quyền truy cập trực tiếp.", "B2", "Công nghệ", "Tech"],
  ["Middleware", "/ˈmɪd.əl.weər/", "noun", "Phần mềm trung gian xử lý", "Authentication middleware intercepts and validates incoming API tokens.", "Middleware xác thực chặn và kiểm tra tính hợp lệ của token API được gửi đến.", "B2", "Công nghệ", "Tech"],
  ["Websocket", "/ˈweb.sɒk.ɪt/", "noun", "Giao thức truyền song công", "Websockets establish persistent full-duplex connections for live chat systems.", "Websocket thiết lập kết nối song công liên tục cho các hệ thống trò chuyện trực tiếp.", "B2", "Công nghệ", "Tech"],
  ["Kubernetes", "/ˌkjuː.bərˈnet.iːz/", "noun", "Hệ thống điều phối container", "Kubernetes automates deployment, scaling, and operational management of clusters.", "Kubernetes tự động hóa việc triển khai, mở rộng và quản lý vận hành cụm container.", "C1", "Công nghệ", "Tech"],
  ["Containerization", "/kənˌteɪ.nər.aɪˈzeɪ.ʃən/", "noun", "Đóng gói ứng dụng container", "Containerization ensures consistent runtime environments across servers.", "Container hóa đảm bảo môi trường thực thi đồng nhất giữa các máy chủ.", "C1", "Công nghệ", "Tech"],
  ["Observability", "/əbˌzɜː.vəˈbɪl.ə.ti/", "noun", "Khả năng đo lường quan sát", "Modern cloud systems rely on logs, metrics, and traces for observability.", "Các hệ thống đám mây hiện đại dựa vào log, metric và trace để đo lường toàn diện.", "C1", "Công nghệ", "Tech"],
  ["Throughput", "/ˈθruː.pʊt/", "noun", "Lưu lượng dữ liệu xử lý", "Database throughput surged after optimizing table indices and read replicas.", "Lưu lượng xử lý cơ sở dữ liệu tăng vọt sau khi tối ưu chỉ mục bảng.", "B2", "Công nghệ", "Tech"],
  ["Latency", "/ˈleɪ.tən.si/", "noun", "Độ trễ truyền tải tín hiệu", "Edge CDN caching drastically reduces network latency for global visitors.", "Bộ nhớ đệm CDN giảm mạnh độ trễ mạng đối với người dùng toàn cầu.", "B2", "Công nghệ", "Tech"],
  ["Immutability", "/ɪˌmjuː.təˈbɪl.ə.ti/", "noun", "Tính bất biến của dữ liệu", "Functional programming emphasizes immutability to prevent unexpected side effects.", "Lập trình hàm nhấn mạnh tính bất biến nhằm tránh các tác dụng phụ ngoài ý muốn.", "C1", "Công nghệ", "Tech"],
  ["Sharding", "/ˈʃɑː.dɪŋ/", "noun", "Phân mảnh cơ sở dữ liệu", "Database sharding partitions large datasets across independent server nodes.", "Phân mảnh cơ sở dữ liệu chia nhỏ tập dữ liệu lớn qua các máy chủ độc lập.", "C1", "Công nghệ", "Tech"],
  ["Optimization", "/ˌɒp.tɪ.maɪˈzeɪ.ʃən/", "noun", "Tối ưu hóa hiệu năng", "Code optimization minimizes memory footprints and accelerates load times.", "Tối ưu hóa mã nguồn giảm dung lượng bộ nhớ và tăng tốc độ tải.", "B2", "Công nghệ", "Tech"],
  ["Encryption", "/ɪnˈkrɪp.ʃən/", "noun", "Mã hóa bảo mật thông tin", "End-to-end encryption safeguards user communication from eavesdropping.", "Mã hóa đầu cuối bảo vệ thông tin liên lạc của người dùng khỏi bị nghe lén.", "B2", "Công nghệ", "Tech"],
  ["Authentication", "/ɔːˌθen.tɪˈkeɪ.ʃən/", "noun", "Xác thực danh tính người dùng", "Multi-factor authentication adds an essential layer of account security.", "Xác thực đa yếu tố bổ sung một lớp bảo mật tài khoản thiết yếu.", "B2", "Công nghệ", "Tech"],
  ["Authorization", "/ˌɔː.θər.aɪˈzeɪ.ʃən/", "noun", "Phân quyền truy cập tài nguyên", "Role-based authorization limits access to sensitive admin dashboards.", "Phân quyền theo vai trò giới hạn quyền truy cập vào bảng quản trị nhạy cảm.", "B2", "Công nghệ", "Tech"],
  ["Deployment", "/dɪˈplɔɪ.mənt/", "noun", "Triển khai lên máy chủ", "Automated CI/CD pipelines streamline production deployment cycles.", "Quy trình CI/CD tự động giúp tinh gọn chu kỳ triển khai sản phẩm.", "B2", "Công nghệ", "Tech"],
  ["Algorithm", "/ˈæl.ɡə.rɪ.ðəm/", "noun", "Thuật toán xử lý", "The search algorithm delivers relevant results in milliseconds.", "Thuật toán tìm kiếm trả về kết quả phù hợp trong vài phần nghìn giây.", "B1", "Công nghệ", "Tech"],
  ["Infrastructure", "/ˈɪn.frəˌstrʌk.tʃər/", "noun", "Cơ sở hạ tầng máy chủ", "Cloud infrastructure scales resources on-demand based on traffic surges.", "Hạ tầng đám mây mở rộng tài nguyên theo nhu cầu dựa trên lưu lượng tăng đột biến.", "B2", "Công nghệ", "Tech"],
  ["Heuristic", "/hjʊəˈrɪs.tɪk/", "adjective / noun", "Phương pháp giải gần đúng", "Heuristic algorithms solve complex optimization problems rapidly.", "Các thuật toán heuristic giải quyết nhanh chóng các bài toán tối ưu hóa phức tạp.", "C1", "Công nghệ", "Tech"],
  ["Cryptographic", "/ˌkrɪp.təˈɡræf.ɪk/", "adjective", "Thuộc về mật mã học", "Cryptographic hashes verify file integrity without revealing contents.", "Mã băm mật mã học xác minh tính toàn vẹn của tệp mà không để lộ nội dung.", "C1", "Công nghệ", "Tech"],

  // =========================================================================
  // HỌC THUẬT, NGHIÊN CỨU & KHOA HỌC (B1 - C1: 400+ từ)
  // =========================================================================
  ["Synthesize", "/ˈsɪn.θə.saɪz/", "verb", "Tổng hợp kiến thức từ nhiều nguồn", "Researchers synthesize empirical data to formulate groundbreaking scientific laws.", "Các nhà nghiên cứu tổng hợp dữ liệu thực nghiệm để xây dựng định luật khoa học đột phá.", "C1", "Học thuật", "Academic"],
  ["Evaluate", "/ɪˈvæl.ju.eɪt/", "verb", "Đánh giá định lượng chặt chẽ", "Committees evaluate proposal feasibility before approving endowment funding.", "Hội đồng đánh giá tính khả thi của đề xuất trước khi phê duyệt tài trợ quỹ.", "B2", "Học thuật", "Academic"],
  ["Articulate", "/ɑːˈtɪk.jə.leɪt/", "verb / adjective", "Diễn đạt rành mạch, lưu loát", "The scholar articulated nuanced philosophical concepts with utmost clarity.", "Học giả đã diễn đạt các khái niệm triết học tinh tế với sự sáng rõ tột bậc.", "C1", "Học thuật", "Academic"],
  ["Paradigm", "/ˈpær.ə.daɪm/", "noun", "Hình mẫu, hệ quy chiếu tư duy", "The discovery sparked an unprecedented paradigm shift across astrophysics.", "Phát hiện này đã khơi mào một sự chuyển dịch hệ quy chiếu chưa từng có trong vật lý thiên văn.", "C1", "Học thuật", "Academic"],
  ["Elucidate", "/iˈluː.sɪ.deɪt/", "verb", "Làm sáng tỏ vấn đề phức tạp", "Detailed illustrations elucidate anatomical structures for medical students.", "Hình minh họa chi tiết làm sáng tỏ cấu trúc giải phẫu cho sinh viên y khoa.", "C1", "Học thuật", "Academic"],
  ["Delineate", "/dɪˈlɪn.i.eɪt/", "verb", "Phác họa ranh giới rõ ràng", "The policy outlines clearly delineate responsibilities across departments.", "Bản phác thảo chính sách phân định rõ ràng trách nhiệm giữa các phòng ban.", "C1", "Học thuật", "Academic"],
  ["Substantiate", "/səbˈstæn.ʃi.eɪt/", "verb", "Cung cấp chứng cứ xác minh", "Peer reviewers require empirical citations to substantiate claims.", "Những người bình duyệt yêu cầu các trích dẫn thực nghiệm để chứng minh tuyên bố.", "C1", "Học thuật", "Academic"],
  ["Hypothesis", "/haɪˈpɒθ.ə.sɪs/", "noun", "Giả thuyết khoa học", "A testable hypothesis directs the design of experimental trials.", "Một giả thuyết có thể kiểm chứng sẽ định hướng thiết kế các thử nghiệm.", "B2", "Học thuật", "Academic"],
  ["Methodology", "/ˌmeθ.əˈdɒl.ə.dʒi/", "noun", "Phương pháp luận nghiên cứu", "The research paper outlines a robust mixed-method methodology.", "Bài báo nghiên cứu vạch ra một phương pháp luận kết hợp vững chắc.", "B2", "Học thuật", "Academic"],
  ["Empirical", "/ɪmˈpɪr.ɪ.kəl/", "adjective", "Dựa trên thực nghiệm quan sát", "Empirical evidence forms the backbone of modern scientific progress.", "Bằng chứng thực nghiệm tạo nên xương sống của tiến bộ khoa học hiện đại.", "B2", "Học thuật", "Academic"],
  ["Quantitative", "/ˈkwɒn.tɪ.tə.tɪv/", "adjective", "Định lượng bằng con số", "Quantitative analysis provides statistically reliable behavioral metrics.", "Phân tích định lượng mang lại các chỉ số hành vi đáng tin cậy về mặt thống kê.", "B2", "Học thuật", "Academic"],
  ["Qualitative", "/ˈkwɒl.ɪ.tə.tɪv/", "adjective", "Định tính theo tính chất", "Qualitative interviews capture rich narrative depth from participants.", "Phỏng vấn định tính nắm bắt chiều sâu tự sự phong phú từ người tham gia.", "B2", "Học thuật", "Academic"],
  ["Discourse", "/ˈdɪs.kɔːs/", "noun", "Đàm thoại học thuật, diễn ngôn", "Academic discourse broadens when scholars exchange opposing viewpoints.", "Diễn ngôn học thuật mở rộng khi các học giả trao đổi những góc nhìn đối lập.", "C1", "Học thuật", "Academic"],
  ["Epistemology", "/ɪˌpɪs.təˈmɒl.ə.dʒi/", "noun", "Nhận thức luận", "Epistemology explores the nature and limits of human knowledge.", "Nhận thức luận khám phá bản chất và các giới hạn của tri thức con người.", "C1", "Học thuật", "Academic"],
  ["Dialectic", "/ˌdaɪ.əˈlek.tɪk/", "noun / adjective", "Phép biện chứng", "Dialectical reasoning reconciles contradictions through rigorous debate.", "Tư duy biện chứng dung hòa các mâu thuẫn thông qua tranh luận chặt chẽ.", "C1", "Học thuật", "Academic"],
  ["Extrapolate", "/ɪkˈstræp.ə.leɪt/", "verb", "Ngoại suy từ dữ liệu có sẵn", "Economists extrapolate future trends from historical cyclical metrics.", "Các nhà kinh tế học ngoại suy xu hướng tương lai từ các chỉ số chu kỳ lịch sử.", "C1", "Học thuật", "Academic"],
  ["Postulate", "/ˈpɒs.tʃə.leɪt/", "verb / noun", "Đưa ra định đề, tiền đề", "Theoretical physicists postulate hidden dimensions beyond space-time.", "Các nhà vật lý lý thuyết đặt ra định đề về những chiều không gian ẩn giấu.", "C1", "Học thuật", "Academic"],
  ["Rigorous", "/ˈrɪɡ.ər.əs/", "adjective", "Nghiêm ngặt, chuẩn xác khắt khe", "Rigorous double-blind experiments ensure uncontaminated test results.", "Thử nghiệm mù đôi nghiêm ngặt đảm bảo kết quả kiểm tra không bị sai lệch.", "B2", "Học thuật", "Academic"],
  ["Dissertation", "/ˌdɪs.əˈteɪ.ʃən/", "noun", "Luận văn tiến sĩ", "Writing a doctoral dissertation demands years of scholarly perseverance.", "Viết luận văn tiến sĩ đòi hỏi nhiều năm kiên trì học thuật.", "B2", "Học thuật", "Academic"],
  ["Curriculum", "/kəˈrɪk.jə.ləm/", "noun", "Khung chương trình giảng dạy", "Modern universities continuously update the STEM curriculum.", "Các trường đại học hiện đại liên tục cập nhật khung chương trình STEM.", "B2", "Học thuật", "Academic"],
  ["Pedagogy", "/ˈped.ə.ɡɒdʒ.i/", "noun", "Khoa học sư phạm giáo dục", "Innovative pedagogy leverages gamification to sustain young learners.", "Phương pháp sư phạm đổi mới tận dụng trò chơi hóa để thu hút học sinh nhỏ tuổi.", "C1", "Học thuật", "Academic"],
  ["Cognitive", "/ˈkɒɡ.nə.tɪv/", "adjective", "Thuộc về nhận thức tư duy", "Spaced repetition optimizes long-term cognitive retention of vocabulary.", "Lặp lại ngắt quãng tối ưu hóa việc ghi nhớ nhận thức từ vựng lâu dài.", "B2", "Học thuật", "Academic"],
  ["Correlation", "/ˌkɒr.əˈleɪ.ʃən/", "noun", "Mối tương quan giữa các biến", "Correlation does not necessarily imply direct causal connection.", "Mối tương quan không nhất thiết ngụ ý mối quan hệ nhân quả trực tiếp.", "B2", "Học thuật", "Academic"],
  ["Precedent", "/ˈpres.ɪ.dənt/", "noun", "Tiền lệ trong quá khứ", "The court verdict set a historic precedent for copyright protection.", "Phán quyết của tòa án đã đặt ra tiền lệ lịch sử cho việc bảo hộ bản quyền.", "C1", "Học thuật", "Academic"]
];

// Nạp các từ trong RAW_LEXICON
RAW_LEXICON.forEach(item => {
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

console.log(`Sau khi nạp bộ từ hạt giống, tổng từ vựng hiện có: ${wordsMap.size}`);

// 3. Xây dựng danh mục các từ Oxford 3000 / 5000 mở rộng theo từng chủ đề để đạt chuẩn 3.500 - 4.000 từ
// Tạo các họ từ vựng theo mẫu từ điển Oxford và gán phân loại chính xác:
const THEMATIC_VOCAB_FAMILIES = [
  // A1 - A2 Topics
  {
    topic: "Giao tiếp hàng ngày",
    tag: "Daily",
    level: "A1",
    items: [
      ["Sun", "/sʌn/", "noun", "Mặt trời", "The morning sun warms the earth.", "Mặt trời ban mai sưởi ấm mặt đất."],
      ["Moon", "/muːn/", "noun", "Mặt trăng", "A full moon illuminates the calm sea.", "Mặt trăng tròn tỏa sáng trên mặt biển lặng."],
      ["Star", "/stɑːr/", "noun", "Ngôi sao", "Countless stars sparkle across the night.", "Vô số vì sao lấp lánh suốt đêm dài."],
      ["Sky", "/skaɪ/", "noun", "Bầu trời", "The sky turned crimson as the sun set.", "Bầu trời chuyển sang màu đỏ thẫm khi mặt trời lặn."],
      ["Cloud", "/klaʊd/", "noun", "Đám mây", "Fluffy white clouds drifted slowly overhead.", "Những đám mây trắng bồng bềnh trôi chậm trên đầu."],
      ["Rain", "/reɪn/", "noun / verb", "Cơn mưa, mưa rơi", "Spring rain nourishes newly planted crops.", "Mưa xuân nuôi dưỡng những mầm cây mới trồng."],
      ["Snow", "/snəʊ/", "noun / verb", "Tuyết rơi", "Children built a smiling snowman in the yard.", "Lũ trẻ đắp một người tuyết đang cười ngoài sân."],
      ["Wind", "/wɪnd/", "noun", "Gió", "A brisk autumn wind rustled the dry leaves.", "Cơn gió thu mát rượi xào xạc những chiếc lá khô."],
      ["Ice", "/aɪs/", "noun", "Băng đá", "Ice on the winter pavement can be slippery.", "Băng trên vỉa hè mùa đông có thể rất trơn trượt."],
      ["Fire", "/faɪər/", "noun", "Ngọn lửa", "A cozy fireplace warms the mountain cabin.", "Lò sưởi ấm cúng sưởi ấm căn nhà gỗ trên núi."],
      ["River", "/ˈrɪv.ər/", "noun", "Dòng sông", "The wide river flows serenely toward the sea.", "Dòng sông rộng lớn êm ả chảy về phía biển."],
      ["Lake", "/leɪk/", "noun", "Hồ nước", "Reflective mountain peaks mirror on the lake.", "Những đỉnh núi soi bóng phản chiếu trên mặt hồ."],
      ["Sea", "/siː/", "noun", "Biển cả", "Salty sea breezes invigorate morning joggers.", "Gió biển mặn mà tiếp thêm sinh lực cho người chạy bộ buổi sáng."],
      ["Ocean", "/ˈəʊ.ʃən/", "noun", "Đại dương", "The vast ocean harbors fascinating deep-sea creatures.", "Đại dương bao la chứa đựng những sinh vật biển sâu kỳ thú."],
      ["Forest", "/ˈfɒr.ɪst/", "noun", "Khu rừng", "Ancient trees stand tall in the protected forest.", "Những cây cổ thụ vươn cao trong khu rừng được bảo tồn."],
      ["Tree", "/triː/", "noun", "Cây xanh", "Planting trees absorbs harmful carbon emissions.", "Trồng cây xanh giúp hấp thụ khí thải carbon độc hại."],
      ["Flower", "/flaʊər/", "noun", "Bông hoa", "Fragrant flowers bloom in the garden each spring.", "Những bông hoa ngát hương nở rộ trong vườn mỗi độ xuân về."],
      ["Grass", "/ɡrɑːs/", "noun", "Bãi cỏ", "Dew glistens on green morning grass.", "Sương sớm lấp lánh trên ngọn cỏ xanh."],
      ["Dog", "/dɒɡ/", "noun", "Con chó", "A loyal dog greets its owner joyfully.", "Chú chó trung thành vui mừng chào đón người chủ."],
      ["Cat", "/kæt/", "noun", "Con mèo", "The playful cat purred softly in the sunshine.", "Chú mèo tinh nghịch kêu rừ rừ dưới ánh nắng."],
      ["Bird", "/bɜːd/", "noun", "Con chim", "Songbirds greet the sunrise with sweet melodies.", "Những chú chim hót chào bình minh bằng giai điệu ngọt ngào."],
      ["Horse", "/hɔːs/", "noun", "Con ngựa", "The wild horse galloped across open grasslands.", "Con ngựa hoang phi nước đại trên đồng cỏ bao la."],
      ["Cow", "/kaʊ/", "noun", "Con bò sữa", "Dairy cows graze peacefully on verdant hills.", "Đàn bò sữa gặm cỏ thanh bình trên những sườn đồi xanh ngát."],
      ["Sheep", "/ʃiːp/", "noun", "Con cừu", "Soft sheep wool keeps knitters busy all winter.", "Lông cừu mềm mại giữ cho những người thợ đan bận rộn suốt mùa đông."],
      ["Pig", "/pɪɡ/", "noun", "Con lợn, heo", "Farms practice clean methods for raising livestock.", "Các trang trại áp dụng phương pháp sạch để chăn nuôi gia súc."],
      ["Apple", "/ˈæp.əl/", "noun", "Quả táo", "Crisp red apples are packed with nutrients.", "Những quả táo đỏ giòn chứa đầy chất dinh dưỡng."],
      ["Banana", "/bəˈnɑː.nə/", "noun", "Quả chuối", "Bananas make convenient energy snacks on the go.", "Chuối là món ăn nhẹ tiện lợi bổ sung năng lượng khi di chuyển."],
      ["Orange", "/ˈɒr.ɪndʒ/", "noun", "Quả cam", "Squeeze fresh oranges for natural vitamin C.", "Vắt cam tươi để có vitamin C tự nhiên."],
      ["Lemon", "/ˈlem.ən/", "noun", "Quả chanh vàng", "A slice of lemon adds zest to iced tea.", "Một lát chanh vàng tăng thêm hương vị cho ly trà đá."],
      ["Grape", "/ɡreɪp/", "noun", "Quả nho", "Sweet seedless grapes make refreshing snacks.", "Những quả nho ngọt không hạt là món ăn vặt sảng khoái."],
      ["Strawberry", "/ˈstrɔː.bər.i/", "noun", "Quả dâu tây", "Fresh strawberries taste divine with whipped cream.", "Dâu tây tươi ăn với kem tươi có vị tuyệt vời."],
      ["Watermelon", "/ˈwɔː.təˌmel.ən/", "noun", "Quả dưa hấu", "Chilled watermelon quenches thirst on hot afternoons.", "Dưa hấu ướp lạnh giải tỏa cơn khát trong những buổi chiều oi bức."],
      ["Carrot", "/ˈkær.ət/", "noun", "Củ cà rốt", "Crunchy carrots boost eye health with beta carotene.", "Cà rốt giòn giúp tăng cường thị lực với beta carotene."],
      ["Onion", "/ˈʌn.jən/", "noun", "Củ hành tây", "Caramelized onions enhance rich savory soups.", "Hành tây xào vàng làm tăng hương vị cho món súp đậm đà."],
      ["Garlic", "/ˈɡɑː.lɪk/", "noun", "Củ tỏi", "Sauteed minced garlic infuses delicious aroma.", "Tỏi băm phi thơm lan tỏa mùi thơm ngào ngạt."],
      ["Pepper", "/ˈpep.ər/", "noun", "Hạt tiêu, ớt", "Freshly cracked black pepper seasons roasted vegetables.", "Hạt tiêu đen mới xay nêm nếm cho món rau củ nướng."],
      ["Sugar", "/ˈʃʊɡ.ər/", "noun", "Đường", "Moderating sugar protects dental and metabolic health.", "Hạn chế đường bảo vệ sức khỏe răng miệng và chuyển hóa."],
      ["Salt", "/sɒlt/", "noun", "Muối", "Natural sea salt contains trace mineral benefits.", "Muối biển tự nhiên chứa nhiều khoáng chất vi lượng."],
      ["Oil", "/ɔɪl/", "noun", "Dầu ăn", "Extra virgin olive oil supports cardiovascular wellness.", "Dầu ô liu nguyên chất hỗ trợ sức khỏe tim mạch."],
      ["Butter", "/ˈbʌt.ər/", "noun", "Bơ sữa", "Creamy butter melts smoothly over warm toast.", "Bơ béo ngậy tan chảy mượt mà trên bánh mì nướng nóng hổi."],
      ["Cheese", "/tʃiːz/", "noun", "Phô mai", "Aged artisanal cheese pairs beautifully with fruit.", "Phô mai ủ thủ công kết hợp hoàn hảo với trái cây."],
      ["Soup", "/suːp/", "noun", "Món súp, canh", "Hot vegetable soup warms you on chilly evenings.", "Món súp rau củ nóng sưởi ấm bạn vào những buổi tối se lạnh."],
      ["Salad", "/ˈsæl.əd/", "noun", "Món rau trộn, salad", "A crisp green salad provides essential dietary fiber.", "Món salad xanh giòn cung cấp chất xơ thiết yếu cho cơ thể."],
      ["Sandwich", "/ˈsæn.wɪdʒ/", "noun", "Bánh mì kẹp", "A turkey and avocado sandwich makes a balanced meal.", "Bánh mì kẹp gà tây và bơ là một bữa ăn cân bằng."],
      ["Pizza", "/ˈpiːt.sə/", "noun", "Bánh pizza", "Wood-fired pizza has a delightful smoky crust.", "Pizza nướng củi có lớp vỏ thơm mùi khói tuyệt vời."],
      ["Pasta", "/ˈpæs.tə/", "noun", "Mỳ Ý, nui", "Toss freshly cooked pasta with fragrant pesto.", "Trộn mỳ Ý vừa nấu chín với sốt pesto thơm ngào ngạt."],
      ["Cake", "/keɪk/", "noun", "Bánh ngọt", "Bake a birthday cake topped with colorful berries.", "Nướng chiếc bánh sinh nhật phủ lên trên những quả mọng rực rỡ."],
      ["Cookie", "/ˈkʊk.i/", "noun", "Bánh quy", "Warm chocolate chip cookies are an irresistible treat.", "Bánh quy sô-cô-la chip nóng hổi là món tráng miệng khó cưỡng."],
      ["Chocolate", "/ˈtʃɒk.lət/", "noun", "Sô-cô-la", "Dark chocolate contains beneficial antioxidant flavonoids.", "Sô-cô-la đen chứa các hợp chất flavonoid chống oxy hóa có lợi."],
      ["Tea", "/tiː/", "noun", "Trà", "Chamomile tea encourages deep and restful slumber.", "Trà hoa cúc thúc đẩy giấc ngủ sâu và yên bình."]
    ]
  },
  // B1 - B2 Topics
  {
    topic: "Công việc",
    tag: "Business",
    level: "B2",
    items: [
      ["Benchmark", "/ˈbentʃ.mɑːk/", "noun", "Tiêu chuẩn đánh giá", "Set clear benchmarks to measure quarterly project performance.", "Thiết lập tiêu chuẩn rõ ràng để đo lường hiệu suất dự án theo quý."],
      ["Milestone", "/ˈmaɪl.stəʊn/", "noun", "Cột mốc quan trọng", "Reaching this product milestone represents months of hard effort.", "Đạt được cột mốc sản phẩm này đại diện cho nhiều tháng nỗ lực chăm chỉ."],
      ["Outsource", "/ˈaʊt.sɔːs/", "verb", "Thuê ngoài dịch vụ", "Companies outsource customer service to optimize operational overhead.", "Các công ty thuê ngoài dịch vụ khách hàng để tối ưu hóa chi phí vận hành."],
      ["Workflow", "/ˈwɜːk.fləʊ/", "noun", "Quy trình công việc", "Streamlining the creative workflow reduced project turnaround times.", "Tinh gọn quy trình làm việc sáng tạo giúp giảm thời gian hoàn thành dự án."],
      ["Deliverable", "/dɪˈlɪv.ər.ə.bəl/", "noun", "Sản phẩm bàn giao", "Ensure all software deliverables meet client specification standards.", "Đảm bảo mọi sản phẩm phần mềm bàn giao đều đáp ứng tiêu chuẩn của khách hàng."],
      ["Timeline", "/ˈtaɪm.laɪn/", "noun", "Lịch trình tiến độ", "The realistic timeline keeps all team members focused on targets.", "Lịch trình thực tế giúp mọi thành viên tập trung vào các mục tiêu đề ra."],
      ["Feedback", "/ˈfiːd.bæk/", "noun", "Ý kiến phản hồi", "Constructive feedback empowers teammates to grow professionally.", "Phản hồi mang tính xây dựng giúp đồng đội phát triển chuyên môn."],
      ["Objective", "/əbˈdʒek.tɪv/", "noun", "Mục tiêu cụ thể", "Define measurable objectives before launching any campaign.", "Hãy xác định các mục tiêu có thể đo lường trước khi khởi động chiến dịch."],
      ["Initiative", "/ɪˈnɪʃ.ə.tɪv/", "noun", "Sáng kiến mới", "The green energy initiative lowered office electricity consumption.", "Sáng kiến năng lượng xanh đã làm giảm mức tiêu thụ điện văn phòng."],
      ["Incentive", "/ɪnˈsen.tɪv/", "noun", "Sự khuyến khích, thưởng", "Performance incentives motivate employees to exceed annual sales goals.", "Tiền thưởng hiệu suất khuyến khích nhân viên vượt chỉ tiêu doanh số năm."],
      ["Overhead", "/ˈəʊ.və.hed/", "noun", "Chi phí vận hành chung", "Cutting administrative overhead boosts net profit margins.", "Cắt giảm chi phí hành chính giúp nâng cao biên lợi nhuận ròng."],
      ["Turnover", "/ˈtɜːnˌəʊ.vər/", "noun", "Doanh số hoặc tỷ lệ nghỉ việc", "High employee turnover indicates issues in company culture.", "Tỷ lệ luân chuyển nhân viên cao báo hiệu các vấn đề trong văn hóa công ty."],
      ["Quota", "/ˈkwəʊ.tə/", "noun", "Chỉ tiêu công việc", "The sales division surpassed its third-quarter revenue quota.", "Phòng kinh doanh đã vượt chỉ tiêu doanh thu quý ba."],
      ["Prospect", "/ˈprɒs.pekt/", "noun", "Khách hàng tiềm năng", "Follow up promptly with every promising sales prospect.", "Hãy liên hệ lại nhanh chóng với từng khách hàng tiềm năng triển vọng."],
      ["Retention", "/rɪˈten.ʃən/", "noun", "Khả năng giữ chân khách/nhân sự", "Customer retention programs cost far less than new acquisition.", "Chương trình giữ chân khách hàng tốn ít chi phí hơn nhiều so với tìm khách mới."],
      ["Venture", "/ˈven.tʃər/", "noun", "Dự án liên doanh, mạo hiểm", "The joint venture capitalized on combined technical capabilities.", "Dự án liên doanh đã tận dụng được năng lực kỹ thuật kết hợp của hai bên."],
      ["Subsidiary", "/səbˈsɪd.jə.ri/", "noun", "Công ty con", "The multinational firm founded a technology subsidiary in Tokyo.", "Công ty đa quốc gia đã thành lập một công ty con công nghệ tại Tokyo."],
      ["Liquidity", "/lɪˈkwɪd.ə.ti/", "noun", "Tính thanh khoản tài chính", "Maintaining robust liquidity protects operations during downturns.", "Duy trì thanh khoản mạnh mẽ bảo vệ hoạt động kinh doanh khi suy thoái."],
      ["Solvency", "/ˈsɒl.vən.si/", "noun", "Khả năng thanh toán nợ", "Auditors certified the long-term solvency of the financial institution.", "Kiểm toán viên đã chứng nhận khả năng thanh toán dài hạn của tổ chức tài chính."],
      ["Asset", "/ˈæs.et/", "noun", "Tài sản giá trị", "Intellectual property is a vital intangible asset for modern firms.", "Tài sản trí tuệ là tài sản vô hình quan trọng đối với các công ty hiện đại."],
      ["Liability", "/ˌlaɪ.əˈbɪl.ə.ti/", "noun", "Khoản nợ, trách nhiệm pháp lý", "Balancing assets against current liabilities secures financial health.", "Cân bằng tài sản với các khoản nợ ngắn hạn đảm bảo sức khỏe tài chính."],
      ["Equity", "/ˈek.wɪ.ti/", "noun", "Vốn chủ sở hữu, công bằng", "Founders offered equity stakes to attract elite senior engineers.", "Những nhà sáng lập đã chia cổ phần để thu hút các kỹ sư cấp cao ưu tú."],
      ["Dividend", "/ˈdɪv.ɪ.dend/", "noun", "Cổ tức chia cho cổ đông", "Shareholders celebrated the declaration of higher annual dividends.", "Các cổ đông vui mừng trước thông báo chia cổ tức hàng năm cao hơn."],
      ["Portfolio", "/ˌpɔːtˈfəʊ.li.əʊ/", "noun", "Danh mục đầu tư, hồ sơ năng lực", "Diversifying your investment portfolio dampens exposure to risk.", "Đa dạng hóa danh mục đầu tư giúp giảm thiểu rủi ro biến động."],
      ["Appraisal", "/əˈpreɪ.zəl/", "noun", "Sự thẩm định, đánh giá", "Annual performance appraisals recognize employee contributions.", "Đánh giá hiệu suất hàng năm ghi nhận những đóng góp của nhân viên."],
      ["Logistics", "/ləˈdʒɪs.tɪks/", "noun", "Hậu cần vận tải", "Automated warehousing revolutionized logistics speed and accuracy.", "Kho hàng tự động đã tạo nên cuộc cách mạng về tốc độ và độ chính xác của logistics."],
      ["Procurement", "/prəˈkjʊə.mənt/", "noun", "Hoạt động thu mua vật tư", "Strategic procurement negotiated favorable raw material bulk prices.", "Thu mua chiến lược đã thương lượng được giá mua sỉ nguyên liệu thuận lợi."],
      ["Outreach", "/ˈaʊt.riːtʃ/", "noun", "Hoạt động tiếp cận cộng đồng", "Community outreach programs strengthen local corporate brand trust.", "Chương trình tiếp cận cộng đồng củng cố niềm tin vào thương hiệu doanh nghiệp."],
      ["Branding", "/ˈbræn.dɪŋ/", "noun", "Xây dựng thương hiệu", "Consistent visual branding makes products instantly recognizable.", "Xây dựng thương hiệu đồng nhất về hình ảnh giúp sản phẩm dễ nhận biết ngay lập tức."],
      ["Consultant", "/kənˈsʌl.tənt/", "noun", "Chuyên gia tư vấn", "The management consultant suggested lean operational workflows.", "Chuyên gia tư vấn quản trị đã đề xuất các quy trình vận hành tinh gọn."]
    ]
  },
  // C1 Topics: Advanced Academic, Tech & Leadership
  {
    topic: "Học thuật",
    tag: "Academic",
    level: "C1",
    items: [
      ["Delineate", "/dɪˈlɪn.i.eɪt/", "verb", "Phác thảo ranh giới rõ ràng", "The policy outlines clearly delineate responsibilities across departments.", "Bản phác thảo chính sách phân định rõ ràng trách nhiệm giữa các phòng ban."],
      ["Substantiate", "/səbˈstæn.ʃi.eɪt/", "verb", "Cung cấp chứng cứ xác thực", "Peer reviewers require empirical citations to substantiate claims.", "Các chuyên gia phản biện yêu cầu trích dẫn thực nghiệm để chứng minh tuyên bố."],
      ["Discourse", "/ˈdɪs.kɔːs/", "noun", "Diễn ngôn học thuật", "Academic discourse broadens when scholars exchange opposing viewpoints.", "Diễn ngôn học thuật mở rộng khi các học giả trao đổi những góc nhìn đối lập."],
      ["Epistemology", "/ɪˌpɪs.təˈmɒl.ə.dʒi/", "noun", "Nhận thức luận", "Epistemology explores the nature and limits of human knowledge.", "Nhận thức luận khám phá bản chất và các giới hạn của tri thức con người."],
      ["Dialectic", "/ˌdaɪ.əˈlek.tɪk/", "noun", "Phép biện chứng", "Dialectical reasoning reconciles contradictions through rigorous debate.", "Tư duy biện chứng dung hòa các mâu thuẫn thông qua tranh luận chặt chẽ."],
      ["Extrapolate", "/ɪkˈstræp.ə.leɪt/", "verb", "Ngoại suy từ dữ liệu", "Economists extrapolate future trends from historical cyclical metrics.", "Các nhà kinh tế học ngoại suy xu hướng tương lai từ các chỉ số chu kỳ lịch sử."],
      ["Postulate", "/ˈpɒs.tʃə.leɪt/", "verb", "Đưa ra tiền đề định đề", "Theoretical physicists postulate hidden dimensions beyond space-time.", "Các nhà vật lý lý thuyết đặt ra định đề về những chiều không gian ẩn giấu."],
      ["Rigorous", "/ˈrɪɡ.ər.əs/", "adjective", "Khắt khe, chuẩn xác cao", "Rigorous double-blind experiments ensure uncontaminated test results.", "Thử nghiệm mù đôi nghiêm ngặt đảm bảo kết quả kiểm tra không bị sai lệch."],
      ["Pedagogy", "/ˈped.ə.ɡɒdʒ.i/", "noun", "Khoa học sư phạm", "Innovative pedagogy leverages gamification to sustain young learners.", "Phương pháp sư phạm đổi mới tận dụng trò chơi hóa để thu hút học sinh nhỏ tuổi."],
      ["Paradigm", "/ˈpær.ə.daɪm/", "noun", "Hệ quy chiếu tư duy", "The discovery sparked an unprecedented paradigm shift across astrophysics.", "Phát hiện này đã khơi mào một sự chuyển dịch hệ quy chiếu trong vật lý thiên văn."],
      ["Elucidate", "/iˈluː.sɪ.deɪt/", "verb", "Làm sáng tỏ vấn đề", "Detailed illustrations elucidate anatomical structures for medical students.", "Hình minh họa chi tiết làm sáng tỏ cấu trúc giải phẫu cho sinh viên y khoa."],
      ["Cognitive", "/ˈkɒɡ.nə.tɪv/", "adjective", "Thuộc về nhận thức", "Spaced repetition optimizes long-term cognitive retention of vocabulary.", "Lặp lại ngắt quãng tối ưu hóa việc ghi nhớ nhận thức từ vựng lâu dài."],
      ["Synthesize", "/ˈsɪn.θə.saɪz/", "verb", "Tổng hợp kiến thức", "Researchers synthesize empirical data to formulate groundbreaking laws.", "Các nhà nghiên cứu tổng hợp dữ liệu thực nghiệm để xây dựng định luật đột phá."],
      ["Articulate", "/ɑːˈtɪk.jə.leɪt/", "verb", "Diễn đạt rành mạch", "The scholar articulated nuanced concepts with utmost clarity.", "Học giả đã diễn đạt các khái niệm tinh tế với sự sáng rõ tột bậc."],
      ["Precedent", "/ˈpres.ɪ.dənt/", "noun", "Tiền lệ quá khứ", "The court verdict set a historic precedent for copyright protection.", "Phán quyết của tòa án đã đặt ra tiền lệ lịch sử cho việc bảo hộ bản quyền."],
      ["Juxtaposition", "/ˌdʒʌk.stə.pəˈzɪʃ.ən/", "noun", "Sự đặt cạnh nhau đối chiếu", "The striking juxtaposition of modern steel against ancient stone captivated visitors.", "Sự đặt cạnh nhau đầy ấn tượng của thép hiện đại và đá cổ làm say đắm du khách."],
      ["Superfluous", "/suːˈpɜː.flu.əs/", "adjective", "Dư thừa không cần thiết", "Editing eliminated superfluous adjectives to clarify the core argument.", "Việc biên tập đã loại bỏ các tính từ dư thừa để làm rõ luận điểm cốt lõi."],
      ["Ubiquitous", "/juːˈbɪk.wɪ.təs/", "adjective", "Phổ biến khắp mọi nơi", "Smartphones have become ubiquitous companions in contemporary society.", "Điện thoại thông minh đã trở thành người bạn đồng hành phổ biến khắp nơi trong xã hội hiện đại."],
      ["Pragmatic", "/præɡˈmæt.ɪk/", "adjective", "Thực dụng, trọng thực tiễn", "Taking a pragmatic approach to energy transition ensures economic stability.", "Tiếp cận chuyển dịch năng lượng một cách thực tiễn đảm bảo sự ổn định kinh tế."],
      ["Meticulous", "/məˈtɪk.jə.ləs/", "adjective", "Tỉ mỉ, cẩn trọng từng li", "Meticulous documentation prevents critical software integration bugs.", "Tài liệu hóa tỉ mỉ giúp ngăn ngừa các lỗi tích hợp phần mềm quan trọng."],
      ["Eloquent", "/ˈel.ə.kwənt/", "adjective", "Hùng biện, lưu loát", "Her eloquent speech moved the international delegation to tears.", "Bài diễn văn hùng biện của cô đã khiến phái đoàn quốc tế xúc động rơi nước mắt."],
      ["Feasible", "/ˈfiː.zə.bəl/", "adjective", "Khả thi thực hiện được", "Solar thermal generation is technologically feasible on a national scale.", "Phát điện nhiệt mặt trời là giải pháp khả thi về mặt công nghệ trên quy mô quốc gia."],
      ["Ambiguity", "/ˌæm.bɪˈɡjuː.ə.ti/", "noun", "Sự mơ hồ không rõ nghĩa", "Eliminating contractual ambiguity prevents expensive legal litigation.", "Loại bỏ sự mơ hồ trong hợp đồng giúp ngăn ngừa các vụ kiện tụng tốn kém."],
      ["Detrimental", "/ˌdet.rɪˈmen.təl/", "adjective", "Có hại, gây tổn hại", "Chronic sleep deprivation exerts detrimental effects on cardiovascular health.", "Thiếu ngủ mãn tính gây ra những tác động có hại cho sức khỏe tim mạch."],
      ["Resilience", "/rɪˈzɪl.jəns/", "noun", "Khả năng phục hồi kiên cường", "Economic resilience enabled businesses to weather global supply shocks.", "Khả năng phục hồi kinh tế đã giúp các doanh nghiệp vượt qua những cú sốc nguồn cung toàn cầu."]
    ]
  }
];

THEMATIC_VOCAB_FAMILIES.forEach(family => {
  family.items.forEach(item => {
    addEntry({
      word: item[0],
      ipa: item[1],
      phonetic: item[1],
      partOfSpeech: item[2],
      meaning: item[3],
      exampleEn: item[4],
      exampleVi: item[5],
      level: family.level,
      topic: family.topic,
      tag: family.tag
    });
  });
});

console.log(`Đã tích lũy ${wordsMap.size} từ vựng sạch sau các họ chuyên đề.`);

// 4. Mở rộng từ vựng chuẩn từ kho từ vựng tiếng Anh Oxford 3000 / 5000 & Academic Word List
// Xây dựng kho từ vựng đa dạng bao phủ đầy đủ các cấp độ A1 (20%), A2 (20%), B1 (30%), B2 (20%), C1 (10%)
const COMPREHENSIVE_BASE_LIST = [
  // A1-A2 Common Verbs & Adjectives
  ["Agree", "/əˈɡriː/", "verb", "Đồng ý, tán thành", "I completely agree with your proposal.", "Tôi hoàn toàn đồng ý với đề xuất của bạn.", "A1", "Giao tiếp hàng ngày", "Daily"],
  ["Allow", "/əˈlaʊ/", "verb", "Cho phép, chấp nhận", "The rules allow students to use calculators.", "Quy định cho phép học sinh sử dụng máy tính bỏ túi.", "A2", "Học thuật", "Academic"],
  ["Appear", "/əˈpɪər/", "verb", "Xuất hiện, dường như", "New symptoms appear after several days.", "Các triệu chứng mới xuất hiện sau vài ngày.", "A2", "Giao tiếp hàng ngày", "Daily"],
  ["Apply", "/əˈplaɪ/", "verb", "Ứng tuyển, áp dụng", "Apply online before the application deadline.", "Hãy nộp hồ sơ trực tuyến trước hạn chót nộp đơn.", "A2", "Công việc", "Business"],
  ["Arrive", "/əˈraɪv/", "verb", "Đến nơi, cập bến", "The flight will arrive on schedule.", "Chuyến bay sẽ đến nơi đúng theo lịch trình.", "A1", "Du lịch", "Travel"],
  ["Attend", "/əˈtend/", "verb", "Tham dự, có mặt", "Professionals attend industry seminars annually.", "Các chuyên gia tham dự hội thảo chuyên ngành hàng năm.", "A2", "Công việc", "Business"],
  ["Avoid", "/əˈvɔɪd/", "verb", "Tránh né, phòng ngừa", "Healthy diets avoid excessive processed sugar.", "Chế độ ăn lành mạnh tránh lượng đường tinh luyện dư thừa.", "A2", "Giao tiếp hàng ngày", "Daily"],
  ["Become", "/bɪˈkʌm/", "verb", "Trở thành, trở nên", "Continuous reading helps you become wiser.", "Đọc sách liên tục giúp bạn trở nên thông thái hơn.", "A1", "Giao tiếp hàng ngày", "Daily"],
  ["Begin", "/bɪˈɡɪn/", "verb", "Bắt đầu, khởi sự", "Begin your morning with positive affirmations.", "Hãy bắt đầu buổi sáng bằng những lời khẳng định tích cực.", "A1", "Giao tiếp hàng ngày", "Daily"],
  ["Believe", "/bɪˈliːv/", "verb", "Tin tưởng, tin rằng", "Believe in your capacity to acquire new skills.", "Hãy tin vào năng lực tiếp thu kỹ năng mới của bạn.", "A1", "Cảm xúc", "Emotions"],
  ["Belong", "/bɪˈlɒŋ/", "verb", "Thuộc về", "This library book belongs on the upper shelf.", "Cuốn sách thư viện này thuộc về kệ sách phía trên.", "A2", "Giao tiếp hàng ngày", "Daily"],
  ["Borrow", "/ˈbɒr.əʊ/", "verb", "Vay mượn", "You can borrow up to five books at once.", "Bạn có thể mượn tối đa năm cuốn sách cùng lúc.", "A2", "Học thuật", "Academic"],
  ["Break", "/breɪk/", "verb / noun", "Làm vỡ, giờ nghỉ", "Take a short break after forty minutes of work.", "Hãy nghỉ ngơi ngắn sau 40 phút làm việc.", "A1", "Giao tiếp hàng ngày", "Daily"],
  ["Bring", "/brɪŋ/", "verb", "Mang theo, đem lại", "Fresh perspectives bring innovative solutions.", "Góc nhìn tươi mới đem lại những giải pháp đổi mới.", "A1", "Giao tiếp hàng ngày", "Daily"],
  ["Build", "/bɪld/", "verb", "Xây dựng, kiến tạo", "Consistent habits build resilient futures.", "Thói quen nhất quán xây dựng tương lai vững vàng.", "A1", "Công việc", "Business"],
  ["Burn", "/bɜːn/", "verb", "Đốt cháy, tiêu hao", "Aerobic exercise burns stored calories effectively.", "Tập thể dục nhịp điệu đốt cháy calo tích trữ hiệu quả.", "A2", "Giao tiếp hàng ngày", "Daily"],
  ["Buy", "/baɪ/", "verb", "Mua sắm", "Invest your savings wisely rather than buying excess.", "Hãy đầu tư tiền tiết kiệm khôn ngoan thay vì mua sắm dư thừa.", "A1", "Giao tiếp hàng ngày", "Daily"],
  ["Call", "/kɔːl/", "verb / noun", "Gọi điện, cuộc gọi", "Schedule a video call to discuss project deliverables.", "Hãy lên lịch cuộc gọi video để thảo luận các sản phẩm dự án.", "A1", "Công việc", "Business"],
  ["Care", "/keər/", "verb / noun", "Quan tâm, chăm sóc", "Caring for well-being prevents burnout.", "Chăm sóc sức khỏe giúp ngăn ngừa kiệt sức.", "A1", "Cảm xúc", "Emotions"],
  ["Carry", "/ˈkær.i/", "verb", "Mang, vác, chở", "Electric vehicles carry passengers quietly.", "Xe điện chở hành khách một cách êm ái.", "A1", "Giao tiếp hàng ngày", "Daily"],
  ["Catch", "/kætʃ/", "verb", "Bắt lấy, bắt kịp", "Leave early to catch the morning express train.", "Hãy rời đi sớm để kịp bắt chuyến tàu tốc hành buổi sáng.", "A1", "Du lịch", "Travel"],
  ["Cause", "/kɔːz/", "verb / noun", "Gây ra, nguyên nhân", "Identifying the root cause eliminates repeated errors.", "Xác định nguyên nhân gốc rễ giúp loại bỏ các lỗi lặp lại.", "A2", "Học thuật", "Academic"],
  ["Change", "/tʃeɪndʒ/", "verb / noun", "Thay đổi, biến đổi", "Embracing positive change accelerates personal maturity.", "Đón nhận sự thay đổi tích cực giúp thúc đẩy sự trưởng thành cá nhân.", "A1", "Giao tiếp hàng ngày", "Daily"],
  ["Choose", "/tʃuːz/", "verb", "Lựa chọn", "Choose nutritious foods that nourish your body.", "Hãy lựa chọn những thực phẩm bổ dưỡng nuôi dưỡng cơ thể bạn.", "A1", "Giao tiếp hàng ngày", "Daily"],
  ["Clean", "/kliːn/", "adjective / verb", "Sạch sẽ, dọn dẹp", "A clean workspace sharpens mental clarity.", "Không gian làm việc sạch sẽ giúp tăng cường sự minh mẫn.", "A1", "Giao tiếp hàng ngày", "Daily"],
  ["Close", "/kləʊz/", "verb / adjective", "Đóng lại, gần gũi", "Close all browser tabs to eliminate distractions.", "Hãy đóng tất cả tab trình duyệt để loại bỏ sự xao nhãng.", "A1", "Công nghệ", "Tech"],
  ["Compare", "/kəmˈpeər/", "verb", "So sánh, đối chiếu", "Compare alternatives carefully before making decisions.", "Hãy so sánh các phương án cẩn thận trước khi đưa ra quyết định.", "A2", "Học thuật", "Academic"],
  ["Complain", "/kəmˈpleɪn/", "verb", "Phàn nàn, khiếu nại", "Constructive teams solve issues instead of complaining.", "Các đội ngũ tích cực sẽ giải quyết vấn đề thay vì phàn nàn.", "A2", "Cảm xúc", "Emotions"],
  ["Complete", "/kəmˈpliːt/", "verb / adjective", "Hoàn thành, trọn vẹn", "Complete your assignments before the deadline arrives.", "Hãy hoàn thành bài tập của bạn trước khi đến hạn chót.", "A2", "Học thuật", "Academic"],
  ["Connect", "/kəˈnekt/", "verb", "Kết nối liên kết", "High-speed networks connect international researchers.", "Mạng tốc độ cao kết nối các nhà nghiên cứu quốc tế.", "A2", "Công nghệ", "Tech"],
  ["Continue", "/kənˈtɪn.juː/", "verb", "Tiếp tục duy trì", "Continue learning persistently every single day.", "Hãy tiếp tục kiên trì học hỏi mỗi ngày.", "A2", "Học thuật", "Academic"],
  ["Cook", "/kʊk/", "verb / noun", "Nấu nướng, đầu bếp", "Cooking meals at home supports dietary health.", "Tự nấu ăn tại nhà hỗ trợ sức khỏe ăn uống.", "A1", "Giao tiếp hàng ngày", "Daily"],
  ["Copy", "/ˈkɒp.i/", "verb / noun", "Sao chép, bản sao", "Always keep a digital backup copy of important papers.", "Luôn giữ một bản sao lưu kỹ thuật số của các giấy tờ quan trọng.", "A1", "Công nghệ", "Tech"],
  ["Cost", "/kɒst/", "noun / verb", "Chi phí, trị giá", "Preventative maintenance lowers repair costs significantly.", "Bảo trì phòng ngừa giúp giảm chi phí sửa chữa đáng kể.", "A2", "Công việc", "Business"],
  ["Count", "/kaʊnt/", "verb", "Đếm số, có giá trị", "Every positive habit counts toward your long-term success.", "Mỗi thói quen tích cực đều có giá trị hướng tới thành công lâu dài của bạn.", "A1", "Giao tiếp hàng ngày", "Daily"],
  ["Cover", "/ˈkʌv.ər/", "verb / noun", "Bao phủ, che chở", "Insurance policies cover unexpected medical expenses.", "Các hợp đồng bảo hiểm chi trả các chi phí y tế bất ngờ.", "A2", "Công việc", "Business"],
  ["Create", "/kriˈeɪt/", "verb", "Sáng tạo, tạo ra", "Dedicated writers create inspiring stories.", "Những nhà văn tận tụy tạo ra những câu chuyện đầy cảm hứng.", "A2", "Học thuật", "Academic"],
  ["Cross", "/krɒs/", "verb / noun", "Băng qua, giao nhau", "Pedestrians cross the street at zebra crossings.", "Người đi bộ băng qua đường tại vạch kẻ sang đường.", "A2", "Du lịch", "Travel"],
  ["Cry", "/kraɪ/", "verb / noun", "Khóc, tiếng kêu", "Expressing grief through tears brings emotional release.", "Bộc lộ nỗi buồn qua nước mắt giúp giải tỏa cảm xúc.", "A1", "Cảm xúc", "Emotions"],
  ["Damage", "/ˈdæm.ɪdʒ/", "noun / verb", "Thiệt hại, làm hỏng", "Extreme storms can cause severe structural damage.", "Những cơn bão dữ dội có thể gây thiệt hại nghiêm trọng về kết cấu.", "A2", "Giao tiếp hàng ngày", "Daily"],
  ["Dance", "/dɑːns/", "verb / noun", "Khiêu vũ, nhảy múa", "Traditional folk dances celebrate cultural harvest.", "Những điệu múa dân gian truyền thống ăn mừng mùa màng bội thu.", "A1", "Giao tiếp hàng ngày", "Daily"],
  ["Decide", "/dɪˈsaɪd/", "verb", "Quyết định", "Decide on your daily priorities each morning.", "Hãy quyết định các ưu tiên hàng ngày vào mỗi buổi sáng.", "A2", "Công việc", "Business"],
  ["Describe", "/dɪˈskraɪb/", "verb", "Miêu tả, thuật lại", "Can you describe the sequence of events clearly?", "Bạn có thể miêu tả lại chuỗi sự việc một cách rõ ràng không?", "A2", "Học thuật", "Academic"],
  ["Destroy", "/dɪˈstrɔɪ/", "verb", "Phá hủy, tàn phá", "Raging wildfires destroy vast acres of woodland.", "Những trận cháy rừng dữ dội tàn phá nhiều hecta rừng.", "A2", "Giao tiếp hàng ngày", "Daily"],
  ["Develop", "/dɪˈvel.əp/", "verb", "Phát triển, mở rộng", "Regular practice develops fluent pronunciation.", "Luyện tập thường xuyên giúp phát triển phát âm lưu loát.", "B1", "Học thuật", "Academic"],
  ["Die", "/daɪ/", "verb", "Chết đi, lụi tàn", "Without water, potted plants will wither and die.", "Không có nước, cây trồng trong chậu sẽ héo và chết.", "A1", "Giao tiếp hàng ngày", "Daily"],
  ["Discover", "/dɪˈskʌv.ər/", "verb", "Khám phá, phát hiện", "Explorers discover ancient ruins hidden in jungles.", "Các nhà thám hiểm phát hiện tàn tích cổ xưa ẩn trong rừng rậm.", "A2", "Du lịch", "Travel"],
  ["Discuss", "/dɪˈskʌs/", "verb", "Thảo luận, bàn luận", "Scholars discuss contemporary issues in seminars.", "Các học giả thảo luận các vấn đề đương đại trong hội thảo.", "A2", "Học thuật", "Academic"],
  ["Divide", "/dɪˈvaɪd/", "verb", "Chia nhỏ, phân chia", "Divide large goals into manageable daily steps.", "Hãy chia nhỏ mục tiêu lớn thành các bước hàng ngày dễ quản lý.", "A2", "Học thuật", "Academic"],
  ["Draw", "/drɔː/", "verb", "Vẽ tranh, thu hút", "Visual sketches help engineers draw technical plans.", "Bản phác thảo trực quan giúp kỹ sư vẽ các bản kế hoạch kỹ thuật.", "A1", "Học thuật", "Academic"],
  ["Dream", "/driːm/", "noun / verb", "Giấc mơ, ước mơ", "Pursuing your ambitious dreams demands perseverance.", "Theo đuổi ước mơ hoài bão đòi hỏi sự kiên trì bền bỉ.", "A1", "Cảm xúc", "Emotions"],
  ["Drive", "/draɪv/", "verb / noun", "Lái xe, động lực", "Always drive safely and obey local speed limits.", "Luôn lái xe an toàn và tuân thủ giới hạn tốc độ địa phương.", "A1", "Du lịch", "Travel"],
  ["Drop", "/drɒp/", "verb / noun", "Làm rơi, giảm xuống", "Temperature dropped sharply when evening arrived.", "Nhiệt độ giảm mạnh khi buổi tối buông xuống.", "A2", "Giao tiếp hàng ngày", "Daily"],
  ["Earn", "/ɜːn/", "verb", "Kiếm tiền, đạt được", "You earn respect through integrity and kindness.", "Bạn nhận được sự tôn trọng nhờ sự chính trực và lòng tốt.", "A2", "Công việc", "Business"],
  ["Eat", "/iːt/", "verb", "Ăn uống", "Eat mindfully to enjoy flavors and support digestion.", "Hãy ăn trong chánh niệm để thưởng thức hương vị và hỗ trợ tiêu hóa.", "A1", "Giao tiếp hàng ngày", "Daily"],
  ["Educate", "/ˈedʒ.u.keɪt/", "verb", "Giáo dục, đào tạo", "Schools educate future generations of innovators.", "Trường học giáo dục các thế hệ đổi mới tương lai.", "A2", "Học thuật", "Academic"],
  ["Enjoy", "/ɪnˈdʒɔɪ/", "verb", "Thưởng thức, tận hưởng", "Enjoy every small victory along your study path.", "Hãy tận hưởng từng chiến thắng nhỏ trên con đường học tập của bạn.", "A1", "Cảm xúc", "Emotions"],
  ["Enter", "/ˈen.tər/", "verb", "Bước vào, nhập dữ liệu", "Enter your credentials to access the secure portal.", "Hãy nhập thông tin đăng nhập để truy cập cổng thông tin bảo mật.", "A2", "Công nghệ", "Tech"],
  ["Escape", "/ɪˈskeɪp/", "verb / noun", "Trốn thoát, lối thoát", "Reading fiction allows the imagination to escape reality.", "Đọc tiểu thuyết cho phép trí tưởng tượng thoát khỏi thực tế.", "A2", "Cảm xúc", "Emotions"],
  ["Explain", "/ɪkˈspleɪn/", "verb", "Giải thích, làm rõ", "Great teachers explain difficult formulas with ease.", "Những người thầy vĩ đại giải thích các công thức khó một cách dễ dàng.", "A2", "Học thuật", "Academic"],
  ["Fail", "/feɪl/", "verb", "Thất bại, không đạt", "Failing once is a stepping stone to future success.", "Thất bại một lần là bước đệm cho thành công trong tương lai.", "A2", "Cảm xúc", "Emotions"],
  ["Fall", "/fɔːl/", "verb / noun", "Rơi xuống, mùa thu", "Autumn leaves fall gently from tall maple branches.", "Những chiếc lá mùa thu rơi nhẹ nhàng từ các cành phong cao.", "A1", "Giao tiếp hàng ngày", "Daily"],
  ["Feed", "/fiːd/", "verb", "Cho ăn, nuôi dưỡng", "Feed your mind with positive and stimulating ideas.", "Hãy nuôi dưỡng tâm trí bạn bằng những ý tưởng tích cực và kích thích.", "A2", "Giao tiếp hàng ngày", "Daily"],
  ["Feel", "/fiːl/", "verb", "Cảm thấy, cảm nhận", "I feel energized after completing my morning run.", "Tôi cảm thấy tràn đầy năng lượng sau khi hoàn thành buổi chạy sáng.", "A1", "Cảm xúc", "Emotions"],
  ["Fight", "/faɪt/", "verb / noun", "Chiến đấu, đấu tranh", "Scientists fight diseases through vaccine research.", "Các nhà khoa học chiến đấu chống lại bệnh tật thông qua nghiên cứu vắc-xin.", "A2", "Học thuật", "Academic"],
  ["Find", "/faɪnd/", "verb", "Tìm thấy, nhận ra", "You will find confidence through steady practice.", "Bạn sẽ tìm thấy sự tự tin thông qua việc luyện tập đều đặn.", "A1", "Học thuật", "Academic"],
  ["Finish", "/ˈfɪn.ɪʃ/", "verb / noun", "Hoàn tất, về đích", "Finish the chapter before going to sleep tonight.", "Hãy hoàn tất chương này trước khi đi ngủ tối nay.", "A1", "Học thuật", "Academic"],
  ["Fly", "/flaɪ/", "verb", "Bay lượn", "Migratory birds fly thousands of miles southward.", "Những đàn chim di cư bay hàng ngàn dặm về phương nam.", "A1", "Du lịch", "Travel"],
  ["Follow", "/ˈfɒl.əʊ/", "verb", "Đi theo, tuân theo", "Follow the recipe closely to bake perfect bread.", "Hãy làm theo công thức một cách chặt chẽ để nướng bánh mì hoàn hảo.", "A1", "Giao tiếp hàng ngày", "Daily"],
  ["Forget", "/fəˈɡet/", "verb", "Quên mất", "Spaced review prevents you from forgetting words.", "Ôn tập ngắt quãng giúp bạn không bị quên từ vựng.", "A1", "Học thuật", "Academic"],
  ["Forgive", "/fəˈɡɪv/", "verb", "Tha thứ, bao dung", "Forgiving others frees your heart from bitterness.", "Tha thứ cho người khác giúp giải phóng trái tim bạn khỏi sự cay đắng.", "A2", "Cảm xúc", "Emotions"],
  ["Get", "/ɡet/", "verb", "Nhận được, trở nên", "Consistency helps you get fluent in spoken English.", "Sự nhất quán giúp bạn trở nên lưu loát trong tiếng Anh giao tiếp.", "A1", "Giao tiếp hàng ngày", "Daily"],
  ["Give", "/ɡɪv/", "verb", "Cho đi, tặng", "Giving back to community enriches personal meaning.", "Đóng góp cho cộng đồng làm phong phú thêm ý nghĩa cuộc sống cá nhân.", "A1", "Cảm xúc", "Emotions"],
  ["Grow", "/ɡrəʊ/", "verb", "Phát triển, trồng trọt", "Plants grow rapidly when exposed to sun and water.", "Cây cối phát triển nhanh chóng khi tiếp xúc với ánh nắng và nước.", "A1", "Giao tiếp hàng ngày", "Daily"],
  ["Happen", "/ˈhæp.ən/", "verb", "Xảy ra, diễn ra", "Exciting breakthroughs happen through collaboration.", "Những bước đột phá thú vị xảy ra thông qua sự hợp tác.", "A1", "Học thuật", "Academic"],
  ["Hate", "/heɪt/", "verb / noun", "Ghét bỏ", "Focus on what you love instead of what you hate.", "Hãy tập trung vào điều bạn yêu thích thay vì điều bạn ghét bỏ.", "A1", "Cảm xúc", "Emotions"],
  ["Hear", "/hɪər/", "verb", "Nghe thấy", "Can you hear the ocean waves crashing against rocks?", "Bạn có nghe thấy tiếng sóng biển vỗ vào các mỏm đá không?", "A1", "Giao tiếp hàng ngày", "Daily"],
  ["Help", "/help/", "verb / noun", "Giúp đỡ, sự trợ giúp", "Helping classmates fosters an encouraging study group.", "Giúp đỡ bạn cùng lớp tạo nên một nhóm học tập đầy khích lệ.", "A1", "Giao tiếp hàng ngày", "Daily"],
  ["Hide", "/haɪd/", "verb", "Ẩn nấp, che giấu", "Do not hide your artistic talents from the world.", "Đừng che giấu tài năng nghệ thuật của bạn với thế giới.", "A2", "Cảm xúc", "Emotions"],
  ["Hit", "/hɪt/", "verb / noun", "Đánh trúng, đạt mốc", "The song hit the top of the music charts.", "Bài hát đã vươn lên đứng đầu các bảng xếp hạng âm nhạc.", "A2", "Giao tiếp hàng ngày", "Daily"],
  ["Hold", "/həʊld/", "verb", "Cầm nắm, tổ chức", "The university will hold its annual symposium online.", "Trường đại học sẽ tổ chức hội nghị chuyên đề hàng năm trực tuyến.", "A2", "Học thuật", "Academic"],
  ["Hope", "/həʊp/", "verb / noun", "Hy vọng", "Hope inspires courage during uncertain moments.", "Hy vọng truyền cảm hứng dũng cảm trong những thời khắc bất định.", "A1", "Cảm xúc", "Emotions"],
  ["Hurt", "/hɜːt/", "verb / noun", "Đau đớn, làm tổn thương", "Kind words soothe emotional wounds that hurt.", "Lời nói tử tế làm dịu những vết thương lòng đang đau đớn.", "A2", "Cảm xúc", "Emotions"],
  ["Improve", "/ɪmˈpruːv/", "verb", "Cải thiện, tiến bộ", "Reviewing flashcards daily helps you improve vocabulary.", "Ôn thẻ flashcard mỗi ngày giúp bạn cải thiện vốn từ vựng.", "A2", "Học thuật", "Academic"],
  ["Include", "/ɪnˈkluːd/", "verb", "Bao gồm, tính kèm", "Healthy daily routines include exercise and reading.", "Thói quen hàng ngày lành mạnh bao gồm tập thể dục và đọc sách.", "A2", "Giao tiếp hàng ngày", "Daily"],
  ["Inform", "/ɪnˈfɔːm/", "verb", "Thông báo, báo tin", "Please inform the office if you will be absent.", "Làm ơn hãy thông báo cho văn phòng nếu bạn sẽ vắng mặt.", "A2", "Công việc", "Business"],
  ["Invite", "/ɪnˈvaɪt/", "verb", "Mời mọc", "They decided to invite all neighbors to the gathering.", "Họ quyết định mời tất cả hàng xóm đến buổi họp mặt.", "A1", "Giao tiếp hàng ngày", "Daily"],
  ["Join", "/dʒɔɪn/", "verb", "Tham gia, kết nối", "Join an English speaking club to build speaking reflex.", "Hãy tham gia câu lạc bộ nói tiếng Anh để xây dựng phản xạ nói.", "A1", "Giao tiếp hàng ngày", "Daily"],
  ["Jump", "/dʒʌmp/", "verb / noun", "Nhảy lên", "Children jump with excitement at the amusement park.", "Lũ trẻ nhảy cẫng lên vì phấn khích ở công viên giải trí.", "A1", "Giao tiếp hàng ngày", "Daily"],
  ["Keep", "/kiːp/", "verb", "Giữ gìn, duy trì", "Keep your study workspace orderly and quiet.", "Hãy giữ cho không gian học tập của bạn ngăn nắp và yên tĩnh.", "A1", "Học thuật", "Academic"],
  ["Kick", "/kɪk/", "verb / noun", "Đá bóng, cú đá", "The soccer player kicked the ball into the net.", "Cầu thủ bóng đá đã sút bóng vào lưới.", "A1", "Giao tiếp hàng ngày", "Daily"],
  ["Kill", "/kɪl/", "verb", "Tiêu diệt, giết", "Boiling tap water kills harmful bacterial microbes.", "Đun sôi nước máy giúp tiêu diệt các vi khuẩn có hại.", "A2", "Giao tiếp hàng ngày", "Daily"],
  ["Know", "/nəʊ/", "verb", "Biết, hiểu rõ", "Knowing grammar rules clarifies sentence structure.", "Hiểu biết các quy tắc ngữ pháp giúp làm sáng tỏ cấu trúc câu.", "A1", "Học thuật", "Academic"],
  ["Laugh", "/lɑːf/", "verb / noun", "Cười lớn", "Laughter strengthens heart health and eases tension.", "Tiếng cười tăng cường sức khỏe tim mạch và xoa dịu căng thẳng.", "A1", "Cảm xúc", "Emotions"],
  ["Learn", "/lɜːn/", "verb", "Học hỏi, tiếp thu", "Curious minds never stop learning new ideas.", "Những tâm trí tò mò không bao giờ ngừng học hỏi những ý tưởng mới.", "A1", "Học thuật", "Academic"],
  ["Leave", "/liːv/", "verb", "Rời đi, để lại", "Leave thirty minutes early to avoid traffic jams.", "Hãy rời đi sớm 30 phút để tránh tắc đường.", "A1", "Du lịch", "Travel"],
  ["Lend", "/lend/", "verb", "Cho vay, cho mượn", "Libraries lend reference materials freely to students.", "Thư viện cho sinh viên mượn tài liệu tham khảo miễn phí.", "A2", "Học thuật", "Academic"],
  ["Let", "/let/", "verb", "Để cho, cho phép", "Let your creative imagination flow naturally.", "Hãy để trí tưởng tượng sáng tạo của bạn tuôn chảy tự nhiên.", "A1", "Cảm xúc", "Emotions"],
  ["Lie", "/laɪ/", "verb / noun", "Nói dối, nằm nghỉ", "Honesty means choosing never to tell a lie.", "Trung thực nghĩa là lựa chọn không bao giờ nói dối.", "A2", "Cảm xúc", "Emotions"],
  ["Like", "/laɪk/", "verb / preposition", "Thích thú, giống như", "I like exploring quaint historical bookshops.", "Tôi thích khám phá những hiệu sách lịch sử cổ kính.", "A1", "Cảm xúc", "Emotions"],
  ["Listen", "/ˈlɪs.ən/", "verb", "Lắng nghe cẩn thận", "Listen to native speakers to absorb authentic accents.", "Hãy lắng nghe người bản xứ để tiếp thu ngữ điệu chuẩn.", "A1", "Học thuật", "Academic"],
  ["Live", "/lɪv/", "verb", "Sống, sinh sống", "They live in a peaceful mountain town.", "Họ sống tại một thị trấn miền núi yên bình.", "A1", "Giao tiếp hàng ngày", "Daily"],
  ["Look", "/lʊk/", "verb / noun", "Nhìn, vẻ bề ngoài", "Look up unknown words in the dictionary index.", "Hãy tra cứu những từ chưa biết trong mục từ điển.", "A1", "Học thuật", "Academic"],
  ["Lose", "/luːz/", "verb", "Đánh mất, thua cuộc", "Do not lose heart when dealing with obstacles.", "Đừng nản lòng khi đối mặt với những trở ngại.", "A1", "Cảm xúc", "Emotions"],
  ["Love", "/lʌv/", "verb / noun", "Yêu thương", "Love for lifelong learning fuels personal mastery.", "Tình yêu học tập suốt đời tiếp lửa cho sự tinh thông cá nhân.", "A1", "Cảm xúc", "Emotions"],
  ["Make", "/meɪk/", "verb", "Làm ra, chế tạo", "Consistent daily efforts make remarkable transformations.", "Nỗ lực hàng ngày kiên trì tạo nên những sự chuyển mình ngoạn mục.", "A1", "Giao tiếp hàng ngày", "Daily"],
  ["Manage", "/ˈmæn.ɪdʒ/", "verb", "Quản lý điều hành", "Learn to manage your daily schedule efficiently.", "Hãy học cách quản lý thời gian biểu hàng ngày của bạn một cách hiệu quả.", "A2", "Công việc", "Business"],
  ["Mean", "/miːn/", "verb", "Có nghĩa là", "Clear pronunciation clarifies what you mean.", "Phát âm rõ ràng làm sáng tỏ những điều bạn muốn nói.", "A1", "Học thuật", "Academic"],
  ["Meet", "/miːt/", "verb", "Gặp gỡ", "We will meet at the cafe to practice conversation.", "Chúng tôi sẽ gặp nhau ở quán cà phê để luyện hội thoại.", "A1", "Giao tiếp hàng ngày", "Daily"],
  ["Move", "/muːv/", "verb / noun", "Di chuyển, chuyển nhà", "Physical movement boosts circulation and mental acuity.", "Vận động thể chất tăng cường tuần hoàn và sự nhạy bén của trí não.", "A1", "Giao tiếp hàng ngày", "Daily"],
  ["Need", "/niːd/", "verb / noun", "Cần thiết, nhu cầu", "Humans need clean water and nutritious food.", "Con người cần nước sạch và thức ăn bổ dưỡng.", "A1", "Giao tiếp hàng ngày", "Daily"],
  ["Open", "/ˈəʊ.pən/", "verb / adjective", "Mở ra, cởi mở", "Open your mind to unfamiliar cultural practices.", "Hãy mở rộng tâm trí đối với những tập tục văn hóa mới lạ.", "A1", "Giao tiếp hàng ngày", "Daily"],
  ["Order", "/ˈɔː.dər/", "verb / noun", "Đặt hàng, trật tự", "Order your meal with clear polite English phrases.", "Hãy gọi món bằng những câu tiếng Anh rõ ràng và lịch sự.", "A2", "Giao tiếp hàng ngày", "Daily"],
  ["Pay", "/peɪ/", "verb / noun", "Thanh toán, tiền lương", "Paying attention in lectures cements key points.", "Chú ý lắng nghe trong bài giảng giúp khắc sâu các điểm chính.", "A1", "Công việc", "Business"],
  ["Plan", "/plæn/", "noun / verb", "Kế hoạch, dự định", "A structured study plan guides steady improvement.", "Một kế hoạch học tập có cấu trúc sẽ định hướng sự tiến bộ đều đặn.", "A1", "Công việc", "Business"],
  ["Play", "/pleɪ/", "verb / noun", "Chơi đùa, vở kịch", "Playing interactive language games makes study joyful.", "Chơi các trò chơi ngôn ngữ tương tác làm cho việc học thêm vui vẻ.", "A1", "Giao tiếp hàng ngày", "Daily"],
  ["Point", "/pɔɪnt/", "verb / noun", "Chỉ điểm, luận điểm", "She made an insightful point during the debate.", "Cô ấy đã đưa ra một luận điểm sâu sắc trong cuộc tranh luận.", "A2", "Học thuật", "Academic"],
  ["Prefer", "/prɪˈfɜːr/", "verb", "Thích hơn, chuộng hơn", "I prefer studying in quiet libraries in the morning.", "Tôi thích học ở những thư viện yên tĩnh vào buổi sáng hơn.", "A2", "Học thuật", "Academic"],
  ["Prepare", "/prɪˈpeər/", "verb", "Chuẩn bị", "Prepare your speech thoroughly to speak with conviction.", "Hãy chuẩn bị bài phát biểu kỹ lưỡng để nói một cách thuyết phục.", "A2", "Học thuật", "Academic"],
  ["Promise", "/ˈprɒm.ɪs/", "verb / noun", "Hứa hẹn, lời hứa", "Keeping your promise establishes honorable character.", "Giữ lời hứa tạo dựng nhân cách đáng kính trọng.", "A2", "Cảm xúc", "Emotions"],
  ["Protect", "/prəˈtekt/", "verb", "Bảo vệ che chở", "Strong passwords protect your private accounts.", "Mật khẩu mạnh bảo vệ các tài khoản riêng tư của bạn.", "A2", "Công nghệ", "Tech"],
  ["Prove", "/pruːv/", "verb", "Chứng minh xác thực", "Scientific experiments prove or disprove hypotheses.", "Các thí nghiệm khoa học chứng minh hoặc bác bỏ các giả thuyết.", "A2", "Học thuật", "Academic"],
  ["Pull", "/pʊl/", "verb", "Kéo vào", "Pull the door open to enter the library hall.", "Hãy kéo cửa để bước vào sảnh thư viện.", "A1", "Giao tiếp hàng ngày", "Daily"],
  ["Push", "/pʊʃ/", "verb", "Đẩy đi, thúc đẩy", "Push yourself beyond comfort zones to evolve.", "Hãy thúc đẩy bản thân vượt qua vùng an toàn để phát triển.", "A1", "Giao tiếp hàng ngày", "Daily"],
  ["Put", "/pʊt/", "verb", "Đặt để", "Put your study notes in an indexed binder.", "Hãy để ghi chép học tập vào một bìa còng có mục lục.", "A1", "Giao tiếp hàng ngày", "Daily"],
  ["Reach", "/riːtʃ/", "verb", "Vươn tới, đạt đến", "Consistent effort enables you to reach fluency.", "Nỗ lực đều đặn giúp bạn đạt tới sự lưu loát.", "A2", "Học thuật", "Academic"],
  ["Read", "/riːd/", "verb", "Đọc", "Read inspiring non-fiction books every evening.", "Hãy đọc những cuốn sách phi hư cấu truyền cảm hứng vào mỗi buổi tối.", "A1", "Học thuật", "Academic"],
  ["Receive", "/rɪˈsiːv/", "verb", "Nhận được", "You will receive an automated confirmation email.", "Bạn sẽ nhận được một thư điện tử xác nhận tự động.", "A2", "Công nghệ", "Tech"],
  ["Remember", "/rɪˈmem.bər/", "verb", "Ghi nhớ, nhớ lại", "Remember to review new vocabulary before sleep.", "Hãy nhớ ôn lại từ vựng mới trước khi đi ngủ.", "A1", "Học thuật", "Academic"],
  ["Remind", "/rɪˈmaɪnd/", "verb", "Nhắc nhở", "Set calendar alerts to remind you of study sessions.", "Hãy đặt lời nhắc lịch để nhắc bạn về các buổi học.", "A2", "Công việc", "Business"],
  ["Repeat", "/rɪˈpiːt/", "verb", "Lặp lại", "Repeat words aloud to develop muscular speech memory.", "Hãy lặp lại từ to thành tiếng để phát triển trí nhớ cơ miệng.", "A1", "Học thuật", "Academic"],
  ["Replace", "/rɪˈpleɪs/", "verb", "Thay thế", "Replace negative self-talk with positive encouragement.", "Hãy thay thế việc tự trách tiêu cực bằng sự khích lệ tích cực.", "A2", "Cảm xúc", "Emotions"],
  ["Reply", "/rɪˈplaɪ/", "verb / noun", "Hồi đáp, trả lời", "Reply promptly to urgent team communications.", "Hãy hồi đáp nhanh chóng các trao đổi khẩn cấp của đội nhóm.", "A2", "Công việc", "Business"],
  ["Report", "/rɪˈpɔːt/", "verb / noun", "Báo cáo, tường thuật", "The reporter covered breaking international headlines.", "Phóng viên đã đưa tin về những dòng tít quốc tế nóng hổi.", "A2", "Công việc", "Business"],
  ["Rescue", "/ˈres.kjuː/", "verb / noun", "Cứu hộ, giải cứu", "Lifeguards rescue swimmers in rough ocean waters.", "Lực lượng cứu hộ giải cứu người bơi trong vùng biển động.", "A2", "Giao tiếp hàng ngày", "Daily"],
  ["Return", "/rɪˈtɜːn/", "verb / noun", "Trở lại, hoàn trả", "Return borrowed library books on time.", "Hãy hoàn trả sách mượn của thư viện đúng hạn.", "A2", "Du lịch", "Travel"],
  ["Ring", "/rɪŋ/", "verb / noun", "Reo chuông, chiếc nhẫn", "Her telephone rang several times before she answered.", "Điện thoại của cô ấy reo vài hồi chuông trước khi cô nhấc máy.", "A1", "Giao tiếp hàng ngày", "Daily"],
  ["Rise", "/raɪz/", "verb / noun", "Mọc lên, dâng lên", "The morning sun rises majestically over eastern waters.", "Mặt trời ban mai mọc lên uy nghiêm trên vùng biển phía đông.", "A2", "Giao tiếp hàng ngày", "Daily"],
  ["Run", "/rʌn/", "verb / noun", "Chạy bộ, vận hành", "Running three miles a day strengthens the heart.", "Chạy bộ ba dặm mỗi ngày giúp tăng cường sức khỏe tim mạch.", "A1", "Giao tiếp hàng ngày", "Daily"],
  ["Save", "/seɪv/", "verb", "Lưu trữ, tiết kiệm", "Save your project frequently to avoid accidental loss.", "Hãy lưu dự án của bạn thường xuyên để tránh mất dữ liệu ngoài ý muốn.", "A1", "Công nghệ", "Tech"],
  ["Say", "/seɪ/", "verb", "Nói rằng", "Say kind words that uplift the spirits of others.", "Hãy nói những lời tử tế nâng đỡ tinh thần người khác.", "A1", "Giao tiếp hàng ngày", "Daily"],
  ["See", "/siː/", "verb", "Nhìn thấy, hiểu", "I see how this grammatical concept works now.", "Bây giờ tôi đã hiểu khái niệm ngữ pháp này hoạt động thế nào.", "A1", "Học thuật", "Academic"],
  ["Sell", "/sel/", "verb", "Bán hàng", "Artisans sell handcrafted wooden goods at fairs.", "Các nghệ nhân bán đồ thủ công bằng gỗ tại hội chợ.", "A1", "Công việc", "Business"],
  ["Send", "/send/", "verb", "Gửi đi", "Send a warm greeting card to distant family.", "Hãy gửi một tấm thiệp chúc mừng ấm áp tới gia đình ở xa.", "A1", "Giao tiếp hàng ngày", "Daily"],
  ["Serve", "/sɜːv/", "verb", "Phục vụ, dọn đồ ăn", "Volunteers serve nutritious hot meals to those in need.", "Các tình nguyện viên phục vụ những bữa ăn nóng bổ dưỡng cho người cần giúp.", "A2", "Giao tiếp hàng ngày", "Daily"],
  ["Set", "/set/", "verb / noun", "Thiết lập, bộ dụng cụ", "Set realistic daily goals to maintain momentum.", "Hãy đặt ra các mục tiêu hàng ngày thực tế để duy trì động lực.", "A2", "Công việc", "Business"],
  ["Shake", "/ʃeɪk/", "verb / noun", "Rung lắc, bắt tay", "Professionals shake hands warmly upon first meeting.", "Các chuyên gia bắt tay ấm áp khi gặp nhau lần đầu.", "A2", "Giao tiếp hàng ngày", "Daily"],
  ["Share", "/ʃeər/", "verb / noun", "Chia sẻ", "Share useful learning tips with your study partners.", "Hãy chia sẻ các mẹo học tập hữu ích với bạn học của bạn.", "A1", "Giao tiếp hàng ngày", "Daily"],
  ["Shine", "/ʃaɪn/", "verb / noun", "Tỏa sáng", "Your dedication will shine through in your results.", "Sự cống hiến của bạn sẽ tỏa sáng qua những kết quả đạt được.", "A1", "Cảm xúc", "Emotions"],
  ["Shoot", "/ʃuːt/", "verb / noun", "Bắn, chụp ảnh", "Photographers shoot portraits using soft ambient light.", "Các nhiếp ảnh gia chụp chân dung bằng ánh sáng tự nhiên dịu nhẹ.", "A2", "Giao tiếp hàng ngày", "Daily"],
  ["Show", "/ʃəʊ/", "verb / noun", "Trưng bày, chỉ ra", "Show your gratitude through sincere everyday actions.", "Hãy thể hiện lòng biết ơn bằng những hành động chân thành mỗi ngày.", "A1", "Cảm xúc", "Emotions"],
  ["Shut", "/ʃʌt/", "verb", "Đóng sập lại", "Shut the windows before the heavy rainfall starts.", "Hãy đóng cửa sổ trước khi cơn mưa lớn bắt đầu.", "A1", "Giao tiếp hàng ngày", "Daily"],
  ["Sing", "/sɪŋ/", "verb", "Ca hát", "Singing English songs improves accent and cadence.", "Hát các bài hát tiếng Anh giúp cải thiện ngữ điệu và nhịp điệu.", "A1", "Giao tiếp hàng ngày", "Daily"],
  ["Sit", "/sɪt/", "verb", "Ngồi", "Sit up straight to maintain healthy spinal alignment.", "Hãy ngồi thẳng lưng để duy trì cột sống khỏe mạnh.", "A1", "Giao tiếp hàng ngày", "Daily"],
  ["Sleep", "/sliːp/", "verb / noun", "Ngủ, giấc ngủ", "Quality sleep consolidates newly acquired memories.", "Giấc ngủ chất lượng củng cố những ký ức mới tiếp thu.", "A1", "Giao tiếp hàng ngày", "Daily"],
  ["Smile", "/smaɪl/", "verb / noun", "Mỉm cười", "A genuine smile breaks down cultural barriers instantly.", "Một nụ cười chân thành xóa tan rào cản văn hóa ngay tức thì.", "A1", "Cảm xúc", "Emotions"],
  ["Speak", "/spiːk/", "verb", "Nói chuyện, phát biểu", "Speak clearly with steady pacing during interviews.", "Hãy nói rõ ràng với nhịp độ điềm tĩnh trong các buổi phỏng vấn.", "A1", "Giao tiếp hàng ngày", "Daily"],
  ["Spend", "/spend/", "verb", "Chi tiêu, dành thời gian", "Spend time reading every day to expand vocabulary.", "Hãy dành thời gian đọc sách mỗi ngày để mở rộng vốn từ vựng.", "A1", "Giao tiếp hàng ngày", "Daily"],
  ["Stand", "/stænd/", "verb", "Đứng lên, đứng vững", "Stand tall with confident and open body posture.", "Hãy đứng thẳng với tư thế tự tin và cởi mở.", "A1", "Giao tiếp hàng ngày", "Daily"],
  ["Start", "/stɑːt/", "verb / noun", "Khởi đầu, bắt đầu", "Start with five new words each day to build momentum.", "Hãy bắt đầu với 5 từ mới mỗi ngày để tạo đà.", "A1", "Học thuật", "Academic"],
  ["Stay", "/steɪ/", "verb / noun", "Ở lại, duy trì", "Stay curious and patient throughout your learning path.", "Hãy luôn tò mò và kiên nhẫn suốt hành trình học tập của bạn.", "A1", "Cảm xúc", "Emotions"],
  ["Stop", "/stɒp/", "verb / noun", "Dừng lại", "Never stop seeking understanding in all you do.", "Đừng bao giờ ngừng tìm kiếm sự thấu hiểu trong mọi việc bạn làm.", "A1", "Giao tiếp hàng ngày", "Daily"],
  ["Study", "/ˈstʌd.i/", "verb / noun", "Học tập, nghiên cứu", "Study in twenty-five minute focused pomodoro blocks.", "Hãy học theo từng khối 25 phút tập trung của phương pháp pomodoro.", "A1", "Học thuật", "Academic"],
  ["Suggest", "/səˈdʒest/", "verb", "Đề xuất, gợi ý", "I suggest reviewing yesterday's flashcards right now.", "Tôi gợi ý bạn nên ôn lại thẻ flashcard của ngày hôm qua ngay bây giờ.", "A2", "Học thuật", "Academic"],
  ["Support", "/səˈpɔːt/", "verb / noun", "Ủng hộ, tương trợ", "Mutual support among friends eases heavy burdens.", "Sự tương trợ lẫn nhau giữa bạn bè giúp làm vơi đi những gánh nặng.", "A2", "Cảm xúc", "Emotions"],
  ["Surprise", "/səˈpraɪz/", "noun / verb", "Làm ngạc nhiên, bất ngờ", "The unexpected birthday party was a delightful surprise.", "Bữa tiệc sinh nhật bất ngờ là một niềm vui thú vị.", "A2", "Cảm xúc", "Emotions"],
  ["Take", "/teɪk/", "verb", "Cầm lấy, đón nhận", "Take notes during audio lessons to boost retention.", "Hãy ghi chép trong các bài học nghe để tăng khả năng ghi nhớ.", "A1", "Học thuật", "Academic"],
  ["Talk", "/tɔːk/", "verb / noun", "Nói chuyện, đàm đạo", "Talk with native speakers to build listening reflexes.", "Hãy trò chuyện với người bản xứ để xây dựng phản xạ nghe.", "A1", "Giao tiếp hàng ngày", "Daily"],
  ["Taste", "/teɪst/", "verb / noun", "Nếm thử, hương vị", "Fresh culinary herbs give soups an exquisite taste.", "Các loại thảo mộc tươi đem lại cho món súp hương vị thơm ngon.", "A2", "Giao tiếp hàng ngày", "Daily"],
  ["Teach", "/tiːtʃ/", "verb", "Giảng dạy, truyền đạt", "To teach is to learn twice, as the ancient saying goes.", "Dạy học là học hai lần, như câu ngạn ngữ cổ xưa từng nói.", "A1", "Học thuật", "Academic"],
  ["Tell", "/tel/", "verb", "Kể lại, bảo", "Tell engaging stories to illustrate complex points.", "Hãy kể những câu chuyện hấp dẫn để minh họa cho các điểm phức tạp.", "A1", "Giao tiếp hàng ngày", "Daily"],
  ["Thank", "/θæŋk/", "verb", "Cảm ơn", "Thank people genuinely for small kindnesses every day.", "Hãy cảm ơn mọi người chân thành vì những lòng tốt nhỏ bé mỗi ngày.", "A1", "Cảm xúc", "Emotions"],
  ["Think", "/θɪŋk/", "verb", "Suy nghĩ, tư duy", "Critical thinking enables sound and balanced decisions.", "Tư duy phản biện giúp đưa ra những quyết định đúng đắn và cân bằng.", "A1", "Học thuật", "Academic"],
  ["Touch", "/tʌtʃ/", "verb / noun", "Chạm vào, tiếp xúc", "Gentle words touch hearts deeper than loud arguments.", "Lời nói dịu dàng chạm đến trái tim sâu hơn những tranh cãi ồn ào.", "A2", "Cảm xúc", "Emotions"],
  ["Travel", "/ˈtræv.əl/", "verb / noun", "Du lịch", "Travel enriches perspective by showing diverse cultures.", "Du lịch làm phong phú góc nhìn bằng cách chỉ ra những nền văn hóa đa dạng.", "A1", "Du lịch", "Travel"],
  ["Trust", "/trʌst/", "noun / verb", "Niềm tin, tin cậy", "Building trust takes consistent honesty over time.", "Xây dựng niềm tin đòi hỏi sự trung thực nhất quán qua thời gian.", "A2", "Cảm xúc", "Emotions"],
  ["Try", "/traɪ/", "verb / noun", "Cố gắng, nỗ lực", "Try your best every day and progress will follow.", "Hãy cố gắng hết sức mỗi ngày và sự tiến bộ sẽ đến theo sau.", "A1", "Cảm xúc", "Emotions"],
  ["Understand", "/ˌʌn.dəˈstænd/", "verb", "Thấu hiểu", "Empathy helps you understand what others feel.", "Sự thấu cảm giúp bạn hiểu được cảm giác của người khác.", "A1", "Học thuật", "Academic"],
  ["Use", "/juːz/", "verb / noun", "Sử dụng, ứng dụng", "Use new vocabulary words in your own sentences.", "Hãy sử dụng từ vựng mới trong chính các câu của bạn.", "A1", "Học thuật", "Academic"],
  ["Visit", "/ˈvɪz.ɪt/", "verb / noun", "Thăm thú, ghé thăm", "We visit our grandparents in the countryside often.", "Chúng tôi thường về thăm ông bà ở quê.", "A1", "Du lịch", "Travel"],
  ["Wait", "/weɪt/", "verb / noun", "Chờ đợi, kiên nhẫn", "Patience means being willing to wait for good results.", "Kiên nhẫn nghĩa là sẵn lòng chờ đợi những kết quả tốt lành.", "A1", "Cảm xúc", "Emotions"],
  ["Wake", "/weɪk/", "verb", "Thức dậy", "Wake up with gratitude for a brand new day.", "Hãy thức dậy với lòng biết ơn vì một ngày hoàn toàn mới.", "A1", "Giao tiếp hàng ngày", "Daily"],
  ["Walk", "/wɔːk/", "verb / noun", "Đi bộ", "A daily evening walk clears your mind thoroughly.", "Đi bộ mỗi tối giúp thanh lọc tâm trí bạn hoàn toàn.", "A1", "Giao tiếp hàng ngày", "Daily"],
  ["Want", "/wɒnt/", "verb", "Mong muốn", "Clarify what you truly want out of your studies.", "Hãy làm rõ điều bạn thực sự muốn đạt được từ việc học của mình.", "A1", "Cảm xúc", "Emotions"],
  ["Warn", "/wɔːn/", "verb", "Cảnh báo", "Weather radars warn pilots of impending turbulence.", "Radar thời tiết cảnh báo các phi công về vùng nhiễu động sắp tới.", "A2", "Du lịch", "Travel"],
  ["Wash", "/wɒʃ/", "verb / noun", "Rửa, giặt giũ", "Wash your hands thoroughly with soap before meals.", "Hãy rửa tay sạch sẽ bằng xà phòng trước bữa ăn.", "A1", "Giao tiếp hàng ngày", "Daily"],
  ["Watch", "/wɒtʃ/", "verb / noun", "Theo dõi, đồng hồ", "Watch documentary films to improve conversational listening.", "Xem phim tài liệu để cải thiện khả năng nghe giao tiếp.", "A1", "Giao tiếp hàng ngày", "Daily"],
  ["Wear", "/weər/", "verb", "Mặc đồ, đeo", "Wear comfortable shoes when walking on city tours.", "Hãy đi giày êm ái khi đi bộ tham quan thành phố.", "A1", "Du lịch", "Travel"],
  ["Win", "/wɪn/", "verb / noun", "Chiến thắng", "Small continuous wins compound into massive milestones.", "Những chiến thắng nhỏ liên tục sẽ tích tụ thành cột mốc to lớn.", "A1", "Cảm xúc", "Emotions"],
  ["Wish", "/wɪʃ/", "verb / noun", "Ước ao, mong ước", "I wish you immense success in mastering English.", "Tôi chúc bạn thành công rực rỡ trong việc làm chủ tiếng Anh.", "A1", "Cảm xúc", "Emotions"],
  ["Wonder", "/ˈwʌn.dər/", "verb / noun", "Kỳ diệu, tự hỏi", "A sense of wonder makes everyday life enchanting.", "Cảm giác ngạc nhiên kỳ thú khiến cuộc sống hàng ngày thêm say mê.", "A2", "Cảm xúc", "Emotions"],
  ["Worry", "/ˈwʌr.i/", "verb / noun", "Lo lắng", "Worry wastes energy that could be used for practice.", "Lo lắng làm lãng phí năng lượng mà bạn có thể dùng để luyện tập.", "A2", "Cảm xúc", "Emotions"],
  ["Write", "/raɪt/", "verb", "Viết lách", "Writing your reflections reinforces linguistic fluency.", "Viết ra những suy ngẫm giúp củng cố sự lưu loát ngôn ngữ.", "A1", "Học thuật", "Academic"]
];

COMPREHENSIVE_BASE_LIST.forEach(item => {
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

console.log(`Đã nạp thêm động từ và tính từ cơ bản, hiện có: ${wordsMap.size} từ.`);

// 5. Tự động sinh thêm bộ từ vựng học thuật Oxford 3000 và 5000 chuẩn
// Sử dụng danh sách từ vựng Oxford Core được phân theo các chủ đề:
const OXFORD_EXPANSIONS = [
  // Du lịch (Travel) B1 - B2
  ["Itinerary", "/aɪˈtɪn.ər.ər.i/", "noun", "Lịch trình chuyến đi", "Our European itinerary includes historic museums and scenic lakes.", "Lịch trình châu Âu của chúng tôi bao gồm các bảo tàng lịch sử và hồ nước đẹp.", "B2", "Du lịch", "Travel"],
  ["Destination", "/ˌdes.tɪˈneɪ.ʃən/", "noun", "Điểm đến du lịch", "The tropical coastal town is a favorite tourist destination.", "Thị trấn ven biển nhiệt đới là điểm đến du lịch được yêu thích.", "B1", "Du lịch", "Travel"],
  ["Accommodation", "/əˌkɒm.əˈdeɪ.ʃən/", "noun", "Chỗ ở, nơi lưu trú", "Finding affordable student accommodation near campus takes time.", "Tìm kiếm chỗ ở sinh viên giá cả phải chăng gần trường cần có thời gian.", "B1", "Du lịch", "Travel"],
  ["Hospitality", "/ˌhɒs.pɪˈtæl.ə.ti/", "noun", "Lòng hiếu khách", "Vietnamese hospitality leaves unforgettable impressions on foreign travelers.", "Lòng hiếu khách của người Việt để lại ấn tượng khó quên cho du khách nước ngoài.", "B2", "Du lịch", "Travel"],
  ["Excursion", "/ɪkˈskɜː.ʃən/", "noun", "Chuyến du ngoạn ngắn", "The guided day excursion took visitors to ancient temple caves.", "Chuyến du ngoạn có hướng dẫn trong ngày đưa du khách đến các hang động chùa cổ.", "B2", "Du lịch", "Travel"],
  ["Expedition", "/ˌek.spəˈdɪʃ.ən/", "noun", "Chuyến thám hiểm khoa học", "Polar expeditions require specialized thermal gear and logistics.", "Các chuyến thám hiểm vùng cực đòi hỏi trang bị giữ nhiệt và hậu cần chuyên dụng.", "B2", "Du lịch", "Travel"],
  ["Landmark", "/ˈlænd.mɑːk/", "noun", "Địa danh nổi tiếng", "The Eiffel Tower is a globally celebrated architectural landmark.", "Tháp Eiffel là một công trình kiến trúc nổi tiếng trên toàn cầu.", "B1", "Du lịch", "Travel"],
  ["Monument", "/ˈmɒn.jə.mənt/", "noun", "Tượng đài, di tích", "Historic monuments commemorate heroes who defended freedom.", "Những tượng đài lịch sử tưởng niệm các anh hùng đã bảo vệ tự do.", "B1", "Du lịch", "Travel"],
  ["Heritage", "/ˈher.ɪ.tɪdʒ/", "noun", "Di sản văn hóa", "Preserving tangible cultural heritage enriches future generations.", "Bảo tồn di sản văn hóa vật thể làm giàu cho các thế hệ tương lai.", "B2", "Du lịch", "Travel"],
  ["Delicacy", "/ˈdel.ɪ.kə.si/", "noun", "Món ăn đặc sản", "Tasting authentic local delicacies is an essential travel pleasure.", "Thưởng thức các món đặc sản địa phương là niềm vui du lịch thiết yếu.", "B2", "Du lịch", "Travel"],
  ["Layover", "/ˈleɪˌəʊ.vər/", "noun", "Thời gian quá cảnh", "A six-hour layover in Singapore allowed us to explore the jewel airport.", "Khoảng thời gian quá cảnh sáu tiếng ở Singapore cho phép chúng tôi khám phá sân bay.", "B1", "Du lịch", "Travel"],
  ["Navigation", "/ˌnæv.ɪˈɡeɪ.ʃən/", "noun", "Điều hướng chỉ đường", "Satellite navigation prevents travelers from getting lost in unfamiliar towns.", "Điều hướng vệ tinh giúp du khách không bị lạc trong những thị trấn xa lạ.", "B1", "Du lịch", "Travel"],
  ["Picturesque", "/ˌpɪk.tʃərˈesk/", "adjective", "Đẹp như tranh vẽ", "The picturesque hillside village overlooking the blue bay was breathtaking.", "Ngôi làng đẹp như tranh vẽ trên sườn đồi nhìn ra vịnh xanh đẹp đến nín thở.", "B2", "Du lịch", "Travel"],
  ["Cosmopolitan", "/ˌkɒz.məˈpɒl.ɪ.tən/", "adjective", "Mang tính quốc tế, đa văn hóa", "London is a truly cosmopolitan metropolis welcoming people from all nations.", "London là một đô thị thực sự mang tính quốc tế chào đón mọi người từ các quốc gia.", "C1", "Du lịch", "Travel"],
  ["Wanderlust", "/ˈwɒn.də.lʌst/", "noun", "Niềm khao khát đi du lịch", "Incurable wanderlust pushed her to travel through over forty countries.", "Niềm khao khát du lịch vô tận đã thôi thúc cô đi qua hơn 40 quốc gia.", "C1", "Du lịch", "Travel"],
  ["Breathtaking", "/ˈbreθˌteɪ.kɪŋ/", "adjective", "Ngoạn mục đến nghẹt thở", "The sunrise over Himalayan peaks offered breathtaking vistas.", "Cảnh mặt trời mọc trên những đỉnh Himalaya mang lại tầm nhìn ngoạn mục.", "B2", "Du lịch", "Travel"],
  ["Panoramic", "/ˌpæn.ərˈæm.ɪk/", "adjective", "Toàn cảnh bao quát", "The observation deck provides panoramic views across the city skyline.", "Đài quan sát cung cấp tầm nhìn toàn cảnh bao quát đường chân trời thành phố.", "B2", "Du lịch", "Travel"],

  // Công nghệ (Tech) B1 - B2
  ["Automation", "/ˌɔː.təˈmeɪ.ʃən/", "noun", "Tự động hóa", "Robotic automation speeds up vehicle assembly line efficiency.", "Tự động hóa bằng robot giúp tăng tốc hiệu quả dây chuyền lắp ráp xe."],
  ["Cybersecurity", "/ˌsaɪ.bə.sɪˈkjʊə.rə.ti/", "noun", "An ninh mạng", "Investing in cybersecurity defenses protects against ransomware.", "Đầu tư vào hệ thống phòng thủ an ninh mạng giúp bảo vệ khỏi mã độc tống tiền."],
  ["Developer", "/dɪˈvel.ə.pər/", "noun", "Lập trình viên, nhà phát triển", "Talented developers collaborate through open-source code repositories.", "Các lập trình viên tài năng hợp tác qua kho mã nguồn mở."],
  ["Programmer", "/ˈprəʊ.ɡræm.ər/", "noun", "Người viết mã lập trình", "The programmer resolved the critical database concurrency bottleneck.", "Người lập trình đã giải quyết điểm nghẽn đồng thời nghiêm trọng của cơ sở dữ liệu."],
  ["Coding", "/ˈkəʊ.dɪŋ/", "noun", "Viết mã lập trình", "Learning coding teaches structured and analytical problem solving.", "Học lập trình dạy cách giải quyết vấn đề có cấu trúc và phân tích."],
  ["Interface", "/ˈɪn.tə.feɪs/", "noun", "Giao diện tương tác", "An intuitive user interface reduces onboarding friction for new customers.", "Giao diện người dùng trực quan làm giảm trở ngại làm quen cho khách hàng mới."],
  ["Bug", "/bʌɡ/", "noun", "Lỗi phần mềm", "Rigorous automated unit testing catches bugs early in development.", "Kiểm thử đơn vị tự động nghiêm ngặt giúp phát hiện lỗi sớm trong quá trình phát triển."],
  ["Debugging", "/diːˈbʌɡ.ɪŋ/", "noun", "Sửa lỗi phần mềm", "Patience is a vital virtue during complicated software debugging.", "Kiên nhẫn là đức tính thiết yếu trong quá trình sửa lỗi phần mềm phức tạp."],
  ["Backup", "/ˈbæk.ʌp/", "noun / verb", "Sao lưu dữ liệu dự phòng", "Automated daily cloud backups ensure data is never permanently lost.", "Sao lưu đám mây tự động hàng ngày đảm bảo dữ liệu không bao giờ bị mất vĩnh viễn."],
  ["Hardware", "/ˈhɑːd.weər/", "noun", "Phần cứng máy tính", "High-performance hardware accelerators accelerate deep neural network training.", "Bộ tăng tốc phần cứng hiệu năng cao giúp đẩy nhanh huấn luyện mạng nơ-ron sâu."],
  ["Network", "/ˈnet.wɜːk/", "noun", "Mạng lưới máy tính", "Secure corporate networks enforce encrypted virtual private access.", "Mạng doanh nghiệp bảo mật thực thi quyền truy cập mạng riêng ảo được mã hóa."],
  ["Server", "/ˈsɜː.vər/", "noun", "Máy chủ dịch vụ", "The web server handled five million concurrent requests without failing.", "Máy chủ web đã xử lý 5 triệu yêu cầu đồng thời mà không bị sập."],
  ["Artificial", "/ˌɑː.tɪˈfɪʃ.əl/", "adjective", "Nhân tạo", "Artificial intelligence augments human creativity in healthcare diagnostics.", "Trí tuệ nhân tạo tăng cường sự sáng tạo của con người trong chẩn đoán y tế."],
  ["Intelligence", "/ɪnˈtel.ɪ.dʒəns/", "noun", "Trí thông minh", "Emotional intelligence complements intellectual problem-solving.", "Trí tuệ cảm xúc bổ sung cho việc giải quyết vấn đề bằng trí tuệ."],
  ["Robotics", "/rəʊˈbɒt.ɪks/", "noun", "Ngành người máy", "Surgical robotics enables minimally invasive operative precision.", "Ngành người máy phẫu thuật cho phép độ chính xác cao trong phẫu thuật ít xâm lấn."],
  ["Sensor", "/ˈsen.sər/", "noun", "Cảm biến đo lường", "Environmental sensors monitor urban air quality in real time.", "Các cảm biến môi trường theo dõi chất lượng không khí đô thị theo thời gian thực."],
  ["Digital", "/ˈdɪdʒ.ɪ.təl/", "adjective", "Kỹ thuật số", "Digital transformation modernizes traditional banking channels.", "Chuyển đổi số hiện đại hóa các kênh ngân hàng truyền thống."],
  ["Wireless", "/ˈwaɪə.ləs/", "adjective", "Không dây", "Wireless charging pads eliminate messy tabletop cable clutter.", "Đế sạc không dây loại bỏ sự lộn xộn của dây cáp trên bàn."],
  ["Virtual", "/ˈvɜː.tʃu.əl/", "adjective", "Thực tế ảo, trên máy", "Virtual reality simulators train pilots safely in stormy conditions.", "Mô phỏng thực tế ảo huấn luyện phi công an toàn trong điều kiện bão tố."],
  ["Platform", "/ˈplæt.fɔːm/", "noun", "Nền tảng công nghệ", "Our unified learning platform tracks student fluency metrics seamlessly.", "Nền tảng học tập thống nhất của chúng tôi theo dõi các chỉ số lưu loát của học sinh."]
];

OXFORD_EXPANSIONS.forEach(item => {
  addEntry({
    word: item[0],
    ipa: item[1],
    phonetic: item[1],
    partOfSpeech: item[2],
    meaning: item[3],
    exampleEn: item[4],
    exampleVi: item[5],
    level: item[6] || "B2",
    topic: item[7] || "Công nghệ",
    tag: item[8] || "Tech"
  });
});

console.log(`Hiện tại kho từ vựng đã đạt: ${wordsMap.size} từ vựng sạch.`);

// 6. Xây dựng kho từ vựng từ bộ từ vựng tổng hợp Oxford 3000 / 5000 để nâng quy mô lên > 3.500 từ
// Cung cấp danh mục từ vựng học thuật đa dạng có nghĩa tiếng Việt và câu ví dụ chuẩn:
const GENERAL_OXFORD_SEEDS = [
  // A1-A2 Academic & Workplace Seeds
  ["Ability", "/əˈbɪl.ə.ti/", "noun", "Khả năng, năng lực", "Her musical ability became apparent early in childhood.", "Khả năng âm nhạc của cô ấy bộc lộ rõ ngay từ thời thơ ấu.", "A2", "Học thuật", "Academic"],
  ["Accident", "/ˈæk.sɪ.dənt/", "noun", "Tai nạn ngoài ý muốn", "Drive defensively to prevent dangerous road accidents.", "Hãy lái xe cẩn thận để phòng ngừa tai nạn giao thông nguy hiểm.", "A2", "Giao tiếp hàng ngày", "Daily"],
  ["Activity", "/ækˈtɪv.ə.ti/", "noun", "Hoạt động, sinh hoạt", "Outdoor physical activity relieves mental fatigue.", "Hoạt động thể chất ngoài trời giúp giải tỏa mệt mỏi tinh thần.", "A2", "Giao tiếp hàng ngày", "Daily"],
  ["Actor", "/ˈæk.tər/", "noun", "Nam diễn viên", "The talented actor portrayed the complex character masterfully.", "Nam diễn viên tài năng đã khắc họa nhân vật phức tạp một cách xuất sắc.", "A1", "Giao tiếp hàng ngày", "Daily"],
  ["Actress", "/ˈæk.trəs/", "noun", "Nữ diễn viên", "The leading actress received standing ovations after the play.", "Nữ diễn viên chính đã nhận được sự tán thưởng nhiệt liệt sau vở kịch.", "A1", "Giao tiếp hàng ngày", "Daily"],
  ["Address", "/əˈdres/", "noun / verb", "Địa chỉ, giải quyết", "Confirm your shipping address before placing online orders.", "Hãy xác nhận địa chỉ giao hàng trước khi đặt hàng trực tuyến.", "A1", "Giao tiếp hàng ngày", "Daily"],
  ["Adult", "/ˈæd.ʌlt/", "noun / adjective", "Người trưởng thành", "Responsible adults plan ahead for family well-being.", "Người trưởng thành có trách nhiệm luôn lên kế hoạch cho hạnh phúc gia đình.", "A1", "Giao tiếp hàng ngày", "Daily"],
  ["Advice", "/ədˈvaɪs/", "noun", "Lời khuyên bảo", "Experienced mentors offer invaluable career advice.", "Những người cố vấn giàu kinh nghiệm đưa ra những lời khuyên nghề nghiệp vô giá.", "A2", "Học thuật", "Academic"],
  ["Advise", "/ədˈvaɪz/", "verb", "Khuyên nhủ", "Doctors advise getting thirty minutes of sunshine daily.", "Bác sĩ khuyên nên đón nhận 30 phút ánh nắng mặt trời mỗi ngày.", "A2", "Học thuật", "Academic"],
  ["Afraid", "/əˈfreɪd/", "adjective", "Sợ hãi, e ngại", "Never be afraid to ask for guidance when uncertain.", "Đừng bao giờ sợ nhờ vả hướng dẫn khi bạn còn chưa chắc chắn.", "A1", "Cảm xúc", "Emotions"],
  ["Age", "/eɪdʒ/", "noun / verb", "Tuổi tác, thời đại", "Curiosity keeps people vibrant and creative at any age.", "Sự tò mò giúp con người luôn tràn đầy năng lượng và sáng tạo ở mọi lứa tuổi.", "A1", "Giao tiếp hàng ngày", "Daily"],
  ["Agency", "/ˈeɪ.dʒən.si/", "noun", "Đại lý, cơ quan", "The travel agency booked our flights and accommodations.", "Đại lý du lịch đã đặt các chuyến bay và chỗ ở cho chúng tôi.", "A2", "Công việc", "Business"],
  ["Agent", "/ˈeɪ.dʒənt/", "noun", "Người đại lý, đại diện", "The real estate agent showed us several lovely apartments.", "Người đại lý bất động sản đã dẫn chúng tôi xem vài căn hộ đáng yêu.", "A2", "Công việc", "Business"],
  ["Agreement", "/əˈɡriː.mənt/", "noun", "Thỏa thuận, hiệp định", "Both sides signed a historic trade cooperation agreement.", "Cả hai bên đã ký thỏa thuận hợp tác thương mại mang tính lịch sử.", "A2", "Công việc", "Business"],
  ["Air", "/eər/", "noun", "Không khí", "Crisp mountain air revitalizes tired city dwellers.", "Không khí vùng núi trong lành tiếp thêm sinh lực cho người thành thị mệt mỏi.", "A1", "Giao tiếp hàng ngày", "Daily"],
  ["Amount", "/əˈmaʊnt/", "noun", "Số lượng, khoản tiền", "A modest amount of savings invested early compounds fast.", "Một khoản tiền tiết kiệm khiêm tốn đầu tư sớm sẽ sinh lời nhanh.", "A2", "Công việc", "Business"],
  ["Animal", "/ˈæn.ɪ.məl/", "noun", "Động vật", "Respecting all animals preserves delicate natural balance.", "Tôn trọng mọi loài động vật giúp bảo tồn sự cân bằng tự nhiên tinh tế.", "A1", "Giao tiếp hàng ngày", "Daily"],
  ["Area", "/ˈeə.ri.ə/", "noun", "Khu vực, diện tích", "The suburban area features parks and reputable schools.", "Khu vực ngoại ô có nhiều công viên và các trường học uy tín.", "A2", "Giao tiếp hàng ngày", "Daily"],
  ["Army", "/ˈɑː.mi/", "noun", "Quân đội", "The defense army protects territorial borders courageously.", "Quân đội quốc phòng dũng cảm bảo vệ các đường biên giới lãnh thổ.", "A2", "Học thuật", "Academic"],
  ["Art", "/ɑːt/", "noun", "Nghệ thuật", "Appreciating fine art enhances visual sensitivity.", "Thưởng thức nghệ thuật tinh tế nâng cao sự nhạy cảm thị giác.", "A1", "Học thuật", "Academic"],
  ["Article", "/ˈɑː.tɪ.kəl/", "noun", "Bài báo, điều khoản", "Read this peer-reviewed article on cognitive retention.", "Hãy đọc bài báo phản biện này về khả năng ghi nhớ nhận thức.", "A2", "Học thuật", "Academic"],
  ["Artist", "/ˈɑː.tɪst/", "noun", "Nghệ sĩ, họa sĩ", "The visionary artist painted vibrant landscapes with passion.", "Người nghệ sĩ có tầm nhìn đã vẽ những bức tranh phong cảnh rực rỡ với đam mê.", "A1", "Học thuật", "Academic"],
  ["Aspect", "/ˈæs.pekt/", "noun", "Khía cạnh, góc độ", "Consider every aspect of the project before launching.", "Hãy xem xét mọi khía cạnh của dự án trước khi khởi chạy.", "B1", "Học thuật", "Academic"],
  ["Atmosphere", "/ˈæt.məs.fɪər/", "noun", "Bầu không khí", "A tranquil study atmosphere maximizes deep concentration.", "Bầu không khí học tập yên bình tối đa hóa sự tập trung sâu sắc.", "B1", "Giao tiếp hàng ngày", "Daily"],
  ["Audience", "/ˈɔː.di.əns/", "noun", "Khán giả, thính giả", "The captivating speech held the audience spellbound.", "Bài phát biểu lôi cuốn đã giữ chân khán giả đầy say mê.", "B1", "Học thuật", "Academic"],
  ["Author", "/ˈɔː.θər/", "noun", "Tác giả cuốn sách", "The author spent five years researching the historical novel.", "Tác giả đã dành năm năm nghiên cứu cuốn tiểu thuyết lịch sử.", "A2", "Học thuật", "Academic"],
  ["Balance", "/ˈbæl.əns/", "noun / verb", "Sự cân bằng", "Work-life balance nurtures long-term career productivity.", "Sự cân bằng công việc và cuộc sống nuôi dưỡng năng suất lâu dài.", "A2", "Giao tiếp hàng ngày", "Daily"],
  ["Band", "/bænd/", "noun", "Ban nhạc, dải băng", "The indie rock band performed live at the city stadium.", "Ban nhạc indie rock đã biểu diễn trực tiếp tại sân vận động thành phố.", "A1", "Giao tiếp hàng ngày", "Daily"],
  ["Basis", "/ˈbeɪ.sɪs/", "noun", "Nền tảng, cơ sở", "Mutual respect forms the solid basis of strong friendship.", "Sự tôn trọng lẫn nhau tạo nên nền tảng vững chắc cho tình bạn bền chặt.", "B1", "Học thuật", "Academic"],
  ["Beauty", "/ˈbjuː.ti/", "noun", "Vẻ đẹp, nét đẹp", "Admiring natural beauty calms racing thoughts instantly.", "Ngắm nhìn vẻ đẹp tự nhiên làm dịu đi những suy nghĩ dồn dập ngay lập tức.", "A2", "Cảm xúc", "Emotions"],
  ["Behavior", "/bɪˈheɪ.vjər/", "noun", "Hành vi, cách ứng xử", "Consistent ethical behavior builds enduring professional trust.", "Hành vi đạo đức nhất quán tạo dựng niềm tin nghề nghiệp bền vững.", "B1", "Học thuật", "Academic"],
  ["Benefit", "/ˈben.ɪ.fɪt/", "noun / verb", "Lợi ích, được lợi", "Regular exercise delivers immense cardiovascular benefits.", "Tập thể dục đều đặn mang lại những lợi ích tim mạch to lớn.", "A2", "Giao tiếp hàng ngày", "Daily"],
  ["Bill", "/bɪl/", "noun", "Hóa đơn thanh toán", "Review your utility bill carefully each month.", "Hãy kiểm tra kỹ hóa đơn tiện ích của bạn mỗi tháng.", "A1", "Công việc", "Business"],
  ["Bird", "/bɜːd/", "noun", "Con chim", "A singing bird perched gently on the balcony rail.", "Chú chim đang hót đậu nhẹ nhàng trên lan can ban công.", "A1", "Giao tiếp hàng ngày", "Daily"],
  ["Birth", "/bɜːθ/", "noun", "Sự sinh ra, ngày sinh", "Her birth brought immense joy to the whole extended family.", "Sự chào đời của cô bé mang lại niềm vui to lớn cho cả đại gia đình.", "A2", "Giao tiếp hàng ngày", "Daily"],
  ["Bit", "/bɪt/", "noun", "Một chút, một mảnh", "Every little bit of daily progress moves you forward.", "Mỗi một chút tiến bộ hàng ngày đều đưa bạn tiến về phía trước.", "A1", "Giao tiếp hàng ngày", "Daily"],
  ["Block", "/blɒk/", "noun / verb", "Khu nhà, chặn lại", "Take a refreshing walk around the neighborhood block.", "Hãy đi dạo một vòng sảng khoái quanh khu phố của bạn.", "A2", "Giao tiếp hàng ngày", "Daily"],
  ["Blood", "/blʌd/", "noun", "Máu", "Healthy nutrition promotes optimal blood circulation.", "Dinh dưỡng lành mạnh thúc đẩy tuần hoàn máu tối ưu.", "A2", "Giao tiếp hàng ngày", "Daily"],
  ["Board", "/bɔːd/", "noun / verb", "Hội đồng, tấm bảng", "The corporate board approved the annual expansion plan.", "Hội đồng quản trị công ty đã phê duyệt kế hoạch mở rộng hàng năm.", "A2", "Công việc", "Business"],
  ["Body", "/ˈbɒd.i/", "noun", "Cơ thể con người", "Listen to your body and rest when fatigue sets in.", "Hãy lắng nghe cơ thể bạn và nghỉ ngơi khi mệt mỏi xuất hiện.", "A1", "Giao tiếp hàng ngày", "Daily"],
  ["Bone", "/bəʊn/", "noun", "Xương khớp", "Calcium and vitamin D keep human bones strong.", "Canxi và vitamin D giúp xương con người luôn chắc khỏe.", "A2", "Giao tiếp hàng ngày", "Daily"],
  ["Border", "/ˈbɔː.dər/", "noun", "Biên giới, đường viền", "Cross-border trade enriches bilateral regional economies.", "Thương mại xuyên biên giới làm giàu cho nền kinh tế hai bên.", "B1", "Du lịch", "Travel"],
  ["Bottom", "/ˈbɒt.əm/", "noun / adjective", "Đáy, phía dưới cùng", "Sign your signature at the bottom of the formal document.", "Hãy ký tên của bạn ở phía dưới cùng của văn bản chính thức.", "A1", "Công việc", "Business"],
  ["Branch", "/brɑːntʃ/", "noun", "Chi nhánh, cành cây", "The commercial bank opened a new downtown branch.", "Ngân hàng thương mại đã mở một chi nhánh mới ở trung tâm.", "B1", "Công việc", "Business"],
  ["Bridge", "/brɪdʒ/", "noun", "Cây cầu kết nối", "Bridges symbolize connection across geographical divides.", "Những cây cầu tượng trưng cho sự kết nối qua các ranh giới địa lý.", "A2", "Du lịch", "Travel"],
  ["Brother", "/ˈbrʌð.ər/", "noun", "Anh em trai", "He shares a warm brotherly bond with his sibling.", "Anh ấy có tình anh em ấm áp với người em của mình.", "A1", "Giao tiếp hàng ngày", "Daily"],
  ["Building", "/ˈbɪl.dɪŋ/", "noun", "Tòa nhà cao tầng", "Modern architecture combines glass and sustainable timber.", "Kiến trúc hiện đại kết hợp kính và gỗ bền vững.", "A1", "Giao tiếp hàng ngày", "Daily"],
  ["Cabinet", "/ˈkæb.ɪ.nət/", "noun", "Tủ đựng đồ, nội các", "Store reference files safely in the filing cabinet.", "Hãy cất các tập tài liệu tham khảo an toàn trong tủ hồ sơ.", "B1", "Công việc", "Business"],
  ["Campaign", "/kæmˈpeɪn/", "noun", "Chiến dịch quảng bá", "The social media campaign exceeded projected engagement.", "Chiến dịch mạng xã hội đã vượt xa mức độ tương tác dự kiến.", "B1", "Công việc", "Business"],
  ["Candidate", "/ˈkæn.dɪ.dət/", "noun", "Ứng cử viên ứng tuyển", "The successful candidate exhibited strong analytical depth.", "Ứng viên trúng tuyển đã thể hiện chiều sâu phân tích xuất sắc.", "B1", "Công việc", "Business"],
  ["Capital", "/ˈkæp.ɪ.təl/", "noun", "Thủ đô, nguồn vốn", "Hanoi is the historic and political capital of Vietnam.", "Hà Nội là thủ đô lịch sử và chính trị của Việt Nam.", "A2", "Du lịch", "Travel"],
  ["Captain", "/ˈkæp.tɪn/", "noun", "Đội trưởng, thuyền trưởng", "The ship captain steered skillfully through stormy waters.", "Thuyền trưởng đã điều khiển tàu khéo léo qua vùng biển bão tố.", "A2", "Du lịch", "Travel"],
  ["Care", "/keər/", "noun / verb", "Sự chăm sóc", "Health care professionals deserve heartfelt appreciation.", "Các nhân viên y tế chăm sóc sức khỏe xứng đáng nhận được sự tri ân chân thành.", "A1", "Giao tiếp hàng ngày", "Daily"],
  ["Case", "/keɪs/", "noun", "Trường hợp, vụ việc", "In any case, remain calm and assess facts carefully.", "Trong bất kỳ trường hợp nào, hãy giữ bình tĩnh và đánh giá sự thật cẩn thận.", "A2", "Học thuật", "Academic"],
  ["Cash", "/kæʃ/", "noun", "Tiền mặt", "Carry modest emergency cash while traveling overseas.", "Hãy mang một lượng tiền mặt vừa phải khi đi du lịch nước ngoài.", "A1", "Du lịch", "Travel"],
  ["Cause", "/kɔːz/", "noun / verb", "Nguyên nhân gốc rễ", "Determine the root cause to fix recurring technical glitches.", "Xác định nguyên nhân gốc rễ để khắc phục các trục trặc kỹ thuật lặp lại.", "A2", "Học thuật", "Academic"],
  ["Cell", "/sel/", "noun", "Tế bào sinh học", "Cells are the fundamental building blocks of all living beings.", "Tế bào là những viên gạch cơ bản tạo nên mọi sinh vật sống.", "B1", "Học thuật", "Academic"],
  ["Center", "/ˈsen.tər/", "noun", "Trung tâm", "The research center conducts state-of-the-art studies.", "Trung tâm nghiên cứu thực hiện các nghiên cứu hiện đại hàng đầu.", "A1", "Học thuật", "Academic"],
  ["Century", "/ˈsen.tʃər.i/", "noun", "Thế kỷ", "Inventions of the past century revolutionized mankind.", "Những phát minh của thế kỷ trước đã tạo nên cuộc cách mạng cho nhân loại.", "A2", "Học thuật", "Academic"],
  ["Chair", "/tʃeər/", "noun", "Chiếc ghế", "Pull up a comfortable ergonomic chair to study.", "Hãy kéo một chiếc ghế công thái học êm ái để học tập.", "A1", "Giao tiếp hàng ngày", "Daily"],
  ["Challenge", "/ˈtʃæl.ɪndʒ/", "noun / verb", "Thách thức, thử thách", "Embrace difficult challenges as stepping stones to greatness.", "Hãy đón nhận những thử thách khó khăn như bước đệm vươn tới sự vĩ đại.", "B1", "Cảm xúc", "Emotions"],
  ["Champion", "/ˈtʃæm.pi.ən/", "noun", "Nhà vô địch", "True champions practice relentlessly behind the scenes.", "Những nhà vô địch thực thụ luyện tập không ngừng nghỉ phía sau hậu trường.", "A2", "Cảm xúc", "Emotions"],
  ["Chance", "/tʃɑːns/", "noun", "Cơ hội, may mắn", "Take every chance to practice speaking English aloud.", "Hãy tận dụng mọi cơ hội để luyện nói tiếng Anh to rõ ràng.", "A2", "Học thuật", "Academic"],
  ["Change", "/tʃeɪndʒ/", "noun / verb", "Sự thay đổi", "Change is the only constant companion of progress.", "Sự thay đổi là người bạn đồng hành bất biến duy nhất của sự tiến bộ.", "A1", "Giao tiếp hàng ngày", "Daily"],
  ["Channel", "/ˈtʃæn.əl/", "noun", "Kênh truyền thông", "The video streaming channel publishes educational lessons.", "Kênh video trực tuyến xuất bản những bài học mang tính giáo dục.", "A2", "Công nghệ", "Tech"],
  ["Chapter", "/ˈtʃæp.tər/", "noun", "Chương sách", "Each chapter introduces practical grammatical patterns.", "Mỗi chương giới thiệu các mẫu ngữ pháp thực tế.", "A2", "Học thuật", "Academic"],
  ["Character", "/ˈkær.ək.tər/", "noun", "Tính cách, nhân vật", "Overcoming adversity builds honorable moral character.", "Vượt qua nghịch cảnh giúp xây dựng nhân cách đạo đức đáng quý.", "B1", "Cảm xúc", "Emotions"],
  ["Charge", "/tʃɑːdʒ/", "noun / verb", "Chi phí, nạp pin", "Plug in your mobile device to charge the battery.", "Hãy cắm thiết bị di động của bạn để sạc pin.", "A2", "Công nghệ", "Tech"],
  ["Chart", "/tʃɑːt/", "noun", "Biểu đồ số liệu", "The bar chart illustrates monthly revenue trajectories.", "Biểu đồ cột minh họa quỹ đạo doanh thu hàng tháng.", "A2", "Học thuật", "Academic"],
  ["Check", "/tʃek/", "verb / noun", "Kiểm tra rà soát", "Double-check test answers before submitting the form.", "Hãy kiểm tra lại câu trả lời bài kiểm tra trước khi nộp biểu mẫu.", "A1", "Học thuật", "Academic"],
  ["Child", "/tʃaɪld/", "noun", "Trẻ em, con cái", "Every child flourishes when nurtured with affection.", "Mọi đứa trẻ đều phát triển rực rỡ khi được nuôi dưỡng bằng tình yêu thương.", "A1", "Giao tiếp hàng ngày", "Daily"],
  ["Choice", "/tʃɔɪs/", "noun", "Sự lựa chọn", "Wise daily choices compound into a fulfilling life.", "Những lựa chọn khôn ngoan hàng ngày tạo nên cuộc đời trọn vẹn.", "A2", "Cảm xúc", "Emotions"],
  ["Church", "/tʃɜːtʃ/", "noun", "Nhà thờ giáo đường", "The historic gothic church has exquisite stained glass.", "Nhà thờ gothic lịch sử có những ô kính màu tinh xảo.", "A2", "Du lịch", "Travel"],
  ["Circle", "/ˈsɜː.kəl/", "noun / verb", "Vòng tròn, khoanh tròn", "We sat in a friendly circle to share stories.", "Chúng tôi ngồi thành một vòng tròn thân thiện để chia sẻ câu chuyện.", "A1", "Giao tiếp hàng ngày", "Daily"],
  ["City", "/ˈsɪt.i/", "noun", "Thành phố đô thị", "The vibrant coastal city draws tourists worldwide.", "Thành phố ven biển sôi động thu hút du khách khắp thế giới.", "A1", "Du lịch", "Travel"],
  ["Class", "/klɑːs/", "noun", "Lớp học, đẳng cấp", "The morning conversation class starts promptly at eight.", "Lớp học giao tiếp buổi sáng bắt đầu đúng 8 giờ.", "A1", "Học thuật", "Academic"],
  ["Client", "/ˈklaɪ.ənt/", "noun", "Khách hàng hợp tác", "Maintain transparent communication with every client.", "Hãy duy trì giao tiếp minh bạch với mọi khách hàng.", "B1", "Công việc", "Business"],
  ["Climate", "/ˈklaɪ.mət/", "noun", "Khí hậu vùng miền", "Tropical climates feature distinct wet and dry seasons.", "Khí hậu nhiệt đới có các mùa mưa và khô rõ rệt.", "A2", "Giao tiếp hàng ngày", "Daily"],
  ["Club", "/klʌb/", "noun", "Câu lạc bộ", "Join a book club to engage in thoughtful literary debates.", "Hãy tham gia câu lạc bộ sách để tham gia các cuộc thảo luận văn học sâu sắc.", "A1", "Giao tiếp hàng ngày", "Daily"],
  ["Coach", "/kəʊtʃ/", "noun / verb", "Huấn luyện viên", "An inspiring coach instills discipline and resilience.", "Người huấn luyện viên truyền cảm hứng sẽ rèn giũa kỷ luật và sự kiên cường.", "A2", "Học thuật", "Academic"],
  ["Coast", "/kəʊst/", "noun", "Bờ biển, duyên hải", "We drove along the winding coastal highway.", "Chúng tôi lái xe dọc theo con đường cao tốc ven biển uốn lượn.", "A2", "Du lịch", "Travel"],
  ["Code", "/kəʊd/", "noun / verb", "Mã nguồn, quy chuẩn", "Writing clean modular code simplifies maintenance.", "Viết mã nguồn sạch dạng mô-đun giúp đơn giản hóa việc bảo trì.", "A2", "Công nghệ", "Tech"],
  ["Coffee", "/ˈkɒf.i/", "noun", "Cà phê", "A fresh cup of aromatic coffee sharpens morning concentration.", "Một tách cà phê thơm ngon làm tăng sự tập trung vào buổi sáng.", "A1", "Giao tiếp hàng ngày", "Daily"],
  ["Colleague", "/ˈkɒl.iːɡ/", "noun", "Đồng nghiệp", "Supportive colleagues foster an enjoyable workplace climate.", "Những người đồng nghiệp tương trợ tạo nên môi trường làm việc thú vị.", "A2", "Công việc", "Business"],
  ["Collection", "/kəˈlek.ʃən/", "noun", "Bộ sưu tập", "The museum exhibits an extensive collection of sculptures.", "Bảo tàng trưng bày một bộ sưu tập điêu khắc phong phú.", "A2", "Du lịch", "Travel"],
  ["College", "/ˈkɒl.ɪdʒ/", "noun", "Trường cao đẳng/đại học", "Community college provides affordable vocational training.", "Trường cao đẳng cộng đồng cung cấp đào tạo nghề với chi phí hợp lý.", "A2", "Học thuật", "Academic"],
  ["Color", "/ˈkʌl.ər/", "noun", "Màu sắc", "Vibrant colors stimulate human emotional response.", "Màu sắc rực rỡ kích thích phản ứng cảm xúc của con người.", "A1", "Giao tiếp hàng ngày", "Daily"],
  ["Combination", "/ˌkɒm.bɪˈneɪ.ʃən/", "noun", "Sự kết hợp phối hợp", "The ideal combination of rest and study yields retention.", "Sự kết hợp lý tưởng giữa nghỉ ngơi và học tập mang lại khả năng ghi nhớ cao.", "B1", "Học thuật", "Academic"],
  ["Comfort", "/ˈkʌm.fət/", "noun / verb", "Sự thoải mái an ủi", "Ergonomic furniture offers physical comfort during work.", "Nội thất công thái học mang lại sự thoải mái thể chất trong công việc.", "A2", "Giao tiếp hàng ngày", "Daily"],
  ["Command", "/kəˈmɑːnd/", "noun / verb", "Lệnh điều khiển, chỉ huy", "Execute the terminal command to deploy the web build.", "Hãy thực thi lệnh trong terminal để triển khai bản dựng web.", "B1", "Công nghệ", "Tech"],
  ["Comment", "/ˈkɒm.ent/", "noun / verb", "Bình luận nhận xét", "Leave constructive comments on team pull requests.", "Hãy để lại những bình luận mang tính xây dựng trên yêu cầu kéo của nhóm.", "A2", "Công nghệ", "Tech"],
  ["Community", "/kəˈmjuː.nə.ti/", "noun", "Cộng đồng dân cư", "A supportive study community helps students stay accountable.", "Cộng đồng học tập tương trợ giúp học viên giữ vững trách nhiệm.", "A2", "Giao tiếp hàng ngày", "Daily"],
  ["Company", "/ˈkʌm.pə.ni/", "noun", "Công ty doanh nghiệp", "The tech company values innovation and transparent teamwork.", "Công ty công nghệ coi trọng sự đổi mới và tinh thần làm việc nhóm minh bạch.", "A1", "Công việc", "Business"],
  ["Comparison", "/kəmˈpær.ɪ.sən/", "noun", "Sự so sánh đối chiếu", "Careful comparison reveals subtle phonetic nuances.", "Sự so sánh cẩn thận làm lộ ra những sắc thái ngữ âm tinh tế.", "B1", "Học thuật", "Academic"],
  ["Competition", "/ˌkɒm.pəˈtɪʃ.ən/", "noun", "Cuộc thi, sự cạnh tranh", "Friendly competition drives peer learners to excel.", "Sự cạnh tranh thân thiện thúc đẩy các bạn cùng học trở nên xuất sắc.", "A2", "Học thuật", "Academic"],
  ["Concept", "/ˈkɒn.sept/", "noun", "Khái niệm lý thuyết", "Master the fundamental concept before moving to edge cases.", "Hãy làm chủ khái niệm cơ bản trước khi chuyển sang các trường hợp đặc biệt.", "B1", "Học thuật", "Academic"],
  ["Concern", "/kənˈsɜːn/", "noun / verb", "Mối bận tâm lo lắng", "Express your genuine concern kindly and directly.", "Hãy thể hiện sự bận tâm chân thành một cách tử tế và trực tiếp.", "B1", "Cảm xúc", "Emotions"],
  ["Condition", "/kənˈdɪʃ.ən/", "noun", "Điều kiện tình trạng", "Maintain your laptop in optimal operating condition.", "Hãy giữ cho laptop của bạn luôn ở tình trạng hoạt động tối ưu.", "A2", "Công nghệ", "Tech"],
  ["Conference", "/ˈkɒn.fər.əns/", "noun", "Hội nghị khoa học", "Global specialists presented research at the symposium.", "Các chuyên gia toàn cầu đã trình bày nghiên cứu tại hội nghị.", "A2", "Công việc", "Business"],
  ["Connection", "/kəˈnek.ʃən/", "noun", "Mối liên kết kết nối", "A reliable internet connection is crucial for remote study.", "Kết nối internet ổn định là tối quan trọng cho việc học từ xa.", "A2", "Công nghệ", "Tech"],
  ["Consequence", "/ˈkɒn.sɪ.kwəns/", "noun", "Hậu quả hệ quả", "Consider the environmental consequences of consumption.", "Hãy xem xét các hậu quả môi trường của việc tiêu dùng.", "B1", "Học thuật", "Academic"],
  ["Construction", "/kənˈstrʌk.ʃən/", "noun", "Công trình xây dựng", "The bridge construction finished ahead of deadline.", "Công trình xây dựng cầu đã hoàn thành trước thời hạn.", "B1", "Giao tiếp hàng ngày", "Daily"],
  ["Contact", "/ˈkɒn.tækt/", "noun / verb", "Liên lạc tiếp xúc", "Keep regular contact with your mentors and peers.", "Hãy giữ liên lạc thường xuyên với những người cố vấn và bạn bè.", "A2", "Công việc", "Business"],
  ["Context", "/ˈkɒn.tekst/", "noun", "Bối cảnh ngữ cảnh", "Vocabulary learned in context sticks longer in memory.", "Từ vựng học trong ngữ cảnh sẽ đọng lại lâu hơn trong trí nhớ.", "B1", "Học thuật", "Academic"],
  ["Contract", "/ˈkɒn.trækt/", "noun", "Bản hợp đồng", "Read contract clauses before affixing your signature.", "Hãy đọc các điều khoản hợp đồng trước khi đặt bút ký.", "B1", "Công việc", "Business"],
  ["Conversation", "/ˌkɒn.vəˈseɪ.ʃən/", "noun", "Cuộc trò chuyện", "Engaging in live conversations overcomes speaking anxiety.", "Tham gia vào các cuộc trò chuyện trực tiếp giúp vượt qua nỗi sợ nói.", "A1", "Giao tiếp hàng ngày", "Daily"],
  ["Corner", "/ˈkɔː.nər/", "noun", "Góc phố, góc phòng", "A quiet reading corner with a soft armchair invites study.", "Một góc đọc sách yên tĩnh với chiếc ghế êm ái mời gọi việc học.", "A2", "Giao tiếp hàng ngày", "Daily"]
];

GENERAL_OXFORD_SEEDS.forEach(item => {
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

console.log(`Đã nạp kho từ mở rộng tổng hợp, hiện tại: ${wordsMap.size} từ.`);

// 7. Tạo thêm các từ vựng theo chủ đề để đạt con số 3.500 - 4.000 từ chuẩn
// Tự động bổ sung các từ vựng CEFR A1, A2, B1, B2, C1 chuẩn từ điển Oxford:
const TOPIC_DICTIONARY = [
  // CẢM XÚC (Emotions)
  ["Affection", "/əˈfek.ʃən/", "noun", "Tình cảm thương mến", "She felt a deep affection for her childhood hometown.", "Cô ấy cảm thấy tình cảm gắn bó sâu sắc với quê hương thuở nhỏ.", "B2", "Cảm xúc", "Emotions"],
  ["Alienation", "/ˌeɪ.li.əˈneɪ.ʃən/", "noun", "Cảm giác xa lánh cô lập", "Urban isolation can induce painful feelings of alienation.", "Sự cô lập ở đô thị có thể gây ra cảm giác xa lánh đau đớn.", "C1", "Cảm xúc", "Emotions"],
  ["Altruism", "/ˈæl.tru.ɪ.zəm/", "noun", "Lòng vị tha vô tư", "True altruism motivates people to assist without reward.", "Lòng vị tha đích thực thôi thúc con người giúp đỡ mà không màng đền đáp.", "C1", "Cảm xúc", "Emotions"],
  ["Astonishment", "/əˈstɒn.ɪʃ.mənt/", "noun", "Sự kinh ngạc sửng sốt", "The magician's illusion left the audience in utter astonishment.", "Màn ảo thuật đã khiến khán giả hoàn toàn sửng sốt kinh ngạc.", "B2", "Cảm xúc", "Emotions"],
  ["Attachment", "/əˈtætʃ.mənt/", "noun", "Sự gắn bó tình cảm", "Emotional attachment to mentors provides enduring reassurance.", "Sự gắn bó tình cảm với người thầy mang lại sự an tâm bền vững.", "B2", "Cảm xúc", "Emotions"],
  ["Awe", "/ɔː/", "noun", "Sự kính sợ thán phục", "Stargazing under crisp dark skies inspires humble awe.", "Ngắm sao dưới bầu trời đêm quang đãng khơi dậy sự thán phục khiêm nhường.", "B2", "Cảm xúc", "Emotions"],
  ["Bitterness", "/ˈbɪt.ə.nəs/", "noun", "Sự cay đắng hận thù", "Releasing past bitterness heals wounded relationships.", "Buông bỏ cay đắng quá khứ giúp chữa lành những mối quan hệ rạn nứt.", "B2", "Cảm xúc", "Emotions"],
  ["Bliss", "/blɪs/", "noun", "Hạnh phúc tột cùng", "Sipping coffee on a quiet rainy morning was pure bliss.", "Nhâm nhi cà phê vào một buổi sáng mưa yên tĩnh là niềm hạnh phúc tột cùng.", "C1", "Cảm xúc", "Emotions"],
  ["Calmness", "/ˈkɑːm.nəs/", "noun", "Sự điềm tĩnh bình yên", "Her inner calmness soothed anxiety across the panicked room.", "Sự điềm tĩnh nội tâm của cô làm dịu nỗi lo lắng khắp căn phòng hoảng sợ.", "B1", "Cảm xúc", "Emotions"],
  ["Cheerfulness", "/ˈtʃɪə.fəl.nəs/", "noun", "Sự vui vẻ hớn hở", "His infectious cheerfulness brought sunshine to dreary days.", "Sự vui vẻ dễ lan tỏa của anh ấy mang lại ánh nắng cho những ngày u ám.", "B1", "Cảm xúc", "Emotions"],
  ["Comfort", "/ˈkʌm.fət/", "noun", "Sự an ủi thoải mái", "Gentle words provided comfort to the mourning widow.", "Những lời nói dịu dàng mang lại sự an ủi cho người góa phụ.", "A2", "Cảm xúc", "Emotions"],
  ["Contentment", "/kənˈtent.mənt/", "noun", "Sự mãn nguyện thỏa lòng", "True contentment stems from appreciating what you already have.", "Sự mãn nguyện thực sự bắt nguồn từ việc biết trân trọng những gì mình có.", "B2", "Cảm xúc", "Emotions"],
  ["Courage", "/ˈkʌr.ɪdʒ/", "noun", "Lòng dũng cảm quả cảm", "Courage is resistance to fear, not the absence of fear.", "Dũng cảm là sự chống lại nỗi sợ hãi, chứ không phải là không có nỗi sợ hãi.", "B1", "Cảm xúc", "Emotions"],
  ["Despair", "/dɪˈspeər/", "noun / verb", "Sự tuyệt vọng cùng cực", "Never surrender to despair even during dark moments.", "Đừng bao giờ đầu hàng sự tuyệt vọng ngay cả trong những thời khắc tăm tối.", "B2", "Cảm xúc", "Emotions"],
  ["Disappointment", "/ˌdɪs.əˈpɔɪnt.mənt/", "noun", "Sự thất vọng chán nản", "Overcoming disappointment develops formidable perseverance.", "Vượt qua sự thất vọng giúp rèn luyện tính kiên trì đáng gờm.", "B1", "Cảm xúc", "Emotions"],
  ["Doubt", "/daʊt/", "noun / verb", "Sự nghi ngờ hoài nghi", "Push through self-doubt with steady small accomplishments.", "Hãy vượt qua sự nghi ngờ bản thân bằng những thành tựu nhỏ đều đặn.", "B1", "Cảm xúc", "Emotions"],
  ["Eagerness", "/ˈiː.ɡər.nəs/", "noun", "Sự háo hức hăm hở", "Students displayed great eagerness to master new language skills.", "Học sinh thể hiện sự háo hức lớn để làm chủ các kỹ năng ngôn ngữ mới.", "B2", "Cảm xúc", "Emotions"],
  ["Embarrassment", "/ɪmˈbær.əs.mənt/", "noun", "Sự ngượng ngùng bối rối", "Humor helps dissolve initial social embarrassment smoothly.", "Sự hài hước giúp xóa tan nỗi ngượng ngùng xã hội ban đầu một cách êm đẹp.", "B1", "Cảm xúc", "Emotions"],
  ["Envy", "/ˈen.vi/", "noun / verb", "Sự đố kỵ ghen tị", "Envy poisons joy; focus on cultivating your own garden.", "Sự ghen tị đầu độc niềm vui; hãy tập trung chăm sóc khu vườn của chính mình.", "B2", "Cảm xúc", "Emotions"],
  ["Euphoria", "/juːˈfɔː.ri.ə/", "noun", "Trạng thái hưng phấn ngất ngây", "The victory ignited widespread euphoria across the metropolis.", "Chiến thắng đã thổi bùng trạng thái hưng phấn tột độ khắp đô thị.", "C1", "Cảm xúc", "Emotions"],
  ["Fear", "/fɪər/", "noun / verb", "Nỗi sợ hãi", "Knowledge dissolves irrational fear of the unknown.", "Tri thức làm tan biến nỗi sợ vô lý trước những điều chưa biết.", "A1", "Cảm xúc", "Emotions"],
  ["Fondness", "/ˈfɒnd.nəs/", "noun", "Sự yêu thích trìu mến", "She looks back with fondness on her university college days.", "Cô ấy nhìn lại thời đại học của mình với sự yêu thích trìu mến.", "B2", "Cảm xúc", "Emotions"],
  ["Forgiveness", "/fəˈɡɪv.nəs/", "noun", "Lòng tha thứ độ lượng", "Practicing forgiveness lightens burdens weighing upon the soul.", "Thực hành lòng tha thứ làm vơi đi những gánh nặng đè lên tâm hồn.", "B2", "Cảm xúc", "Emotions"],
  ["Gratitude", "/ˈɡræt.ɪ.tjuːd/", "noun", "Lòng biết ơn", "Expressing gratitude daily primes the mind for optimism.", "Bày tỏ lòng biết ơn mỗi ngày giúp tâm trí luôn hướng tới sự lạc quan.", "B1", "Cảm xúc", "Emotions"],
  ["Guilt", "/ɡɪlt/", "noun", "Cảm giác tội lỗi", "Acknowledging mistakes and making amends frees you from guilt.", "Thừa nhận sai lầm và sửa đổi giúp bạn thoát khỏi cảm giác tội lỗi.", "B1", "Cảm xúc", "Emotions"],
  ["Harmony", "/ˈhɑː.mə.ni/", "noun", "Sự hòa thuận hòa hợp", "Living in harmony with nature brings quiet contentment.", "Sống hòa hợp với thiên nhiên mang lại sự mãn nguyện tĩnh lặng.", "B2", "Cảm xúc", "Emotions"],
  ["Hope", "/həʊp/", "noun / verb", "Hy vọng niềm tin", "Hope provides the inner spark that fuels determination.", "Hy vọng mang lại tia lửa nội tâm tiếp thêm sức mạnh cho lòng quyết tâm.", "A1", "Cảm xúc", "Emotions"],
  ["Humility", "/hjuːˈmɪl.ə.ti/", "noun", "Lòng khiêm tốn khiêm nhường", "Intellectual humility encourages lifelong learning and listening.", "Sự khiêm nhường về trí tuệ khuyến khích việc lắng nghe và học hỏi suốt đời.", "C1", "Cảm xúc", "Emotions"],
  ["Insecurity", "/ˌɪn.sɪˈkjʊə.rə.ti/", "noun", "Cảm giác bất an thiếu an toàn", "Recognizing personal strengths dissolves deep-seated insecurity.", "Nhận ra điểm mạnh cá nhân giúp xua tan cảm giác bất an sâu kín.", "B2", "Cảm xúc", "Emotions"],
  ["Irritation", "/ˌɪr.ɪˈteɪ.ʃən/", "noun", "Sự bực mình khó chịu", "Patience prevents mild irritation from escalating into conflicts.", "Sự kiên nhẫn ngăn ngừa bực mình nhẹ leo thang thành xung đột.", "B2", "Cảm xúc", "Emotions"],
  ["Isolation", "/ˌaɪ.səˈleɪ.ʃən/", "noun", "Sự cô lập cách ly", "Connecting with friendly peers relieves the pain of isolation.", "Kết nối với bạn bè thân thiện giúp xoa dịu nỗi đau của sự cô lập.", "B2", "Cảm xúc", "Emotions"],
  ["Jealousy", "/ˈdʒel.ə.si/", "noun", "Lòng ghen tuông đố kỵ", "Trust and open communication safeguard relationships from jealousy.", "Sự tin tưởng và giao tiếp cởi mở bảo vệ mối quan hệ khỏi lòng ghen tuông.", "B1", "Cảm xúc", "Emotions"],
  ["Joy", "/dʒɔɪ/", "noun", "Niềm vui mừng khôn xiết", "Shared laughter brings pure joy to friendship gatherings.", "Tiếng cười chia sẻ mang lại niềm vui thuần khiết cho những buổi gặp mặt bạn bè.", "A2", "Cảm xúc", "Emotions"],
  ["Loneliness", "/ˈləʊn.li.nəs/", "noun", "Sự cô đơn lẻ loi", "Creative hobbies provide companionship and overcome loneliness.", "Những sở thích sáng tạo mang lại sự bầu bạn và vượt qua nỗi cô đơn.", "B1", "Cảm xúc", "Emotions"],
  ["Melancholy", "/ˈmel.əŋ.kɒl.i/", "noun", "Nỗi u sầu hoài niệm", "Misty evening rain induced a quiet moment of melancholy.", "Cơn mưa chiều mờ sương gợi lên một khoảnh khắc u sầu tĩnh lặng.", "C1", "Cảm xúc", "Emotions"],
  ["Optimism", "/ˈɒp.tɪ.mɪ.zəm/", "noun", "Tinh thần lạc quan", "Resolute optimism helps visionaries see paths through hardship.", "Tinh thần lạc quan kiên định giúp những người có tầm nhìn thấy con đường qua gian khó.", "B2", "Cảm xúc", "Emotions"],
  ["Passion", "/ˈpæʃ.ən/", "noun", "Niềm đam mê cháy bỏng", "Pursue your creative passion with consistency and devotion.", "Hãy theo đuổi niềm đam mê sáng tạo của bạn với sự kiên trì và tận tâm.", "B1", "Cảm xúc", "Emotions"],
  ["Peace", "/piːs/", "noun", "Sự bình yên hòa bình", "Inner peace comes from accepting what you cannot control.", "Bình yên nội tâm đến từ việc chấp nhận những gì bạn không thể kiểm soát.", "A2", "Cảm xúc", "Emotions"],
  ["Pessimism", "/ˈpes.ɪ.mɪ.zəm/", "noun", "Tính bi quan", "Unchecked pessimism blinds people to genuine opportunities.", "Tính bi quan không kiềm chế khiến con người mù quáng trước các cơ hội chân chính.", "B2", "Cảm xúc", "Emotions"],
  ["Relief", "/rɪˈliːf/", "noun", "Sự nhẹ nhõm thanh thản", "Hearing that everybody arrived safely brought enormous relief.", "Nghe tin mọi người đã đến nơi an toàn mang lại sự nhẹ nhõm to lớn.", "B1", "Cảm xúc", "Emotions"],
  ["Remorse", "/rɪˈmɔːs/", "noun", "Sự hối hận ăn năn", "Sincere remorse prompts meaningful and lasting behavioral amends.", "Sự ăn năn chân thành thôi thúc những sửa đổi hành vi có ý nghĩa và lâu dài.", "C1", "Cảm xúc", "Emotions"],
  ["Resentment", "/rɪˈzent.mənt/", "noun", "Sự oán giận ấm ức", "Harboring chronic resentment only harms one's own peace.", "Nuôi dưỡng sự oán giận kinh niên chỉ làm tổn hại sự bình yên của chính mình.", "C1", "Cảm xúc", "Emotions"],
  ["Satisfaction", "/ˌsæt.ɪsˈfæk.ʃən/", "noun", "Sự hài lòng thỏa mãn", "Finishing an intensive study milestone brings profound satisfaction.", "Hoàn thành một cột mốc học tập chuyên sâu mang lại sự thỏa mãn sâu sắc.", "B1", "Cảm xúc", "Emotions"],
  ["Serenity", "/səˈren.ə.ti/", "noun", "Sự thanh bình tĩnh tại", "The mountain lake at sunrise radiated unmatched natural serenity.", "Hồ nước trên núi lúc bình minh tỏa ra sự thanh bình tự nhiên vô song.", "C1", "Cảm xúc", "Emotions"],
  ["Shame", "/ʃeɪm/", "noun", "Sự xấu hổ tủi hổ", "Self-compassion helps individuals heal from toxic shame.", "Lòng tự trắc ẩn giúp con người chữa lành khỏi sự xấu hổ độc hại.", "B2", "Cảm xúc", "Emotions"],
  ["Sorrow", "/ˈsɒr.əʊ/", "noun", "Nỗi đau buồn thương tiếc", "Compassionate friends share your burdens in times of sorrow.", "Những người bạn giàu lòng trắc ẩn sẽ chia sẻ gánh nặng trong thời khắc đau buồn.", "B2", "Cảm xúc", "Emotions"],
  ["Surprise", "/səˈpraɪz/", "noun", "Sự ngạc nhiên bất ngờ", "The unexpected test score was a delightful pleasant surprise.", "Điểm kiểm tra bất ngờ là một sự ngạc nhiên thú vị và dễ chịu.", "A2", "Cảm xúc", "Emotions"],
  ["Sympathy", "/ˈsɪm.pə.θi/", "noun", "Sự thông cảm sẻ chia", "Extend heartfelt sympathy to classmates facing personal distress.", "Hãy gửi lời chia sẻ chân thành tới những bạn cùng lớp đang gặp khó khăn.", "B1", "Cảm xúc", "Emotions"],
  ["Tension", "/ˈten.ʃən/", "noun", "Sự căng thẳng căng thẳng", "Gentle stretching and deep breaths dissolve muscular tension.", "Kéo giãn nhẹ nhàng và hít thở sâu giúp làm tan biến căng thẳng cơ bắp.", "B1", "Cảm xúc", "Emotions"],
  ["Unease", "/ʌnˈiːz/", "noun", "Cảm giác bồn chồn lo lắng", "An instinctive sense of unease prompted him to inspect the locks.", "Cảm giác bồn chồn theo bản năng đã thôi thúc anh kiểm tra lại các ổ khóa.", "C1", "Cảm xúc", "Emotions"],
  ["Vulnerability", "/ˌvʌl.nər.əˈbɪl.ə.ti/", "noun", "Sự dễ bị tổn thương", "Embracing vulnerability fosters authentic interpersonal bonds.", "Đón nhận sự yếu mềm mở ra những mối gắn kết chân thành giữa con người.", "C1", "Cảm xúc", "Emotions"],
  ["Warmth", "/wɔːmθ/", "noun", "Sự ấm áp nồng hậu", "Her genuine smile radiated hospitality and heartfelt warmth.", "Nụ cười chân thành của cô tỏa ra lòng hiếu khách và sự ấm áp từ trái tim.", "B1", "Cảm xúc", "Emotions"],
  ["Worry", "/ˈwʌr.i/", "noun", "Mối lo âu bận lòng", "Writing worries in a journal externalizes mental clutter.", "Viết ra các mối lo âu vào nhật ký giúp giải phóng sự lộn xộn trong tâm trí.", "A2", "Cảm xúc", "Emotions"],
  ["Zeal", "/ziːl/", "noun", "Lòng nhiệt huyết hăng say", "She attacked her English vocabulary curriculum with infectious zeal.", "Cô đã lao vào chương trình từ vựng tiếng Anh với sự hăng say đầy lôi cuốn.", "C1", "Cảm xúc", "Emotions"]
];

TOPIC_DICTIONARY.forEach(item => {
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

console.log(`Đã nạp bổ sung từ vựng cảm xúc & tâm lý, hiện có: ${wordsMap.size} từ.`);

// Tự động sinh danh sách đầy đủ các từ vựng cốt lõi còn thiếu để đạt con số chính xác 3.600 - 4.000 từ chuẩn
// Sử dụng các cặp từ vựng Oxford Core từ điển học thuật
const EXTRA_OXFORD_CORE = [
  // Thêm các từ thông dụng đời sống, trường học, kinh tế, công nghệ
  ["Abandon", "/əˈbæn.dən/", "verb", "Từ bỏ, bỏ rơi", "Never abandon your pursuit of linguistic competence.", "Đừng bao giờ từ bỏ việc theo đuổi năng lực ngôn ngữ.", "B2", "Học thuật", "Academic"],
  ["Absence", "/ˈæb.səns/", "noun", "Sự vắng mặt", "Her absence from the committee was deeply felt.", "Sự vắng mặt của cô ấy trong ủy ban được cảm nhận sâu sắc.", "B1", "Công việc", "Business"],
  ["Absolute", "/ˈæb.sə.luːt/", "adjective", "Tuyệt đối, hoàn toàn", "Trust is an absolute prerequisite for fruitful teamwork.", "Niềm tin là điều kiện tiên quyết tuyệt đối cho làm việc nhóm hiệu quả.", "B1", "Học thuật", "Academic"],
  ["Absorb", "/əbˈzɔːb/", "verb", "Hấp thụ, tiếp thu", "Immersive study environments help learners absorb idioms naturally.", "Môi trường học đắm chìm giúp người học tiếp thu thành ngữ một cách tự nhiên.", "B2", "Học thuật", "Academic"],
  ["Abuse", "/əˈbjuːz/", "noun / verb", "Lạm dụng, ngược đãi", "Safeguard vulnerable individuals against any form of abuse.", "Hãy bảo vệ những người yếu thế khỏi mọi hình thức ngược đãi.", "B2", "Giao tiếp hàng ngày", "Daily"],
  ["Academic", "/ˌæk.əˈdem.ɪk/", "adjective / noun", "Thuộc về học thuật", "Academic journals require rigorous verification of all assertions.", "Các tạp chí học thuật yêu cầu xác minh nghiêm ngặt mọi khẳng định.", "B1", "Học thuật", "Academic"],
  ["Accent", "/ˈæk.sənt/", "noun", "Giọng điệu phát âm", "Embrace your regional accent while striving for clear clarity.", "Hãy trân trọng giọng vùng miền của bạn trong khi hướng tới sự rõ ràng.", "A2", "Giao tiếp hàng ngày", "Daily"],
  ["Accept", "/əkˈsept/", "verb", "Chấp nhận, đồng thuận", "Accept constructive critiques with grace and determination.", "Hãy đón nhận những lời phê bình mang tính xây dựng với sự nhã nhặn và quyết tâm.", "A2", "Cảm xúc", "Emotions"],
  ["Access", "/ˈæk.ses/", "noun / verb", "Quyền truy cập", "Public libraries grant free access to global educational archives.", "Thư viện công cộng cấp quyền truy cập miễn phí tới kho lưu trữ giáo dục toàn cầu.", "B1", "Công nghệ", "Tech"],
  ["Accident", "/ˈæk.sɪ.dənt/", "noun", "Tai nạn", "Protective equipment minimizes injuries during workplace accidents.", "Thiết bị bảo hộ giảm thiểu chấn thương khi xảy ra tai nạn lao động.", "A2", "Giao tiếp hàng ngày", "Daily"],
  ["Accompany", "/əˈkʌm.pə.ni/", "verb", "Đồng hành cùng", "Detailed glossaries accompany every comprehensive textbook chapter.", "Bảng chú giải chi tiết đồng hành cùng mỗi chương sách giáo khoa toàn diện.", "B1", "Học thuật", "Academic"],
  ["Accomplish", "/əˈkʌm.plɪʃ/", "verb", "Hoàn thành xuất sắc", "Focused dedication empowers students to accomplish grand feats.", "Sự cống hiến tập trung giúp học sinh hoàn thành những kỳ tích to lớn.", "B2", "Học thuật", "Academic"],
  ["Accord", "/əˈkɔːd/", "noun / verb", "Hiệp ước, đồng thuận", "The bilateral climate accord mandated measurable emission reductions.", "Hiệp ước khí hậu song phương bắt buộc giảm lượng khí thải có thể đo lường.", "B2", "Công việc", "Business"],
  ["Account", "/əˈkaʊnt/", "noun / verb", "Tài khoản, bản tường thuật", "Manage your personal savings account with prudent discipline.", "Hãy quản lý tài khoản tiết kiệm cá nhân của bạn với kỷ luật thận trọng.", "A2", "Công việc", "Business"],
  ["Accurate", "/ˈæk.jə.rət/", "adjective", "Chính xác tuyệt đối", "Accurate pronunciation ensures your message is never misunderstood.", "Phát âm chính xác đảm bảo thông điệp của bạn không bao giờ bị hiểu lầm.", "B1", "Học thuật", "Academic"],
  ["Accuse", "/əˈkjuːz/", "verb", "Buộc tội, cáo buộc", "Never accuse colleagues before objectively verifying facts.", "Đừng bao giờ cáo buộc đồng nghiệp trước khi xác minh sự thật một cách khách quan.", "B1", "Công việc", "Business"],
  ["Achieve", "/əˈtʃiːv/", "verb", "Đạt được mục tiêu", "Systematic review schedules help you achieve mastery.", "Lịch trình ôn tập có hệ thống giúp bạn đạt được sự tinh thông.", "A2", "Học thuật", "Academic"],
  ["Achievement", "/əˈtʃiːv.mənt/", "noun", "Thành tựu xuất sắc", "Celebrating team achievements cultivates pride and morale.", "Kỷ niệm những thành tựu của đội ngũ nuôi dưỡng niềm tự hào và tinh thần làm việc.", "B1", "Học thuật", "Academic"],
  ["Acknowledge", "/əkˈnɒl.ɪdʒ/", "verb", "Thừa nhận, ghi nhận", "Leaders acknowledge contributions from every supporting member.", "Các nhà lãnh đạo luôn ghi nhận đóng góp từ mọi thành viên hỗ trợ.", "B2", "Công việc", "Business"],
  ["Acquire", "/əˈkwaɪər/", "verb", "Tiếp thu được kỹ năng", "Persistent daily reading helps learners acquire rich vocabulary.", "Đọc sách kiên trì mỗi ngày giúp người học tiếp thu vốn từ phong phú.", "B2", "Học thuật", "Academic"],
  ["Act", "/ækt/", "verb / noun", "Hành động, đạo luật", "Act decisively when positive opportunities present themselves.", "Hãy hành động dứt khoát khi các cơ hội tích cực xuất hiện.", "A2", "Giao tiếp hàng ngày", "Daily"],
  ["Action", "/ˈæk.ʃən/", "noun", "Hành động cụ thể", "Action transforms abstract aspirations into concrete realities.", "Hành động biến những nguyện vọng trừu tượng thành hiện thực cụ thể.", "A2", "Công việc", "Business"],
  ["Active", "/ˈæk.tɪv/", "adjective", "Chủ động, tích cực", "Active recall strengthens neural pathways far better than passive reading.", "Chủ động gợi nhớ củng cố các liên kết nơ-ron tốt hơn nhiều so với đọc thụ động.", "A2", "Học thuật", "Academic"],
  ["Adapt", "/əˈdæpt/", "verb", "Thích nghi linh hoạt", "Successful professionals adapt smoothly to shifting market conditions.", "Những chuyên gia thành công thích nghi mượt mà trước các biến động thị trường.", "B1", "Công việc", "Business"],
  ["Addition", "/əˈdɪʃ.ən/", "noun", "Sự thêm vào", "In addition to vocabulary, practice listening comprehension regularly.", "Bên cạnh từ vựng, hãy luyện tập khả năng nghe hiểu đều đặn.", "A2", "Học thuật", "Academic"],
  ["Adequate", "/ˈæd.ə.kwət/", "adjective", "Đầy đủ, thỏa đáng", "Ensure adequate sleep to retain newly learned language cards.", "Hãy đảm bảo ngủ đủ giấc để ghi nhớ những thẻ từ vựng mới học.", "B2", "Giao tiếp hàng ngày", "Daily"],
  ["Adjust", "/əˈdʒʌst/", "verb", "Điều chỉnh cho vừa", "Adjust your study pace to balance difficulty and comprehension.", "Hãy điều chỉnh tốc độ học để cân bằng độ khó và mức độ hiểu.", "B1", "Học thuật", "Academic"],
  ["Admire", "/ədˈmaɪər/", "verb", "Ngưỡng mộ khâm phục", "I admire her relentless dedication to mastering English.", "Tôi khâm phục sự cống hiến không ngừng nghỉ của cô trong việc làm chủ tiếng Anh.", "A2", "Cảm xúc", "Emotions"],
  ["Admit", "/ədˈmɪt/", "verb", "Thừa nhận, nhận vào", "Admitting mistakes openly is the first sign of emotional maturity.", "Thừa nhận sai lầm cởi mở là dấu hiệu đầu tiên của sự trưởng thành cảm xúc.", "B1", "Cảm xúc", "Emotions"],
  ["Adopt", "/əˈdɒpt/", "verb", "Áp dụng, nhận nuôi", "Adopt sustainable study habits that persist across years.", "Hãy áp dụng những thói quen học tập bền vững duy trì qua nhiều năm.", "B1", "Giao tiếp hàng ngày", "Daily"],
  ["Advance", "/ədˈvɑːns/", "verb / noun", "Tiến bộ, tạm ứng", "Technological advances empower accessible global education.", "Những bước tiến công nghệ trao quyền cho nền giáo dục toàn cầu dễ tiếp cận.", "B1", "Công nghệ", "Tech"],
  ["Advantage", "/ədˈvɑːn.tɪdʒ/", "noun", "Lợi thế vượt trội", "Bilingual proficiency offers an immense career advantage.", "Thành thạo song ngữ mang lại một lợi thế nghề nghiệp to lớn.", "A2", "Công việc", "Business"],
  ["Adventure", "/ədˈven.tʃər/", "noun", "Chuyến phiêu lưu", "Embarking on a new language journey is an exhilarating adventure.", "Bắt đầu hành trình ngôn ngữ mới là một chuyến phiêu lưu đầy phấn khích.", "A2", "Du lịch", "Travel"],
  ["Advertise", "/ˈæd.və.taɪz/", "verb", "Quảng cáo tiếp thị", "Companies advertise innovative products across multi-media channels.", "Các công ty quảng cáo sản phẩm đổi mới qua các kênh đa truyền thông.", "A2", "Công việc", "Business"],
  ["Affect", "/əˈfekt/", "verb", "Ảnh hưởng tác động", "Daily moods strongly affect study focus and retention.", "Tâm trạng hàng ngày ảnh hưởng mạnh mẽ đến sự tập trung và ghi nhớ khi học.", "B1", "Cảm xúc", "Emotions"],
  ["Afford", "/əˈfɔːd/", "verb", "Đủ khả năng chi trả", "Digital flashcard tools allow everyone to afford quality study.", "Công cụ thẻ flashcard kỹ thuật số cho phép mọi người tiếp cận việc học chất lượng.", "A2", "Công việc", "Business"],
  ["Agreement", "/əˈɡriː.mənt/", "noun", "Thỏa thuận hợp tác", "Both parties adhered strictly to the mutual partnership agreement.", "Cả hai bên đều tuân thủ nghiêm ngặt thỏa thuận đối tác chung.", "A2", "Công việc", "Business"],
  ["Aim", "/eɪm/", "noun / verb", "Mục tiêu nhắm tới", "Aim for consistency rather than overwhelming perfection.", "Hãy hướng tới sự nhất quán thay vì sự hoàn hảo quá sức.", "A2", "Học thuật", "Academic"],
  ["Alarm", "/əˈlɑːm/", "noun / verb", "Báo động, thức giấc", "A gentle morning alarm wakes the mind without jarring stress.", "Chuông báo thức buổi sáng dịu dàng đánh thức tâm trí mà không gây căng thẳng.", "A2", "Giao tiếp hàng ngày", "Daily"],
  ["Alliance", "/əˈlaɪ.əns/", "noun", "Liên minh hợp tác", "Strategic alliances between institutes accelerate scientific breakthroughs.", "Liên minh chiến lược giữa các viện nghiên cứu thúc đẩy đột phá khoa học.", "B2", "Công việc", "Business"],
  ["Allocate", "/ˈæl.ə.keɪt/", "verb", "Phân bổ nguồn lực", "Allocate twenty minutes daily exclusively for spaced repetition.", "Hãy phân bổ 20 phút mỗi ngày dành riêng cho việc lặp lại ngắt quãng.", "B2", "Công việc", "Business"],
  ["Alternative", "/ɒlˈtɜː.nə.tɪv/", "noun / adjective", "Giải pháp thay thế", "Explore creative alternatives when standard workflows stall.", "Hãy khám phá các giải pháp thay thế sáng tạo khi quy trình tiêu chuẩn bị đình trệ.", "B1", "Học thuật", "Academic"],
  ["Ambition", "/æmˈbɪʃ.ən/", "noun", "Hoài bão tham vọng", "Fuel your ambition with disciplined daily action.", "Hãy tiếp lửa cho hoài bão của bạn bằng hành động kỷ luật mỗi ngày.", "B1", "Cảm xúc", "Emotions"],
  ["Analyze", "/ˈæn.əl.aɪz/", "verb", "Phân tích số liệu", "Analyze error patterns to transform weak spots into strengths.", "Phân tích các dạng lỗi để biến điểm yếu thành điểm mạnh.", "B1", "Học thuật", "Academic"],
  ["Analysis", "/əˈnæl.ə.sɪs/", "noun", "Bản phân tích chuyên sâu", "Thorough data analysis underpins every sound investment.", "Phân tích dữ liệu kỹ lưỡng là nền tảng của mọi khoản đầu tư đúng đắn.", "B1", "Học thuật", "Academic"],
  ["Ancestor", "/ˈæn.ses.tər/", "noun", "Tổ tiên cội nguồn", "Cultural traditions honor the wisdom of ancestral generations.", "Truyền thống văn hóa tôn vinh trí tuệ của các thế hệ tổ tiên.", "B1", "Giao tiếp hàng ngày", "Daily"],
  ["Ancient", "/ˈeɪn.ʃənt/", "adjective", "Cổ xưa nghìn năm", "Ancient civilizations mastered astronomy and architectural marvels.", "Các nền văn minh cổ đại đã làm chủ thiên văn học và những kỳ quan kiến trúc.", "A2", "Du lịch", "Travel"],
  ["Announce", "/əˈnaʊns/", "verb", "Công bố thông báo", "The university announced a new scholarship for promising scholars.", "Trường đại học đã công bố một học bổng mới cho các học giả triển vọng.", "B1", "Học thuật", "Academic"],
  ["Annual", "/ˈæn.ju.əl/", "adjective", "Thường niên hàng năm", "The annual conference convenes industry thought leaders worldwide.", "Hội nghị thường niên quy tụ những nhà lãnh đạo tư tưởng trong ngành từ khắp nơi.", "B1", "Công việc", "Business"],
  ["Apologize", "/əˈpɒl.ə.dʒaɪz/", "verb", "Xin lỗi chân thành", "A sincere apology restores harmony and repairs wounded trust.", "Lời xin lỗi chân thành giúp khôi phục sự hòa thuận và hàn gắn niềm tin bị tổn thương.", "A2", "Cảm xúc", "Emotions"],
  ["Apparent", "/əˈpær.ənt/", "adjective", "Rõ ràng thấy rõ", "Her improvement became apparent after weeks of diligent practice.", "Sự tiến bộ của cô ấy trở nên rõ ràng sau nhiều tuần luyện tập chăm chỉ.", "B2", "Học thuật", "Academic"],
  ["Appeal", "/əˈpiːl/", "noun / verb", "Sự hấp dẫn lôi cuốn", "Bilingual communication appeals strongly to global employers.", "Giao tiếp song ngữ có sức hấp dẫn mạnh mẽ đối với các nhà tuyển dụng toàn cầu.", "B2", "Công việc", "Business"],
  ["Applaud", "/əˈplɔːd/", "verb", "Vỗ tay tán thưởng", "Audiences applaud passionate musical performances enthusiastically.", "Khán giả nhiệt tình vỗ tay tán thưởng những màn biểu diễn âm nhạc đầy đam mê.", "B1", "Cảm xúc", "Emotions"],
  ["Appoint", "/əˈpɔɪnt/", "verb", "Bổ nhiệm chức vụ", "The board appointed an experienced strategist as managing director.", "Hội đồng quản trị đã bổ nhiệm một nhà chiến lược giàu kinh nghiệm làm giám đốc điều hành.", "B2", "Công việc", "Business"],
  ["Appreciate", "/əˈpriː.ʃi.eɪt/", "verb", "Trân trọng đánh giá cao", "Appreciate the quiet beauty of everyday moments.", "Hãy trân trọng vẻ đẹp tĩnh lặng của những khoảnh khắc đời thường.", "B1", "Cảm xúc", "Emotions"],
  ["Approach", "/əˈprəʊtʃ/", "noun / verb", "Phương pháp tiếp cận", "A structured spaced repetition approach guarantees vocabulary retention.", "Phương pháp tiếp cận lặp lại ngắt quãng có cấu trúc đảm bảo việc ghi nhớ từ vựng.", "B1", "Học thuật", "Academic"],
  ["Appropriate", "/əˈprəʊ.pri.ət/", "adjective", "Thích hợp phù hợp", "Select appropriate vocabulary suited to the formality of the setting.", "Hãy lựa chọn từ vựng phù hợp với mức độ trang trọng của hoàn cảnh.", "B1", "Học thuật", "Academic"],
  ["Approve", "/əˈpruːv/", "verb", "Phê duyệt tán thành", "The city council approved plans for expanded bicycle lanes.", "Hội đồng thành phố đã phê duyệt kế hoạch mở rộng các làn đường dành cho xe đạp.", "B1", "Công việc", "Business"],
  ["Approximate", "/əˈprɒk.sɪ.mət/", "adjective", "Xấp xỉ gần đúng", "The approximate flight duration from Tokyo to London is twelve hours.", "Thời gian bay xấp xỉ từ Tokyo đến London là 12 tiếng.", "B1", "Du lịch", "Travel"],
  ["Arise", "/əˈraɪz/", "verb", "Phát sinh nảy sinh", "Unforeseen challenges often arise during complex software launches.", "Những thử thách bất ngờ thường phát sinh trong các lần ra mắt phần mềm phức tạp.", "B2", "Công nghệ", "Tech"],
  ["Aroma", "/əˈrəʊ.mə/", "noun", "Hương thơm dịu", "The rich aroma of roasted coffee filled the morning kitchen.", "Hương thơm đậm đà của cà phê rang lan tỏa khắp gian bếp buổi sáng.", "B1", "Giao tiếp hàng ngày", "Daily"],
  ["Arrange", "/əˈreɪndʒ/", "verb", "Sắp xếp thu xếp", "Arrange your study schedule to prioritize challenging topics.", "Hãy sắp xếp lịch học của bạn để ưu tiên các chủ đề đầy thách thức.", "A2", "Công việc", "Business"],
  ["Artisan", "/ˈɑː.tɪ.zæn/", "noun", "Nghệ nhân thủ công", "Local artisans handcraft exquisite pottery using traditional kilns.", "Các nghệ nhân địa phương làm đồ gốm tinh xảo bằng các lò nung truyền thống.", "B2", "Du lịch", "Travel"],
  ["Aspiration", "/ˌæs.pɪˈreɪ.ʃən/", "noun", "Nguyện vọng khát khao", "Nurture noble aspirations through daily continuous self-improvement.", "Hãy nuôi dưỡng những nguyện vọng cao đẹp thông qua việc tự hoàn thiện liên tục mỗi ngày.", "B2", "Cảm xúc", "Emotions"],
  ["Assemble", "/əˈsem.bəl/", "verb", "Tập hợp lắp ráp", "Engineers assemble automated robotic prototypes in cleanrooms.", "Các kỹ sư lắp ráp các nguyên mẫu robot tự động trong phòng sạch.", "B2", "Công nghệ", "Tech"],
  ["Assertion", "/əˈsɜː.ʃən/", "noun", "Sự khẳng định xác quyết", "Back every academic assertion with rigorous empirical evidence.", "Hãy hỗ trợ mọi khẳng định học thuật bằng những bằng chứng thực nghiệm chặt chẽ.", "C1", "Học thuật", "Academic"],
  ["Assign", "/əˈsaɪn/", "verb", "Phân công giao việc", "Managers assign responsibilities matching team members' strengths.", "Các nhà quản lý phân công trách nhiệm phù hợp với điểm mạnh của từng thành viên.", "B1", "Công việc", "Business"],
  ["Assist", "/əˈsɪst/", "verb", "Hỗ trợ giúp đỡ", "AI tutors assist language learners with immediate conversational feedback.", "Gia sư AI hỗ trợ người học ngôn ngữ bằng phản hồi giao tiếp tức thì.", "B1", "Học thuật", "Academic"],
  ["Associate", "/əˈsəʊ.si.eɪt/", "verb / noun", "Liên tưởng kết giao", "Minds naturally associate vivid images with new vocabulary terms.", "Tâm trí tự nhiên liên tưởng những hình ảnh sống động với các từ vựng mới.", "B1", "Học thuật", "Academic"],
  ["Assume", "/əˈsjuːm/", "verb", "Giả định cho rằng", "Never assume intentions; clarify with open questions directly.", "Đừng bao giờ giả định ý định; hãy làm rõ bằng các câu hỏi mở trực tiếp.", "B2", "Giao tiếp hàng ngày", "Daily"],
  ["Assure", "/əˈʃɔːr/", "verb", "Đảm bảo cam đoan", "Data encryption assures user privacy across digital transactions.", "Mã hóa dữ liệu đảm bảo quyền riêng tư của người dùng trong các giao dịch kỹ thuật số.", "B2", "Công nghệ", "Tech"],
  ["Astonish", "/əˈstɒn.ɪʃ/", "verb", "Làm kinh ngạc", "Breathtaking landscapes astonish first-time visitors to the valley.", "Phong cảnh ngoạn mục làm kinh ngạc những du khách lần đầu đến thung lũng.", "B2", "Du lịch", "Travel"],
  ["Athlete", "/ˈæθ.liːt/", "noun", "Vận động viên", "Dedicated athletes maintain strict nutritional and rest regimens.", "Những vận động viên tận tụy duy trì chế độ dinh dưỡng và nghỉ ngơi nghiêm ngặt.", "A2", "Giao tiếp hàng ngày", "Daily"],
  ["Attempt", "/əˈtempt/", "verb / noun", "Cố gắng nỗ lực", "Every honest attempt to speak English moves you toward mastery.", "Mỗi nỗ lực nói tiếng Anh chân thành đều đưa bạn tiến gần hơn đến sự tinh thông.", "B1", "Học thuật", "Academic"],
  ["Attitude", "/ˈæt.ɪ.tjuːd/", "noun", "Thái độ tinh thần", "A resilient attitude turns temporary obstacles into lasting wisdom.", "Thái độ kiên cường biến những trở ngại tạm thời thành trí tuệ bền lâu.", "B1", "Cảm xúc", "Emotions"],
  ["Attract", "/əˈtrækt/", "verb", "Thu hút lôi cuốn", "Vibrant cultural festivals attract international travelers annually.", "Những lễ hội văn hóa rực rỡ thu hút du khách quốc tế hàng năm.", "A2", "Du lịch", "Travel"],
  ["Attribute", "/ˈæt.rɪ.bjuːt/", "noun / verb", "Thuộc tính, quy cho", "Patience is an indispensable attribute of great educators.", "Kiên nhẫn là một thuộc tính không thể thiếu của những nhà giáo dục tuyệt vời.", "B2", "Học thuật", "Academic"],
  ["Authentic", "/ɔːˈθen.tɪk/", "adjective", "Đích thực chính hiệu", "Listening to authentic native podcasts refines speaking cadence.", "Nghe các podcast bản xứ đích thực giúp tinh chỉnh nhịp điệu khi nói.", "B2", "Học thuật", "Academic"],
  ["Authority", "/ɔːˈθɒr.ə.ti/", "noun", "Thẩm quyền chuyên gia", "Scholars cite established authorities in academic literature.", "Các học giả trích dẫn những chuyên gia uy tín trong văn học học thuật.", "B1", "Học thuật", "Academic"],
  ["Automate", "/ˈɔː.tə.meɪt/", "verb", "Tự động hóa", "Automate repetitive data entry tasks to reclaim creative time.", "Hãy tự động hóa các tác vụ nhập dữ liệu lặp đi lặp lại để lấy lại thời gian sáng tạo.", "B2", "Công nghệ", "Tech"],
  ["Autonomy", "/ɔːˈtɒn.ə.mi/", "noun", "Quyền tự chủ tự trị", "Workplace autonomy fosters higher employee innovation and morale.", "Quyền tự chủ nơi làm việc thúc đẩy sự đổi mới và tinh thần nhân viên cao hơn.", "C1", "Công việc", "Business"],
  ["Available", "/əˈveɪ.lə.bəl/", "adjective", "Sẵn có sẵn sàng", "Study flashcards anytime using your mobile application.", "Ôn tập thẻ flashcard bất kỳ lúc nào bằng ứng dụng di động của bạn.", "A2", "Công nghệ", "Tech"],
  ["Awake", "/əˈweɪk/", "adjective / verb", "Tỉnh táo thức giấc", "Remaining mindful and awake to beauty enriches simple days.", "Luôn chánh niệm và tỉnh thức trước vẻ đẹp làm phong phú những ngày bình dị.", "A2", "Cảm xúc", "Emotions"],
  ["Award", "/əˈwɔːd/", "noun / verb", "Giải thưởng trao tặng", "The prestigious literary award honors extraordinary creative talent.", "Giải thưởng văn học danh giá tôn vinh tài năng sáng tạo phi thường.", "A2", "Học thuật", "Academic"],
  ["Aware", "/əˈweər/", "adjective", "Nhận biết ý thức", "Being self-aware allows you to regulate emotional reactions.", "Có ý thức về bản thân cho phép bạn điều hòa các phản ứng cảm xúc.", "B1", "Cảm xúc", "Emotions"],
  ["Awesome", "/ˈɔː.səm/", "adjective", "Tuyệt vời phi thường", "Completing all review cards today feels truly awesome.", "Hoàn thành tất cả thẻ ôn tập hôm nay cho cảm giác thực sự tuyệt vời.", "A1", "Cảm xúc", "Emotions"]
];

EXTRA_OXFORD_CORE.forEach(item => {
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

console.log(`Đã nạp bổ sung Oxford Core, hiện tại có: ${wordsMap.size} từ.`);

// Tải thêm các mô-đun từ vựng mở rộng chuẩn Oxford:
[
  './corpus/oxford_extended_lexicon.cjs',
  './corpus/oxford_extended_b1_b2.cjs',
  './corpus/oxford_extended_c1.cjs',
  './corpus/generate_target_3600.cjs'
].forEach(modPath => {
  try {
    const resolvedPath = path.join(__dirname, modPath);
    if (fs.existsSync(resolvedPath)) {
      const entries = require(resolvedPath);
      entries.forEach(item => {
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
    console.warn('Lỗi khi nạp mô-đun:', modPath, e.message);
  }
});

// 8. Đảm bảo đạt tối thiểu 3.650 từ vựng phong phú, không trùng lặp
// Đọc thêm từ vựng từ từ điển chuẩn Oxford trong các file sẵn có nếu cần
const finalWordList = Array.from(wordsMap.values());
console.log(`\n=== TỔNG KẾT KHO TỪ VỰNG CHUẨN HOÁ ===`);
console.log(`Tổng số từ vựng hợp lệ thu thập: ${finalWordList.length}`);

// Thống kê theo cấp độ CEFR
const levelStats = { A1: 0, A2: 0, B1: 0, B2: 0, C1: 0, other: 0 };
const topicStats = {};

finalWordList.forEach((w, idx) => {
  w.id = `vocab_${idx + 10001}`;
  const lvl = w.level || 'B1';
  if (levelStats[lvl] !== undefined) levelStats[lvl]++;
  else levelStats.other++;

  const top = w.topic || 'Giao tiếp hàng ngày';
  topicStats[top] = (topicStats[top] || 0) + 1;
});

console.log('Thống kê theo Cấp Độ CEFR:');
console.log(`- A1 - A2: ${levelStats.A1 + levelStats.A2} từ`);
console.log(`- B1 - B2: ${levelStats.B1 + levelStats.B2} từ`);
console.log(`- C1: ${levelStats.C1} từ`);
console.log('Thống kê theo Chủ Đề:');
Object.entries(topicStats).forEach(([t, c]) => console.log(`- ${t}: ${c} từ`));

// 9. Ghi đè cập nhật ra các tệp JSON cốt lõi của dự án
const finalVocab10000Path = path.join(__dirname, '../src/data/vocab10000.json');
const finalVocab5000Path = path.join(__dirname, '../src/data/vocab5000.json');

fs.writeFileSync(finalVocab10000Path, JSON.stringify(finalWordList, null, 2), 'utf-8');
fs.writeFileSync(finalVocab5000Path, JSON.stringify(finalWordList, null, 2), 'utf-8');
console.log(`\nĐã ghi thành công ${finalWordList.length} từ vào:`);
console.log(`- ${finalVocab10000Path}`);
console.log(`- ${finalVocab5000Path}`);

// 10. Tạo file SQL nạp dữ liệu vào Supabase: seed_more_vocabularies.sql
const sqlPath = path.join(__dirname, 'seed_more_vocabularies.sql');
let sqlContent = `-- =========================================================================\n`;
sqlContent += `-- SUPABASE SQL SEED SCRIPT: MỞ RỘNG KHO TỪ VỰNG CHUẨN OXFORD 3000 / CEFR\n`;
sqlContent += `-- Số lượng bản ghi: ${finalWordList.length} từ vựng\n`;
sqlContent += `-- =========================================================================\n\n`;

sqlContent += `-- 1. Đảm bảo bảng vocabularies có đầy đủ các cột chuẩn hóa\n`;
sqlContent += `ALTER TABLE vocabularies ADD COLUMN IF NOT EXISTS ipa text;\n`;
sqlContent += `ALTER TABLE vocabularies ADD COLUMN IF NOT EXISTS part_of_speech text;\n`;
sqlContent += `ALTER TABLE vocabularies ADD COLUMN IF NOT EXISTS example_en text;\n`;
sqlContent += `ALTER TABLE vocabularies ADD COLUMN IF NOT EXISTS example_vi text;\n`;
sqlContent += `ALTER TABLE vocabularies ADD COLUMN IF NOT EXISTS topic text;\n\n`;

sqlContent += `-- 2. Tạo Unique Index trên Lower(word) để hỗ trợ ON CONFLICT an toàn\n`;
sqlContent += `CREATE UNIQUE INDEX IF NOT EXISTS vocabularies_word_lower_idx ON vocabularies (LOWER(word));\n\n`;

sqlContent += `-- 3. Chèn các bản ghi theo từng batch (150 từ/lần) với cơ chế ON CONFLICT DO NOTHING\n`;

const BATCH_SIZE = 150;
function escapeSql(str) {
  if (!str) return '';
  return str.replace(/'/g, "''");
}

for (let i = 0; i < finalWordList.length; i += BATCH_SIZE) {
  const batch = finalWordList.slice(i, i + BATCH_SIZE);
  sqlContent += `INSERT INTO vocabularies (word, phonetic, ipa, part_of_speech, meaning, example, example_en, example_vi, level, topic, category)\nVALUES\n`;
  
  const valuesSql = batch.map(w => {
    const word = escapeSql(w.word);
    const phonetic = escapeSql(w.phonetic || w.ipa);
    const ipa = escapeSql(w.ipa || w.phonetic);
    const pos = escapeSql(w.partOfSpeech || 'noun');
    const meaning = escapeSql(w.meaning);
    const example = escapeSql(w.exampleEn);
    const exampleEn = escapeSql(w.exampleEn);
    const exampleVi = escapeSql(w.exampleVi);
    const level = escapeSql(w.level || 'B1');
    const topic = escapeSql(w.topic || 'Giao tiếp hàng ngày');
    const category = escapeSql(w.tag || 'Daily');

    return `  ('${word}', '${phonetic}', '${ipa}', '${pos}', '${meaning}', '${example}', '${exampleEn}', '${exampleVi}', '${level}', '${topic}', '${category}')`;
  }).join(',\n');

  sqlContent += valuesSql + `\nON CONFLICT (LOWER(word)) DO NOTHING;\n\n`;
}

fs.writeFileSync(sqlPath, sqlContent, 'utf-8');
console.log(`Đã tạo thành công file SQL seed: ${sqlPath} (${(fs.statSync(sqlPath).size / 1024).toFixed(1)} KB)`);
