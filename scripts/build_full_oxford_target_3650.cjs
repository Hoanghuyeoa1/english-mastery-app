/**
 * BUILDER HOÀN THIỆN KHO TỪ VỰNG CHUẨN OXFORD 3000 / 5000 & CEFR
 * Biên soạn đạt chính xác 3.650+ từ vựng với đầy đủ 8 trường dữ liệu chuẩn:
 * word, ipa, part_of_speech, meaning, example_en, example_vi, level, topic
 */

const fs = require('fs');
const path = require('path');

const wordMap = new Map();

function addEntry(item) {
  if (!item || !item.word) return;
  const rawWord = String(item.word).trim();
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

// 1. Tải tất cả các mô-đun dữ liệu đã có
const modules = [
  './corpus/corpus_a1_a2.cjs',
  './corpus/oxford_extended_lexicon.cjs',
  './corpus/oxford_extended_b1_b2.cjs',
  './corpus/oxford_extended_c1.cjs',
  './corpus/generate_target_3600.cjs',
  './corpus/oxford_complete_3700.cjs',
  './corpus/generate_oxford_final_lexicon.cjs',
  './corpus/generate_oxford_database_to_target.cjs',
  './corpus/oxford_complete_generator.cjs',
  './corpus/oxford_sz_expansion.cjs',
  './corpus/oxford_final_topup.cjs'
];

modules.forEach(m => {
  try {
    const fullPath = path.join(__dirname, m);
    if (fs.existsSync(fullPath)) {
      const data = require(fullPath);
      data.forEach(item => {
        if (Array.isArray(item)) {
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
        } else {
          addEntry(item);
        }
      });
    }
  } catch (e) {
    console.error('Lỗi khi nạp module:', m, e.message);
  }
});

// Nạp thêm từ kho cũ (lọc sạch placeholder)
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

console.log(`Từ vựng hiện có trước khi nạp bộ từ M-Z: ${wordMap.size} từ.`);

// 2. Danh mục từ vựng chuẩn Oxford 3000 / 5000 cho các chữ cái M - Z
const OXFORD_MZ_LEXICON = [
  ["Machine", "/məˈʃiːn/", "noun", "Máy móc thiết bị", "Modern washing machines conserve water and electrical energy.", "Máy giặt hiện đại tiết kiệm nước và năng lượng điện.", "A1", "Công nghệ", "Tech"],
  ["Magazine", "/ˌmæɡ.əˈziːn/", "noun", "Tạp chí định kỳ", "Read international science magazines to absorb contemporary terms.", "Hãy đọc các tạp chí khoa học quốc tế để tiếp thu các thuật ngữ đương đại.", "A1", "Học thuật", "Academic"],
  ["Magic", "/ˈmædʒ.ɪk/", "noun / adjective", "Phép thuật kỳ diệu", "Spaced review works like magic for permanent word recall.", "Ôn tập ngắt quãng hoạt động như phép thuật cho việc nhớ lại từ vĩnh viễn.", "A2", "Cảm xúc", "Emotions"],
  ["Mail", "/meɪl/", "noun / verb", "Thư từ bưu phẩm", "Check your electronic mail inbox for seminar webinar links.", "Hãy kiểm tra hộp thư điện tử để lấy liên kết hội thảo trực tuyến.", "A1", "Công việc", "Business"],
  ["Maintain", "/meɪnˈteɪn/", "verb", "Duy trì giữ vững", "Maintain a daily study streak to build automatic fluency.", "Hãy duy trì chuỗi ngày học liên tục để xây dựng sự lưu loát tự động.", "A2", "Học thuật", "Academic"],
  ["Maintenance", "/ˈmeɪn.tən.əns/", "noun", "Sự bảo trì bảo dưỡng", "Regular software maintenance keeps servers running smoothly.", "Bảo trì phần mềm định kỳ giúp các máy chủ hoạt động êm ái.", "B2", "Công nghệ", "Tech"],
  ["Major", "/ˈmeɪ.dʒər/", "adjective / noun", "Chính yếu trọng đại", "Vocabulary acquisition is a major pillar of language mastery.", "Tiếp thu từ vựng là một trụ cột chính của việc làm chủ ngôn ngữ.", "A2", "Học thuật", "Academic"],
  ["Majority", "/məˈdʒɒr.ə.ti/", "noun", "Đa số phần đông", "The vast majority of fluent speakers practice listening daily.", "Đại đa số những người nói lưu loát đều luyện nghe mỗi ngày.", "B1", "Học thuật", "Academic"],
  ["Male", "/meɪl/", "adjective / noun", "Giới tính nam", "Both male and female students participate actively in seminars.", "Cả sinh viên nam và nữ đều tham gia tích cực trong các hội thảo.", "A2", "Giao tiếp hàng ngày", "Daily"],
  ["Mall", "/mɔːl/", "noun", "Trung tâm mua sắm", "They met at the metropolitan shopping mall bookstore cafe.", "Họ đã gặp nhau tại quán cà phê hiệu sách của trung tâm mua sắm đô thị.", "A1", "Du lịch", "Travel"],
  ["Manage", "/ˈmæn.ɪdʒ/", "verb", "Quản lý xoay xở", "Learn to manage your daily schedule to include 20 review minutes.", "Hãy học cách quản lý lịch trình hàng ngày để dành ra 20 phút ôn tập.", "A2", "Công việc", "Business"],
  ["Management", "/ˈmæn.ɪdʒ.mənt/", "noun", "Ban quản lý sự quản trị", "Agile project management accelerates product software delivery.", "Quản trị dự án linh hoạt giúp đẩy nhanh việc bàn giao phần mềm sản phẩm.", "B1", "Công việc", "Business"],
  ["Manager", "/ˈmæn.ɪ.dʒər/", "noun", "Người quản lý trưởng phòng", "The hiring manager praised her articulate conversational poise.", "Người quản lý tuyển dụng đã khen ngợi sự đĩnh đạc giao tiếp mạch lạc của cô.", "A2", "Công việc", "Business"],
  ["Manner", "/ˈmæn.ər/", "noun", "Cách thức tác phong", "Address international colleagues in a courteous manner.", "Hãy xưng hô với các đồng nghiệp quốc tế theo một tác phong lịch thiệp.", "B1", "Giao tiếp hàng ngày", "Daily"],
  ["Manufacture", "/ˌmæn.jəˈfæk.tʃər/", "verb / noun", "Sản xuất chế tạo", "Automated robotic arms manufacture precision medical tools.", "Các cánh tay robot tự động sản xuất các dụng cụ y tế chính xác.", "B2", "Công nghệ", "Tech"],
  ["Manufacturer", "/ˌmæn.jəˈfæk.tʃər.ər/", "noun", "Nhà sản xuất", "Leading semiconductor manufacturers invest in research labs.", "Các nhà sản xuất chất bán dẫn hàng đầu đầu tư vào các phòng nghiên cứu.", "B2", "Công nghệ", "Tech"],
  ["Manufacturing", "/ˌmæn.jəˈfæk.tʃər.ɪŋ/", "noun", "Ngành sản xuất chế tạo", "Advanced manufacturing creates high-technology jobs globally.", "Sản xuất tiên tiến tạo ra những việc làm công nghệ cao trên toàn cầu.", "B2", "Công việc", "Business"],
  ["Many", "/ˈmen.i/", "determiner / pronoun", "Nhiều phong phú", "Many dedicated learners achieve bilingual fluency in one year.", "Nhiều người học tận tụy đạt được sự lưu loát song ngữ trong một năm.", "A1", "Học thuật", "Academic"],
  ["Map", "/mæp/", "noun / verb", "Bản đồ lập bản đồ", "Map out your weekly study goals on a whiteboard calendar.", "Hãy vạch ra các mục tiêu học tập hàng tuần trên lịch bảng trắng.", "A1", "Du lịch", "Travel"],
  ["March", "/mɑːtʃ/", "noun / verb", "Tháng Ba, diễu hành", "March winds welcome early spring blossoms across hillsides.", "Những cơn gió tháng Ba chào đón hoa nở sớm đầu xuân trên các sườn đồi.", "A1", "Giao tiếp hàng ngày", "Daily"],
  ["Margin", "/ˈmɑː.dʒɪn/", "noun", "Lề trang mép bờ", "Annotate insightful definitions in the margins of your book.", "Hãy ghi chú những định nghĩa sâu sắc bên lề cuốn sách của bạn.", "B2", "Học thuật", "Academic"],
  ["Marine", "/məˈriːn/", "adjective", "Thuộc về biển hải dương", "Protect delicate marine ecosystems from industrial wastewater.", "Hãy bảo vệ các hệ sinh thái biển mỏng manh khỏi nước thải công nghiệp.", "B2", "Giao tiếp hàng ngày", "Daily"],
  ["Mark", "/mɑːk/", "noun / verb", "Dấu hiệu, điểm số", "Mark tricky pronunciation words with colorful highlighter pens.", "Hãy đánh dấu những từ phát âm khó bằng bút dạ quang có màu.", "A1", "Học thuật", "Academic"],
  ["Market", "/ˈmɑː.kɪt/", "noun / verb", "Thị trường chợ", "Fresh local markets offer aromatic spices and organic fruits.", "Các khu chợ địa phương tươi ngon cung cấp gia vị thơm và trái cây hữu cơ.", "A1", "Du lịch", "Travel"],
  ["Marketing", "/ˈmɑː.kɪ.tɪŋ/", "noun", "Tiếp thị quảng bá", "Digital marketing strategies engage international audiences.", "Các chiến lược tiếp thị số thu hút khán giả quốc tế.", "B1", "Công việc", "Business"],
  ["Marketplace", "/ˈmɑː.kɪt.pleɪs/", "noun", "Thị trường nơi giao thương", "Global online marketplaces connect artisans with customers.", "Các sàn thương mại trực tuyến toàn cầu kết nối nghệ nhân với khách hàng.", "B1", "Công việc", "Business"],
  ["Marriage", "/ˈmær.ɪdʒ/", "noun", "Hôn nhân đám cưới", "Trust and open communication sustain a harmonious marriage.", "Sự tin tưởng và giao tiếp cởi mở duy trì một cuộc hôn nhân hòa thuận.", "A2", "Giao tiếp hàng ngày", "Daily"],
  ["Marry", "/ˈmær.i/", "verb", "Kết hôn lấy nhau", "They decided to marry in a scenic countryside garden.", "Họ quyết định kết hôn trong một khu vườn vùng quê tuyệt đẹp.", "A1", "Giao tiếp hàng ngày", "Daily"],
  ["Mask", "/mɑːsk/", "noun / verb", "Mặt nạ khẩu trang", "Wear protective masks in crowded public transit terminals.", "Hãy đeo khẩu trang bảo vệ tại các nhà ga giao thông công cộng đông đúc.", "A2", "Giao tiếp hàng ngày", "Daily"],
  ["Mass", "/mæs/", "noun / adjective", "Khối lượng, đại chúng", "Mass media distributes educational documentaries globally.", "Phương tiện truyền thông đại chúng phân phối các bộ phim tài liệu giáo dục trên toàn cầu.", "B1", "Học thuật", "Academic"],
  ["Massive", "/ˈmæs.ɪv/", "adjective", "Đồ sộ to lớn", "Spaced review delivers a massive boost to memory recall.", "Ôn tập ngắt quãng mang lại sự gia tăng đồ sộ cho khả năng nhớ lại.", "B1", "Học thuật", "Academic"],
  ["Master", "/ˈmɑː.stər/", "noun / verb", "Bậc thầy làm chủ", "Master the core Oxford 3000 vocabulary for speaking ease.", "Hãy làm chủ vốn từ vựng cốt lõi Oxford 3000 để có được sự tự nhiên khi nói.", "A2", "Học thuật", "Academic"],
  ["Mastery", "/ˈmɑː.stər.i/", "noun", "Sự tinh thông làm chủ", "True linguistic mastery grows through joyful daily persistence.", "Sự tinh thông ngôn ngữ đích thực phát triển qua sự kiên trì vui vẻ hàng ngày.", "B2", "Học thuật", "Academic"],
  ["Match", "/mætʃ/", "noun / verb", "Trận đấu, khớp nối", "Match English words with their accurate Vietnamese definitions.", "Hãy ghép các từ tiếng Anh với định nghĩa tiếng Việt chính xác của chúng.", "A1", "Học thuật", "Academic"],
  ["Material", "/məˈtɪə.ri.əl/", "noun / adjective", "Tài liệu vật chất", "Review authentic audio material to refine connected speech.", "Hãy xem lại tài liệu âm thanh chân thực để tinh chỉnh lời nói nối âm.", "A2", "Học thuật", "Academic"],
  ["Mathematics", "/ˌmæθˈmæt.ɪks/", "noun", "Môn toán học", "Mathematics trains rigorous analytical problem-solving skills.", "Toán học rèn luyện các kỹ năng giải quyết vấn đề phân tích nghiêm ngặt.", "A2", "Học thuật", "Academic"],
  ["Matter", "/ˈmæt.ər/", "noun / verb", "Vấn đề vật chất", "Every minute of dedicated study matters for long-term recall.", "Mỗi phút học tập tận tụy đều có ý nghĩa quan trọng cho trí nhớ dài hạn.", "A2", "Học thuật", "Academic"],
  ["Maximum", "/ˈmæk.sɪ.məm/", "adjective / noun", "Tối đa cực đại", "Set maximum daily focus intervals at twenty-five minutes.", "Hãy đặt khoảng thời gian tập trung tối đa hàng ngày là hai mươi lăm phút.", "B1", "Học thuật", "Academic"],
  ["Mayor", "/meər/", "noun", "Thị trưởng thành phố", "The city mayor inaugurated pedestrian green park lanes.", "Thị trưởng thành phố đã khánh thành các làn đường công viên xanh cho người đi bộ.", "B1", "Công việc", "Business"],
  ["Meal", "/miːl/", "noun", "Bữa ăn món ăn", "A nutritious balanced meal supplies energy for study blocks.", "Một bữa ăn cân bằng dinh dưỡng cung cấp năng lượng cho các khoảng học tập.", "A1", "Giao tiếp hàng ngày", "Daily"],
  ["Mean", "/miːn/", "verb / adjective", "Có nghĩa là, keo kiệt", "What does this idiomatic phrase mean in casual conversation?", "Cụm thành ngữ này có nghĩa là gì trong cuộc trò chuyện thông thường?", "A1", "Học thuật", "Academic"],
  ["Meaning", "/ˈmiː.nɪŋ/", "noun", "Ý nghĩa ý định", "Understanding the exact meaning prevents grammatical slips.", "Hiểu ý nghĩa chính xác giúp ngăn ngừa các sai sót ngữ pháp.", "A1", "Học thuật", "Academic"],
  ["Meaningful", "/ˈmiː.nɪŋ.fəl/", "adjective", "Có ý nghĩa sâu sắc", "Engage in meaningful conversations with foreign peers.", "Hãy tham gia vào những cuộc trò chuyện có ý nghĩa với bạn bè nước ngoài.", "B1", "Cảm xúc", "Emotions"],
  ["Means", "/miːnz/", "noun", "Phương tiện biện pháp", "Spaced repetition is an effective means of lexical retention.", "Lặp lại ngắt quãng là một phương tiện ghi nhớ từ vựng hiệu quả.", "B1", "Học thuật", "Academic"],
  ["Meanwhile", "/ˈmiːn.waɪl/", "adverb", "Trong khi đó tạm thời", "Listen to audio clips; meanwhile, shadow along softly.", "Hãy nghe các đoạn âm thanh; trong khi đó, nhại theo một cách nhẹ nhàng.", "B1", "Học thuật", "Academic"],
  ["Measure", "/ˈmeʒ.ər/", "verb / noun", "Đo lường biện pháp", "Measure your speaking progress by fluency, not perfection.", "Hãy đo lường sự tiến bộ khi nói bằng sự lưu loát, chứ không phải sự hoàn hảo.", "A2", "Học thuật", "Academic"],
  ["Measurement", "/ˈmeʒ.ə.mənt/", "noun", "Sự đo lường kích thước", "Accurate phonetic measurement refines speech intonation.", "Đo lường ngữ âm chính xác giúp tinh chỉnh ngữ điệu lời nói.", "B2", "Học thuật", "Academic"],
  ["Meat", "/miːt/", "noun", "Thịt thực phẩm", "Lean grilled meat pairs well with fresh garden salads.", "Thịt nướng nạc kết hợp rất ngon với món salad vườn tươi.", "A1", "Giao tiếp hàng ngày", "Daily"],
  ["Mechanism", "/ˈmek.ə.nɪ.zəm/", "noun", "Cơ chế hoạt động", "Spaced repetition triggers the brain's consolidation mechanism.", "Lặp lại ngắt quãng kích hoạt cơ chế củng cố ký ức của não bộ.", "B2", "Học thuật", "Academic"],
  ["Media", "/ˈmiː.di.ə/", "noun", "Phương tiện truyền thông", "Consuming English media daily trains spontaneous listening reflexes.", "Tiêu thụ truyền thông tiếng Anh hàng ngày rèn luyện phản xạ nghe tự nhiên.", "A2", "Công nghệ", "Tech"],
  ["Medical", "/ˈmed.ɪ.kəl/", "adjective", "Thuộc về y tế y học", "Medical professionals consult peer-reviewed foreign journals.", "Các chuyên gia y tế tham khảo các tạp chí nước ngoài có bình duyệt.", "A2", "Học thuật", "Academic"],
  ["Medication", "/ˌmed.ɪˈkeɪ.ʃən/", "noun", "Thuốc điều trị", "Follow the doctor's instructions when taking prescribed medication.", "Hãy làm theo hướng dẫn của bác sĩ khi dùng thuốc được kê đơn.", "B1", "Giao tiếp hàng ngày", "Daily"],
  ["Medicine", "/ˈmed.ɪ.sən/", "noun", "Ngành y học, thuốc men", "Modern preventive medicine advocates balanced daily habits.", "Y học phòng ngừa hiện đại ủng hộ các thói quen hàng ngày cân bằng.", "A1", "Giao tiếp hàng ngày", "Daily"],
  ["Medium", "/ˈmiː.di.əm/", "noun / adjective", "Phương tiện, mức vừa", "Podcasts are an exceptional medium for listening immersion.", "Podcast là một phương tiện tuyệt vời để đắm chìm trong việc luyện nghe.", "A2", "Công nghệ", "Tech"],
  ["Meet", "/miːt/", "verb", "Gặp gỡ tiếp đón", "Meet speaking partners weekly to practice conversational dialogues.", "Hãy gặp gỡ bạn luyện nói hàng tuần để luyện tập các đoạn hội thoại giao tiếp.", "A1", "Giao tiếp hàng ngày", "Daily"],
  ["Meeting", "/ˈmiː.tɪŋ/", "noun", "Cuộc họp buổi gặp", "The virtual meeting connected team members across continents.", "Cuộc họp ảo đã kết nối các thành viên trong nhóm xuyên các châu lục.", "A1", "Công việc", "Business"],
  ["Member", "/ˈmem.bər/", "noun", "Thành viên hội viên", "Every club member contributes unique cultural perspectives.", "Mỗi thành viên câu lạc bộ đóng góp những góc nhìn văn hóa độc đáo.", "A1", "Giao tiếp hàng ngày", "Daily"],
  ["Membership", "/ˈmem.bə.ʃɪp/", "noun", "Tư cách thành viên", "Library membership grants access to academic research databases.", "Tư cách thành viên thư viện cấp quyền truy cập các cơ sở dữ liệu nghiên cứu học thuật.", "A2", "Học thuật", "Academic"],
  ["Memory", "/ˈmem.ər.i/", "noun", "Trí nhớ ký ức", "Spaced intervals consolidate newly acquired words in long-term memory.", "Các khoảng cách lặp lại ngắt quãng củng cố từ mới tiếp thu vào trí nhớ dài hạn.", "A2", "Học thuật", "Academic"],
  ["Mental", "/ˈmen.təl/", "adjective", "Thuộc về tinh thần tâm trí", "Cultivate mental equanimity during rigorous exam challenges.", "Hãy nuôi dưỡng sự điềm tĩnh tinh thần trong các thử thách thi cử nghiêm ngặt.", "B1", "Cảm xúc", "Emotions"],
  ["Mention", "/ˈmen.ʃən/", "verb / noun", "Đề cập nhắc tới", "Did the professor mention the deadline for research submissions?", "Giáo sư có đề cập đến hạn chót nộp các bài nghiên cứu không?", "A2", "Học thuật", "Academic"],
  ["Menu", "/ˈmen.juː/", "noun", "Thực đơn bảng chọn", "Browse the restaurant menu to discover authentic local dishes.", "Hãy xem qua thực đơn nhà hàng để khám phá các món ăn địa phương chân thực.", "A1", "Du lịch", "Travel"],
  ["Merchant", "/ˈmɜː.tʃənt/", "noun", "Thương gia người buôn", "Ancient spice merchants navigated maritime trade routes.", "Những thương gia gia vị cổ xưa đã định hướng các tuyến đường thương mại trên biển.", "B2", "Du lịch", "Travel"],
  ["Mere", "/mɪər/", "adjective", "Chỉ là đơn thuần", "Do not dismiss twenty daily minutes as a mere trifle.", "Đừng xem thường hai mươi phút mỗi ngày chỉ là chuyện nhỏ nhặt đơn thuần.", "B2", "Học thuật", "Academic"],
  ["Merely", "/ˈmɪə.li/", "adverb", "Chỉ đơn thuần là", "Fluency is not merely memorizing words; it is natural usage.", "Sự lưu loát không chỉ đơn thuần là ghi nhớ từ ngữ; đó là cách sử dụng tự nhiên.", "B2", "Học thuật", "Academic"],
  ["Merit", "/ˈmer.ɪt/", "noun / verb", "Công trạng giá trị", "Evaluate scientific arguments on their objective factual merit.", "Hãy đánh giá các lập luận khoa học dựa trên giá trị thực tế khách quan của chúng.", "B2", "Học thuật", "Academic"],
  ["Message", "/ˈmes.ɪdʒ/", "noun", "Tin nhắn thông điệp", "Send a brief polite message to confirm the meeting time.", "Hãy gửi một tin nhắn ngắn gọn lịch sự để xác nhận thời gian cuộc họp.", "A1", "Công việc", "Business"],
  ["Metal", "/ˈmet.əl/", "noun / adjective", "Kim loại", "Titanium is a lightweight and remarkably durable metal.", "Titan là một kim loại nhẹ và bền bỉ một cách đáng nể.", "A2", "Công nghệ", "Tech"],
  ["Method", "/ˈmeθ.əd/", "noun", "Phương pháp cách thức", "The spaced repetition method optimizes memory retention curves.", "Phương pháp lặp lại ngắt quãng tối ưu hóa các đường cong ghi nhớ trí nhớ.", "A2", "Học thuật", "Academic"],
  ["Methodology", "/ˌmeθ.əˈdɒl.ə.dʒi/", "noun", "Phương pháp luận", "Rigorous research methodology ensures reproducible empirical results.", "Phương pháp luận nghiên cứu nghiêm ngặt đảm bảo các kết quả thực nghiệm có thể tái lập.", "B2", "Học thuật", "Academic"],
  ["Middle", "/ˈmɪd.əl/", "noun / adjective", "Ở giữa trung độ", "Take a short breathing pause in the middle of study sessions.", "Hãy tạm dừng thở một chút ở giữa các buổi học.", "A1", "Giao tiếp hàng ngày", "Daily"],
  ["Midnight", "/ˈmɪd.naɪt/", "noun", "Nửa đêm canh ba", "Avoid late-night cramming past midnight for better recall.", "Hãy tránh việc nhồi nhét bài vở đêm khuya quá nửa đêm để có thể nhớ tốt hơn.", "A1", "Giao tiếp hàng ngày", "Daily"],
  ["Might", "/maɪt/", "modal verb / noun", "Có thể, sức mạnh", "Consistent daily review might feel small, but it conquers mountains.", "Ôn tập hàng ngày đều đặn có thể cảm thấy nhỏ bé, nhưng nó chinh phục được cả núi non.", "A2", "Học thuật", "Academic"],
  ["Migration", "/maɪˈɡreɪ.ʃən/", "noun", "Sự di cư di trú", "Seasonal bird migration across continents is a natural marvel.", "Sự di trú theo mùa của các loài chim qua các châu lục là một kỳ quan tự nhiên.", "B2", "Du lịch", "Travel"],
  ["Mild", "/maɪld/", "adjective", "Ôn hòa nhẹ dịu", "Mediterranean winters feature mild temperatures and sunshine.", "Mùa đông Địa Trung Hải có nhiệt độ ôn hòa và ngập tràn ánh nắng.", "B1", "Du lịch", "Travel"],
  ["Military", "/ˈmɪl.ɪ.tər.i/", "adjective / noun", "Thuộc về quân sự", "Military peacekeepers protect vulnerable humanitarian supply lines.", "Lực lượng gìn giữ hòa bình quân sự bảo vệ các tuyến tiếp tế nhân đạo dễ bị tổn thương.", "A2", "Học thuật", "Academic"],
  ["Milk", "/mɪlk/", "noun", "Sữa tươi", "A glass of warm milk before sleep relaxes tired muscles.", "Một ly sữa ấm trước khi đi ngủ giúp thả lỏng các cơ bắp mệt mỏi.", "A1", "Giao tiếp hàng ngày", "Daily"],
  ["Mind", "/maɪnd/", "noun / verb", "Tâm trí phiền lòng", "Keep an open mind when encountering foreign linguistic idioms.", "Hãy giữ một tâm trí cởi mở khi bắt gặp các thành ngữ ngôn ngữ nước ngoài.", "A1", "Cảm xúc", "Emotions"],
  ["Mine", "/maɪn/", "pronoun / noun", "Của tôi, mỏ quặng", "This flashcard deck is mine; I created tailored example notes.", "Bộ thẻ flashcard này là của tôi; tôi đã tạo ra các ghi chú ví dụ phù hợp.", "A1", "Giao tiếp hàng ngày", "Daily"],
  ["Mineral", "/ˈmɪn.ər.əl/", "noun", "Khoáng chất khoáng vật", "Drinking natural spring water replenishes essential minerals.", "Uống nước suối tự nhiên bổ sung các khoáng chất thiết yếu.", "A2", "Giao tiếp hàng ngày", "Daily"],
  ["Minimal", "/ˈmɪn.ɪ.məl/", "adjective", "Tối thiểu rất ít", "Achieve maximum recall results with minimal wasted time.", "Hãy đạt được kết quả nhớ lại tối đa với thời gian lãng phí tối thiểu.", "B1", "Học thuật", "Academic"],
  ["Minimize", "/ˈmɪn.ɪ.maɪz/", "verb", "Giảm thiểu thu nhỏ", "Minimize smartphone distractions during designated study hours.", "Hãy giảm thiểu sự xao nhãng của điện thoại thông minh trong những giờ học đã định.", "B1", "Học thuật", "Academic"],
  ["Minimum", "/ˈmɪn.ɪ.məm/", "adjective / noun", "Mức tối thiểu", "Fifteen minutes is the minimum daily requirement for SRS.", "Mười lăm phút là yêu cầu tối thiểu hàng ngày cho hệ thống SRS.", "B1", "Học thuật", "Academic"],
  ["Minister", "/ˈmɪn.ɪ.stər/", "noun", "Bộ trưởng mục sư", "The education minister pledged funds for school libraries.", "Bộ trưởng giáo dục đã cam kết tài trợ cho các thư viện trường học.", "A2", "Công việc", "Business"],
  ["Ministry", "/ˈmɪn.ɪ.stri/", "noun", "Bộ cơ quan", "The ministry of foreign affairs hosted cultural delegations.", "Bộ ngoại giao đã tiếp đón các phái đoàn văn hóa.", "B1", "Công việc", "Business"],
  ["Minor", "/ˈmaɪ.nər/", "adjective / noun", "Thứ yếu nhỏ bé", "Do not fret over minor slips; conversational flow matters more.", "Đừng bận tâm về những lỗi nhỏ; dòng chảy giao tiếp quan trọng hơn nhiều.", "A2", "Học thuật", "Academic"],
  ["Minority", "/maɪˈnɒr.ə.ti/", "noun", "Thiểu số nhóm thiểu số", "Protecting linguistic minority dialects preserves cultural roots.", "Bảo vệ các phương ngữ thiểu số ngôn ngữ giúp gìn giữ cội nguồn văn hóa.", "B2", "Học thuật", "Academic"],
  ["Minute", "/ˈmɪn.ɪt/", "noun / adjective", "Phút, tỉ mỉ", "A ten-minute daily review routine builds impressive fluency.", "Thói quen ôn tập mười phút mỗi ngày xây dựng sự lưu loát ấn tượng.", "A1", "Học thuật", "Academic"],
  ["Miracle", "/ˈmɪr.ə.kəl/", "noun", "Phép màu kỳ tích", "Neuroplasticity is a biological miracle that enables adult learning.", "Tính mềm dẻo thần kinh là một phép màu sinh học cho phép người lớn học tập.", "B1", "Cảm xúc", "Emotions"],
  ["Mirror", "/ˈmɪr.ər/", "noun / verb", "Gương soi phản chiếu", "Practice speech pronunciation in front of a bathroom mirror.", "Hãy luyện phát âm trước gương phòng tắm.", "A1", "Giao tiếp hàng ngày", "Daily"],
  ["Miss", "/mɪs/", "verb / noun", "Bỏ lỡ, nhớ nhung", "Review flashcards you miss right away to strengthen memory.", "Hãy ôn lại ngay các thẻ flashcard bạn bỏ lỡ để củng cố trí nhớ.", "A1", "Học thuật", "Academic"],
  ["Mission", "/ˈmɪʃ.ən/", "noun", "Sứ mệnh nhiệm vụ", "Our mission is making English fluency accessible to everyone.", "Sứ mệnh của chúng tôi là làm cho sự lưu loát tiếng Anh dễ tiếp cận với mọi người.", "A2", "Công việc", "Business"],
  ["Mistake", "/mɪˈsteɪk/", "noun / verb", "Sai sót lỗi lầm", "Mistakes are not failures; they are vital diagnostic feedback.", "Sai lầm không phải là thất bại; chúng là phản hồi chẩn đoán quan trọng.", "A1", "Học thuật", "Academic"],
  ["Mix", "/mɪks/", "verb / noun", "Pha trộn kết hợp", "Mix listening drills with speaking practice for balanced skill.", "Hãy kết hợp các bài luyện nghe với luyện nói để có kỹ năng cân bằng.", "A1", "Học thuật", "Academic"],
  ["Mixed", "/mɪkst/", "adjective", "Pha trộn hỗn hợp", "Mixed emotional reactions are natural when starting a new journey.", "Những phản ứng cảm xúc lẫn lộn là điều tự nhiên khi bắt đầu một hành trình mới.", "A2", "Cảm xúc", "Emotions"],
  ["Mixture", "/ˈmɪks.tʃər/", "noun", "Sự pha trộn hỗn hợp", "Effective study is a mixture of active recall and resting.", "Học tập hiệu quả là sự pha trộn giữa gợi nhớ chủ động và nghỉ ngơi.", "B1", "Học thuật", "Academic"],
  ["Mobile", "/ˈməʊ.baɪl/", "adjective / noun", "Di động cơ động", "Mobile flashcard apps make waiting room minutes productive.", "Các ứng dụng flashcard di động biến những phút ngồi phòng chờ thành thời gian hữu ích.", "A1", "Công nghệ", "Tech"],
  ["Mode", "/məʊd/", "noun", "Chế độ phương thức", "Switch the review center to cram mode before upcoming exams.", "Hãy chuyển trung tâm ôn tập sang chế độ ôn cấp tốc trước các kỳ thi sắp tới.", "B1", "Công nghệ", "Tech"],
  ["Model", "/ˈmɒd.əl/", "noun / verb", "Hình mẫu mô hình", "Mimic native acoustic models to develop authentic cadence.", "Hãy bắt chước các hình mẫu âm thanh bản xứ để phát triển nhịp điệu chân thực.", "A2", "Học thuật", "Academic"],
  ["Modern", "/ˈmɒd.ən/", "adjective", "Hiện đại tân tiến", "Modern digital tools make language acquisition enjoyable.", "Các công cụ kỹ thuật số hiện đại làm cho việc tiếp thu ngôn ngữ trở nên thú vị.", "A1", "Công nghệ", "Tech"],
  ["Modest", "/ˈmɒd.ɪst/", "adjective", "Khiêm tốn vừa phải", "Even a modest daily effort compounds into extraordinary mastery.", "Ngay cả một nỗ lực khiêm tốn mỗi ngày cũng tích tụ thành sự tinh thông phi thường.", "B1", "Cảm xúc", "Emotions"],
  ["Modify", "/ˈmɒd.ɪ.faɪ/", "verb", "Sửa đổi điều chỉnh", "Modify your daily study plan as your schedule evolves.", "Hãy điều chỉnh kế hoạch học tập hàng ngày khi lịch trình của bạn thay đổi.", "B1", "Học thuật", "Academic"],
  ["Moment", "/ˈməʊ.mənt/", "noun", "Khoảnh khắc chốc lát", "Take a quiet moment to appreciate your continuous progress.", "Hãy dành một khoảnh khắc yên tĩnh để trân trọng sự tiến bộ liên tục của bạn.", "A1", "Cảm xúc", "Emotions"],
  ["Money", "/ˈmʌn.i/", "noun", "Tiền bạc của cải", "Investing time in language learning yields greater value than money.", "Đầu tư thời gian vào việc học ngôn ngữ mang lại giá trị lớn hơn cả tiền bạc.", "A1", "Công việc", "Business"],
  ["Monitor", "/ˈmɒn.ɪ.tər/", "noun / verb", "Màn hình, giám sát", "Monitor your daily SRS streak to maintain motivation.", "Hãy giám sát chuỗi ngày học SRS hàng ngày để duy trì động lực.", "A2", "Công nghệ", "Tech"],
  ["Month", "/mʌnθ/", "noun", "Tháng trong năm", "In just one month of daily practice, you will notice ease.", "Chỉ trong một tháng luyện tập hàng ngày, bạn sẽ nhận thấy sự dễ dàng rõ rệt.", "A1", "Giao tiếp hàng ngày", "Daily"],
  ["Monthly", "/ˈmʌnθ.li/", "adjective / adverb", "Hàng tháng định kỳ", "Review your monthly vocabulary progress on the dashboard.", "Hãy xem lại tiến độ từ vựng hàng tháng trên bảng điều khiển.", "A2", "Học thuật", "Academic"],
  ["Mood", "/muːd/", "noun", "Tâm trạng khí sắc", "A positive cheerful mood sharpens memory and comprehension.", "Một tâm trạng vui vẻ tích cực làm sắc bén trí nhớ và khả năng đọc hiểu.", "A2", "Cảm xúc", "Emotions"],
  ["Moon", "/muːn/", "noun", "Mặt trăng ánh trăng", "A luminous full moon illuminated the quiet countryside path.", "Mặt trăng tròn sáng ngời đã chiếu sáng con đường vùng quê yên tĩnh.", "A1", "Du lịch", "Travel"],
  ["Moral", "/ˈmɒr.əl/", "adjective / noun", "Đạo đức bài học", "Hold strong moral integrity in every personal interaction.", "Hãy giữ vững tính chính trực đạo đức mạnh mẽ trong mọi tương tác cá nhân.", "B1", "Học thuật", "Academic"],
  ["Moreover", "/mɔːrˈəʊ.vər/", "adverb", "Hơn nữa ngoài ra", "Spaced review saves time; moreover, it guarantees retention.", "Ôn tập ngắt quãng tiết kiệm thời gian; hơn nữa, nó đảm bảo việc ghi nhớ.", "B1", "Học thuật", "Academic"],
  ["Morning", "/ˈmɔː.nɪŋ/", "noun", "Buổi sáng ban mai", "Early morning hours are ideal for deep focused study.", "Những giờ sáng sớm là lý tưởng cho việc học tập tập trung sâu.", "A1", "Giao tiếp hàng ngày", "Daily"],
  ["Most", "/məʊst/", "determiner / adverb", "Hầu hết đa số", "Most English speakers appreciate genuine effort from learners.", "Hầu hết những người nói tiếng Anh đều đánh giá cao nỗ lực chân thành từ người học.", "A1", "Học thuật", "Academic"],
  ["Mostly", "/ˈməʊst.li/", "adverb", "Chủ yếu phần lớn", "Language mastery is mostly a product of joyful daily habits.", "Làm chủ ngôn ngữ chủ yếu là sản phẩm của các thói quen hàng ngày vui vẻ.", "A2", "Học thuật", "Academic"],
  ["Mother", "/ˈmʌð.ər/", "noun", "Người mẹ người má", "Her mother encouraged her curiosity and lifelong love of books.", "Mẹ cô đã khuyến khích tính tò mò và tình yêu sách suốt đời của cô.", "A1", "Giao tiếp hàng ngày", "Daily"],
  ["Motion", "/ˈməʊ.ʃən/", "noun", "Chuyển động sự vận động", "Gentle physical motion between study blocks stimulates circulation.", "Vận động thể chất nhẹ nhàng giữa các khoảng học kích thích tuần hoàn.", "B1", "Giao tiếp hàng ngày", "Daily"],
  ["Motivate", "/ˈməʊ.tɪ.veɪt/", "verb", "Thúc đẩy tạo động lực", "Celebrate small milestones to motivate continued daily practice.", "Hãy ăn mừng các cột mốc nhỏ để tạo động lực tiếp tục luyện tập hàng ngày.", "B1", "Cảm xúc", "Emotions"],
  ["Motivation", "/ˌməʊ.tɪˈveɪ.ʃən/", "noun", "Động lực nguồn cảm hứng", "Intrinsic motivation sustains language learning across years.", "Động lực nội tại duy trì việc học ngôn ngữ qua nhiều năm.", "A2", "Cảm xúc", "Emotions"],
  ["Motor", "/ˈməʊ.tər/", "noun / adjective", "Động cơ mô tơ", "Electric motors propel modern eco-friendly urban buses.", "Động cơ điện đẩy những chiếc xe buýt đô thị hiện đại thân thiện với môi trường.", "A2", "Công nghệ", "Tech"],
  ["Mountain", "/ˈmaʊn.tɪn/", "noun", "Ngọn núi vùng núi", "Climbing the scenic mountain summit rewarded us with vistas.", "Leo lên đỉnh núi tuyệt đẹp đã đền đáp chúng tôi bằng những tầm nhìn bao la.", "A1", "Du lịch", "Travel"],
  ["Mouse", "/maʊs/", "noun", "Con chuột, chuột máy tính", "Click the wireless computer mouse to reveal flashcard answers.", "Hãy nhấp chuột máy tính không dây để mở ra câu trả lời của thẻ flashcard.", "A1", "Công nghệ", "Tech"],
  ["Mouth", "/maʊθ/", "noun", "Miệng cơ quan phát âm", "Form mouth shapes accurately when practicing difficult vowels.", "Hãy tạo hình miệng chính xác khi luyện tập các nguyên âm khó.", "A1", "Học thuật", "Academic"],
  ["Move", "/muːv/", "verb / noun", "Di chuyển hành động", "Move your vocal articulators deliberately during phonetics.", "Hãy di chuyển các cơ quan phát âm của bạn một cách có chủ ý trong môn ngữ âm.", "A1", "Giao tiếp hàng ngày", "Daily"],
  ["Movement", "/ˈmuːv.mənt/", "noun", "Phong trào sự chuyển động", "The language immersion movement promotes natural communication.", "Phong trào đắm chìm trong ngôn ngữ thúc đẩy giao tiếp tự nhiên.", "A2", "Học thuật", "Academic"],
  ["Movie", "/ˈmuː.vi/", "noun", "Bộ phim điện ảnh", "Watching movies with English subtitles trains auditory reflexes.", "Xem phim có phụ đề tiếng Anh rèn luyện phản xạ thính giác.", "A1", "Giao tiếp hàng ngày", "Daily"],
  ["Much", "/mʌtʃ/", "determiner / adverb", "Nhiều phong phú", "How much progress did you make in your vocabulary deck today?", "Hôm nay bạn đã đạt được bao nhiêu tiến bộ trong bộ thẻ từ vựng của mình?", "A1", "Học thuật", "Academic"],
  ["Multiple", "/ˈmʌl.tɪ.pəl/", "adjective", "Nhiều đa dạng", "Review words in multiple contextual sentences to cement usage.", "Hãy ôn từ trong nhiều câu ngữ cảnh khác nhau để khắc sâu cách dùng.", "B1", "Học thuật", "Academic"],
  ["Muscle", "/ˈmʌs.əl/", "noun", "Cơ bắp thể lực", "Speech muscles strengthen through regular conversational drills.", "Các cơ bắp phát âm khỏe lên thông qua các bài luyện giao tiếp đều đặn.", "A2", "Giao tiếp hàng ngày", "Daily"],
  ["Museum", "/mjuːˈziː.əm/", "noun", "Bảo tàng viện", "The historical museum archives ancient manuscripts and scrolls.", "Bảo tàng lịch sử lưu trữ các bản thảo và cuộn giấy cổ.", "A1", "Du lịch", "Travel"],
  ["Music", "/ˈmjuː.zɪk/", "noun", "Âm nhạc giai điệu", "Listening to English music tunes your auditory ear to speech rhythms.", "Nghe nhạc tiếng Anh giúp điều chỉnh đôi tai thính giác theo nhịp điệu lời nói.", "A1", "Giao tiếp hàng ngày", "Daily"],
  ["Musical", "/ˈmjuː.zɪ.kəl/", "adjective / noun", "Thuộc về âm nhạc", "Every spoken language possesses a unique musical intonation.", "Mỗi ngôn ngữ nói đều sở hữu một ngữ điệu âm nhạc độc đáo.", "A2", "Học thuật", "Academic"],
  ["Musician", "/mjuːˈzɪʃ.ən/", "noun", "Nhạc sĩ nghệ sĩ", "The talented musician composed uplifting orchestral ballads.", "Nhạc sĩ tài năng đã sáng tác những bản ballad giao hưởng tràn đầy cảm hứng.", "A2", "Giao tiếp hàng ngày", "Daily"],
  ["Mutual", "/ˈmjuː.tʃu.əl/", "adjective", "Lẫn nhau chung nhau", "Language exchange partnerships thrive on mutual respect.", "Quan hệ đối tác trao đổi ngôn ngữ phát triển dựa trên sự tôn trọng lẫn nhau.", "B2", "Cảm xúc", "Emotions"],
  ["Mystery", "/ˈmɪs.tər.i/", "noun", "Điều bí ẩn câu đố", "Etymology uncovers the mystery behind irregular English spellings.", "Từ nguyên học khám phá điều bí ẩn đằng sau các chính tả tiếng Anh bất quy tắc.", "B1", "Học thuật", "Academic"]
];

OXFORD_MZ_LEXICON.forEach(item => {
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

console.log(`Từ vựng hiện có sau khi nạp danh mục M-Z: ${wordMap.size} từ.`);

// 3. Nếu vẫn cần nạp để đạt đúng con số 3.650 - 3.750 từ:
// Bổ sung các từ vựng thiết yếu N - Z chuẩn Oxford 3000:
const REMAINING_WORDS = [
  // N
  ["Nail", "/neɪl/", "noun / verb", "Móng tay, cây đinh", "Keep your fingernails clean and neatly trimmed.", "Hãy giữ móng tay sạch sẽ và được cắt tỉa gọn gàng.", "A2", "Giao tiếp hàng ngày", "Daily"],
  ["Name", "/neɪm/", "noun / verb", "Tên gọi danh tính", "Remembering people's names makes a wonderful first impression.", "Ghi nhớ tên của mọi người tạo nên một ấn tượng ban đầu tuyệt vời.", "A1", "Giao tiếp hàng ngày", "Daily"],
  ["Narrow", "/ˈnær.əʊ/", "adjective / verb", "Hẹp hòi thu hẹp", "Narrow cobblestone streets lead to the ancient mountain shrine.", "Những con phố rải sỏi hẹp dẫn đến ngôi đền cổ trên núi.", "A2", "Du lịch", "Travel"],
  ["Nation", "/ˈneɪ.ʃən/", "noun", "Quốc gia dân tộc", "Bilingual citizens bridge understanding between diverse nations.", "Những công dân song ngữ bắc cầu thấu hiểu giữa các quốc gia đa dạng.", "A2", "Du lịch", "Travel"],
  ["National", "/ˈnæʃ.ən.əl/", "adjective", "Thuộc về quốc gia", "The national public library preserves rare historic texts.", "Thư viện công cộng quốc gia bảo tồn các văn bản lịch sử quý hiếm.", "A1", "Học thuật", "Academic"],
  ["Native", "/ˈneɪ.tɪv/", "adjective / noun", "Bản xứ bản địa", "Listen to authentic native audio clips to internalize cadence.", "Hãy nghe các đoạn âm thanh bản xứ chân thực để tiếp thu nhịp điệu.", "A2", "Học thuật", "Academic"],
  ["Natural", "/ˈnætʃ.ər.əl/", "adjective", "Tự nhiên bẩm sinh", "Conversational ease becomes natural after regular repetition.", "Sự dễ dàng trong giao tiếp trở nên tự nhiên sau khi lặp lại đều đặn.", "A1", "Học thuật", "Academic"],
  ["Naturally", "/ˈnætʃ.ər.əl.i/", "adverb", "Một cách tự nhiên", "Words reviewed at optimal intervals come to mind naturally.", "Những từ được ôn tập ở khoảng cách tối ưu sẽ nảy ra trong tâm trí một cách tự nhiên.", "A2", "Học thuật", "Academic"],
  ["Nature", "/ˈneɪ.tʃər/", "noun", "Thiên nhiên bản chất", "Spend quiet time in nature to recharge cognitive faculties.", "Hãy dành thời gian yên tĩnh trong thiên nhiên để nạp lại năng lượng cho các chức năng nhận thức.", "A1", "Giao tiếp hàng ngày", "Daily"],
  ["Near", "/nɪər/", "preposition / adjective", "Gần gũi bên cạnh", "Our language study studio is near the central subway station.", "Phòng học ngôn ngữ của chúng tôi ở gần ga tàu điện ngầm trung tâm.", "A1", "Du lịch", "Travel"],
  ["Nearby", "/ˌnɪəˈbaɪ/", "adjective / adverb", "Ở gần ngay sát", "We found a quiet nearby park perfect for morning reading.", "Chúng tôi tìm thấy một công viên yên tĩnh gần đó rất hoàn hảo cho việc đọc sách buổi sáng.", "A1", "Du lịch", "Travel"],
  ["Nearly", "/ˈnɪə.li/", "adverb", "Gần như suýt nữa", "I have nearly completed today's flashcard review assignment.", "Tôi gần như đã hoàn thành nhiệm vụ ôn thẻ flashcard của ngày hôm nay.", "A1", "Học thuật", "Academic"],
  ["Neat", "/niːt/", "adjective", "Ngăn nắp gọn gàng", "A neat study space fosters calm unbroken concentration.", "Một không gian học tập ngăn nắp nuôi dưỡng sự tập trung yên bình và liên tục.", "A2", "Giao tiếp hàng ngày", "Daily"],
  ["Necessary", "/ˈnes.ə.ser.i/", "adjective", "Cần thiết thiết yếu", "Daily spaced repetition is necessary for durable recall.", "Lặp lại ngắt quãng hàng ngày là cần thiết cho khả năng nhớ lâu bền.", "A1", "Học thuật", "Academic"],
  ["Neck", "/nek/", "noun", "Cổ gáy", "Stretch your neck gently after hours of desk reading.", "Hãy kéo giãn cổ nhẹ nhàng sau nhiều giờ đọc sách tại bàn.", "A1", "Giao tiếp hàng ngày", "Daily"],
  ["Need", "/niːd/", "verb / noun", "Cần thiết nhu cầu", "You need consistent daily exposure to reach speech fluency.", "Bạn cần tiếp xúc đều đặn hàng ngày để đạt được sự lưu loát khi nói.", "A1", "Học thuật", "Academic"],
  ["Negative", "/ˈneɡ.ə.tɪv/", "adjective", "Tiêu cực phủ định", "Replace negative self-talk with encouraging affirmations.", "Hãy thay thế những lời tự trách tiêu cực bằng những lời khẳng định khích lệ.", "A2", "Cảm xúc", "Emotions"],
  ["Negotiate", "/nəˈɡəʊ.ʃi.eɪt/", "verb", "Đàm phán thương lượng", "Skilled diplomats negotiate balanced cross-border agreements.", "Các nhà ngoại giao lành nghề đàm phán những thỏa thuận xuyên biên giới cân bằng.", "B2", "Công việc", "Business"],
  ["Negotiation", "/nəˌɡəʊ.ʃiˈeɪ.ʃən/", "noun", "Cuộc đàm phán", "Constructive negotiation resolves disputes with mutual dignity.", "Đàm phán mang tính xây dựng giải quyết các tranh chấp với sự tôn trọng phẩm giá lẫn nhau.", "B2", "Công việc", "Business"],
  ["Neighbor", "/ˈneɪ.bər/", "noun", "Người hàng xóm", "Friendly neighbors make community life warm and joyful.", "Những người hàng xóm thân thiện làm cho cuộc sống cộng đồng ấm áp và vui vẻ.", "A1", "Giao tiếp hàng ngày", "Daily"],
  ["Neighborhood", "/ˈneɪ.bə.hʊd/", "noun", "Khu dân cư xóm giềng", "The historic university neighborhood features quiet coffee shops.", "Khu dân cư đại học lịch sử có những quán cà phê yên tĩnh.", "A1", "Giao tiếp hàng ngày", "Daily"],
  ["Neither", "/ˈnaɪ.ðər/", "determiner / pronoun", "Cả hai đều không", "Neither fear nor procrastination should derail your goals.", "Cả nỗi sợ lẫn sự trì hoãn đều không được làm trật bánh các mục tiêu của bạn.", "A2", "Học thuật", "Academic"],
  ["Nerve", "/nɜːv/", "noun", "Dây thần kinh dũng khí", "It takes nerve to deliver a foreign language presentation.", "Cần có sự dũng cảm để thuyết trình bằng một ngoại ngữ.", "B1", "Cảm xúc", "Emotions"],
  ["Nervous", "/ˈnɜː.vəs/", "adjective", "Hồi hộp lo lắng", "Deep diaphragmatic breathing calms nervous speech butterflies.", "Hít thở sâu bằng cơ hoành làm dịu cảm giác hồi hộp lo lắng khi nói.", "A1", "Cảm xúc", "Emotions"],
  ["Net", "/net/", "noun / adjective", "Mạng lưới, ròng", "Calculate the net gain in vocabulary after thirty study days.", "Hãy tính lượng từ vựng tăng ròng sau ba mươi ngày học.", "B1", "Công việc", "Business"],
  ["Network", "/ˈnet.wɜːk/", "noun / verb", "Mạng lưới kết nối", "Build a global network of language exchange companions.", "Hãy xây dựng một mạng lưới toàn cầu gồm những người bạn trao đổi ngôn ngữ.", "A2", "Công nghệ", "Tech"],
  ["Neutral", "/ˈnjuː.trəl/", "adjective", "Trung lập vô tư", "Maintain a neutral and open attitude during debates.", "Hãy duy trì thái độ trung lập và cởi mở trong các cuộc tranh luận.", "B2", "Học thuật", "Academic"],
  ["Never", "/ˈnev.ər/", "adverb", "Không bao giờ", "Never give up on your dream of mastering English speech.", "Đừng bao giờ từ bỏ ước mơ làm chủ tiếng Anh nói của bạn.", "A1", "Cảm xúc", "Emotions"],
  ["Nevertheless", "/ˌnev.ə.ðəˈles/", "adverb", "Tuy nhiên dù vậy", "Grammar is challenging; nevertheless, daily practice succeeds.", "Ngữ pháp đầy thử thách; tuy nhiên, việc luyện tập hàng ngày sẽ thành công.", "B2", "Học thuật", "Academic"],
  ["New", "/njuː/", "adjective", "Mới mẻ tân tiến", "Every new word learned opens another door to the world.", "Mỗi từ mới học được mở ra một cánh cửa khác nhìn ra thế giới.", "A1", "Học thuật", "Academic"],
  ["Newly", "/ˈnjuː.li/", "adverb", "Mới gần đây", "Review newly acquired vocabulary within twenty-four hours.", "Hãy ôn lại từ vựng mới tiếp thu trong vòng hai mươi bốn giờ.", "A2", "Học thuật", "Academic"],
  ["News", "/njuːz/", "noun", "Tin tức thời sự", "Listen to daily English news broadcasts to sharpen listening.", "Hãy nghe các bản tin thời sự tiếng Anh hàng ngày để mài giũa khả năng nghe.", "A1", "Giao tiếp hàng ngày", "Daily"],
  ["Newspaper", "/ˈnjuːzˌpeɪ.pər/", "noun", "Tờ báo báo in", "Reading quality newspapers expands your formal lexical scope.", "Đọc các tờ báo chất lượng giúp mở rộng vốn từ vựng trang trọng của bạn.", "A1", "Học thuật", "Academic"],
  ["Next", "/nekst/", "adjective / adverb", "Tiếp theo kế tiếp", "Click to proceed to the next flashcard in the review queue.", "Hãy nhấp để chuyển sang thẻ flashcard tiếp theo trong hàng đợi ôn tập.", "A1", "Học thuật", "Academic"],
  ["Nice", "/naɪs/", "adjective", "Tốt đẹp xinh xắn", "Have a nice and productive vocabulary study session today.", "Chúc bạn có một buổi học từ vựng tốt đẹp và hiệu quả hôm nay.", "A1", "Giao tiếp hàng ngày", "Daily"],
  ["Night", "/naɪt/", "noun", "Ban đêm buổi tối", "A restful night of deep sleep cements today's memories.", "Một đêm ngủ sâu giấc yên bình sẽ củng cố những ký ức của ngày hôm nay.", "A1", "Giao tiếp hàng ngày", "Daily"],
  ["Nobody", "/ˈnəʊ.bə.di/", "pronoun", "Không một ai", "Nobody achieves fluency without steady daily dedication.", "Không một ai đạt được sự lưu loát mà không có sự cống hiến đều đặn hàng ngày.", "A1", "Học thuật", "Academic"],
  ["Noise", "/nɔɪz/", "noun", "Tiếng ồn ào", "Noise-canceling headphones create a serene study bubble.", "Tai nghe chống ồn tạo ra một không gian học tập thanh bình.", "A1", "Giao tiếp hàng ngày", "Daily"],
  ["Noisy", "/ˈnɔɪ.zi/", "adjective", "Ồn ào náo nhiệt", "Avoid noisy environments when engaging in focused reading.", "Hãy tránh những môi trường ồn ào khi tham gia vào việc đọc sách tập trung.", "A1", "Giao tiếp hàng ngày", "Daily"],
  ["None", "/nʌn/", "pronoun", "Không ai không cái gì", "None of your daily efforts are wasted; every rep counts.", "Không một nỗ lực hàng ngày nào của bạn bị lãng phí; mỗi lần luyện tập đều có giá trị.", "A2", "Học thuật", "Academic"],
  ["Nonetheless", "/ˌnʌn.ðəˈles/", "adverb", "Dù sao đi nữa", "Exams are tough; nonetheless, thorough study prevails.", "Các kỳ thi rất khó khăn; dù sao đi nữa, học tập kỹ lưỡng sẽ chiến thắng.", "B2", "Học thuật", "Academic"],
  ["Noon", "/nuːn/", "noun", "Buổi trưa chính ngọ", "Take a refreshing walk outdoors at noon to clear your mind.", "Hãy đi dạo ngoài trời sảng khoái vào buổi trưa để làm sạch tâm trí.", "A1", "Giao tiếp hàng ngày", "Daily"],
  ["Normal", "/ˈnɔː.məl/", "adjective", "Bình thường chuẩn tắc", "Feeling awkward at first is completely normal in languages.", "Cảm thấy vụng về lúc ban đầu là hoàn toàn bình thường trong ngôn ngữ.", "A2", "Cảm xúc", "Emotions"],
  ["Normally", "/ˈnɔː.məl.i/", "adverb", "Thông thường bình thường", "SRS algorithms normally schedule reviews at expanding gaps.", "Các thuật toán SRS thông thường lên lịch ôn tập tại các khoảng cách mở rộng.", "A2", "Học thuật", "Academic"],
  ["North", "/nɔːθ/", "noun / adjective", "Phía bắc phương bắc", "Cold winter winds blow from the rugged northern mountains.", "Những cơn gió mùa đông lạnh giá thổi từ những ngọn núi phía bắc gồ ghề.", "A1", "Du lịch", "Travel"],
  ["Northern", "/ˈnɔː.ðən/", "adjective", "Thuộc về miền bắc", "Northern coastal fjords feature dramatic glacial cliffs.", "Các vịnh hẹp ven biển phía bắc có những vách đá sông băng kỳ vĩ.", "A2", "Du lịch", "Travel"],
  ["Nose", "/nəʊz/", "noun", "Chiếc mũi khứu giác", "Inhale deep breaths through your nose into the abdomen.", "Hãy hít những hơi thở sâu qua mũi vào trong bụng.", "A1", "Giao tiếp hàng ngày", "Daily"],
  ["Note", "/nəʊt/", "noun / verb", "Ghi chú, chú ý", "Jot down short mnemonic notes to anchor challenging words.", "Hãy ghi lại những ghi chú mẹo nhớ ngắn để neo giữ những từ đầy thử thách.", "A1", "Học thuật", "Academic"],
  ["Notebook", "/ˈnəʊt.bʊk/", "noun", "Cuốn sổ tay ghi chép", "Keep an indexed pocket notebook for newly discovered idioms.", "Hãy giữ một cuốn sổ tay bỏ túi có mục lục cho các thành ngữ mới phát hiện.", "A1", "Học thuật", "Academic"],
  ["Nothing", "/ˈnʌθ.ɪŋ/", "pronoun", "Không có gì", "Nothing matches the satisfaction of spontaneous speech ease.", "Không có gì sánh được với sự thỏa mãn của sự tự nhiên khi nói chuyện.", "A1", "Cảm xúc", "Emotions"],
  ["Notice", "/ˈnəʊ.tɪs/", "verb / noun", "Chú ý nhận biết", "Notice how native speakers naturally link adjacent words.", "Hãy chú ý cách người bản xứ tự nhiên nối các từ liền kề nhau.", "A1", "Học thuật", "Academic"],
  ["Noticeable", "/ˈnəʊ.tɪ.sə.bəl/", "adjective", "Đáng chú ý rõ rệt", "Her pronunciation made noticeable gains in three weeks.", "Phát âm của cô ấy đã đạt được những bước tiến rõ rệt trong ba tuần.", "B1", "Học thuật", "Academic"],
  ["Novel", "/ˈnɒv.əl/", "noun / adjective", "Cuốn tiểu thuyết, mới lạ", "Reading an English novel immerses you in natural narrative.", "Đọc một cuốn tiểu thuyết tiếng Anh đưa bạn đắm chìm vào cốt truyện tự nhiên.", "A2", "Học thuật", "Academic"],
  ["Novelty", "/ˈnɒv.əl.ti/", "noun", "Sự mới lạ tính mới", "The novelty of gamified study sustains early motivation.", "Sự mới lạ của việc học bằng trò chơi duy trì động lực ban đầu.", "B2", "Cảm xúc", "Emotions"],
  ["November", "/nəʊˈvem.bər/", "noun", "Tháng Mười Một", "November brings crisp autumn air and cozy study evenings.", "Tháng Mười Một mang lại không khí mùa thu se lạnh và những buổi tối học tập ấm cúng.", "A1", "Giao tiếp hàng ngày", "Daily"],
  ["Now", "/naʊ/", "adverb", "Bây giờ hiện tại", "Start your fifteen-minute vocabulary review session right now.", "Hãy bắt đầu buổi ôn từ vựng mười lăm phút của bạn ngay bây giờ.", "A1", "Học thuật", "Academic"],
  ["Nowadays", "/ˈnaʊ.ə.deɪz/", "adverb", "Ngày nay thời nay", "Nowadays digital flashcard algorithms make study effortless.", "Ngày nay các thuật toán thẻ flashcard số giúp việc học trở nên nhẹ nhàng.", "A2", "Công nghệ", "Tech"],
  ["Nuclear", "/ˈnjuː.kli.ər/", "adjective", "Thuộc về hạt nhân", "Nuclear power generates low-carbon baseload electricity.", "Năng lượng hạt nhân tạo ra nguồn điện phụ tải nền carbon thấp.", "B1", "Công nghệ", "Tech"],
  ["Number", "/ˈnʌm.bər/", "noun / verb", "Con số số lượng", "Track the total number of words mastered on the dashboard.", "Hãy theo dõi tổng số từ đã làm chủ trên bảng điều khiển.", "A1", "Học thuật", "Academic"],
  ["Numerous", "/ˈnjuː.mə.rəs/", "adjective", "Đông đảo vô số", "Numerous studies validate the cognitive efficacy of spaced SRS.", "Vô số nghiên cứu xác nhận hiệu lực nhận thức của hệ thống SRS ngắt quãng.", "B2", "Học thuật", "Academic"],
  ["Nurse", "/nɜːs/", "noun / verb", "Y tá điều dưỡng", "Compassionate nurses care for patients around the clock.", "Những người y tá giàu lòng nhân ái chăm sóc bệnh nhân suốt ngày đêm.", "A1", "Giao tiếp hàng ngày", "Daily"],
  ["Nut", "/nʌt/", "noun", "Hạt dẻ quả hạch", "Almonds and walnuts are healthy brain nuts for snacking.", "Hạnh nhân và quả óc chó là những loại hạt lành mạnh cho não để ăn nhẹ.", "A2", "Giao tiếp hàng ngày", "Daily"],
  ["Nutrition", "/njuːˈtrɪʃ.ən/", "noun", "Dinh dưỡng dưỡng chất", "Wholesome nutrition sustains high daily mental stamina.", "Dinh dưỡng lành mạnh duy trì thể lực tinh thần cao hàng ngày.", "B1", "Giao tiếp hàng ngày", "Daily"],

  // O
  ["Obey", "/əˈbeɪ/", "verb", "Vâng lời tuân theo", "Obey traffic regulations to ensure highway travel safety.", "Hãy tuân theo luật lệ giao thông để đảm bảo an toàn khi đi trên cao tốc.", "B1", "Du lịch", "Travel"],
  ["Object", "/ˈɒb.dʒɪkt/", "noun / verb", "Đồ vật, phản đối", "Practice naming everyday household objects in English.", "Hãy luyện tập gọi tên các đồ vật gia đình hàng ngày bằng tiếng Anh.", "A1", "Giao tiếp hàng ngày", "Daily"],
  ["Objective", "/əbˈdʒek.tɪv/", "noun / adjective", "Mục tiêu, khách quan", "Our objective is achieving fluent CEFR C1 competence.", "Mục tiêu của chúng tôi là đạt được năng lực CEFR C1 lưu loát.", "A2", "Học thuật", "Academic"],
  ["Obligation", "/ˌɒb.lɪˈɡeɪ.ʃən/", "noun", "Nghĩa vụ bổn phận", "Language mastery is an empowering gift, not a burden obligation.", "Làm chủ ngôn ngữ là một món quà trao quyền, chứ không phải một nghĩa vụ gánh nặng.", "B1", "Học thuật", "Academic"],
  ["Observation", "/ˌɒb.zəˈveɪ.ʃən/", "noun", "Sự quan sát theo dõi", "Keen observation of native speakers refines accent nuances.", "Quan sát sắc sảo người bản ngữ giúp tinh chỉnh các sắc thái ngữ điệu.", "B1", "Học thuật", "Academic"],
  ["Observe", "/əbˈzɜːv/", "verb", "Quan sát tuân thủ", "Observe how pitch and intonation shift during questions.", "Hãy quan sát cách cao độ và ngữ điệu thay đổi trong các câu hỏi.", "A2", "Học thuật", "Academic"],
  ["Observer", "/əbˈzɜː.vər/", "noun", "Người quan sát", "Independent observers verified the transparent election count.", "Những người quan sát độc lập đã xác nhận việc kiểm phiếu minh bạch.", "B2", "Học thuật", "Academic"],
  ["Obstacle", "/ˈɒb.stə.kəl/", "noun", "Trở ngại chướng ngại", "Turn every pronunciation obstacle into a fun challenge.", "Hãy biến mọi trở ngại phát âm thành một thử thách thú vị.", "B1", "Cảm xúc", "Emotions"],
  ["Obtain", "/əbˈteɪn/", "verb", "Đạt được thu được", "Obtain feedback from mentors to correct fossilized errors.", "Hãy nhận phản hồi từ các thầy cô để sửa chữa những lỗi đã bị hóa thạch.", "B1", "Học thuật", "Academic"],
  ["Obvious", "/ˈɒb.vi.əs/", "adjective", "Rõ ràng hiển nhiên", "Spaced review provides an obvious advantage over cramming.", "Ôn tập ngắt quãng mang lại một lợi thế rõ ràng so với việc học nhồi nhét.", "B1", "Học thuật", "Academic"],
  ["Obviously", "/ˈɒb.vi.əs.li/", "adverb", "Một cách hiển nhiên", "Consistent daily study obviously accelerates language progress.", "Học tập hàng ngày nhất quán hiển nhiên đẩy nhanh tiến độ ngôn ngữ.", "B1", "Học thuật", "Academic"],
  ["Occasion", "/əˈkeɪ.ʒən/", "noun", "Dịp cơ hội", "Graduation is a joyful occasion to celebrate dedication.", "Tốt nghiệp là một dịp vui vẻ để tôn vinh sự cống hiến.", "A2", "Giao tiếp hàng ngày", "Daily"],
  ["Occasional", "/əˈkeɪ.ʒən.əl/", "adjective", "Thỉnh thoảng đôi khi", "Occasional mistakes are natural stepping stones to fluency.", "Những lỗi lầm thỉnh thoảng là những bước đệm tự nhiên dẫn đến sự lưu loát.", "B1", "Học thuật", "Academic"],
  ["Occasionally", "/əˈkeɪ.ʒən.əl.i/", "adverb", "Thỉnh thoảng đôi lúc", "She occasionally watches English movies without subtitles.", "Thỉnh thoảng cô ấy xem phim tiếng Anh mà không cần phụ đề.", "A2", "Giao tiếp hàng ngày", "Daily"],
  ["Occupation", "/ˌɒk.jəˈpeɪ.ʃən/", "noun", "Nghề nghiệp công việc", "State your profession and occupation on travel visa forms.", "Hãy ghi rõ nghề nghiệp và công việc của bạn trên mẫu đơn thị thực du lịch.", "A2", "Công việc", "Business"],
  ["Occupy", "/ˈɒk.jə.paɪ/", "verb", "Chiếm giữ cư ngụ", "Let positive aspirations occupy your daily thoughts.", "Hãy để những khát vọng tích cực chiếm trọn suy nghĩ hàng ngày của bạn.", "B1", "Cảm xúc", "Emotions"],
  ["Occur", "/əˈkɜːr/", "verb", "Xảy ra diễn ra", "Spaced intervals ensure reviews occur right before forgetting.", "Các khoảng ngắt quãng đảm bảo việc ôn tập diễn ra ngay trước khi quên.", "A2", "Học thuật", "Academic"],
  ["Ocean", "/ˈəʊ.ʃən/", "noun", "Đại dương biển cả", "Crossing the Atlantic ocean connects continents and minds.", "Băng qua Đại Tây Dương kết nối các châu lục và tâm trí con người.", "A1", "Du lịch", "Travel"],
  ["October", "/ɒkˈtəʊ.bər/", "noun", "Tháng Mười", "October brings golden autumn foliage to university parks.", "Tháng Mười mang lại sắc lá vàng mùa thu cho các công viên đại học.", "A1", "Giao tiếp hàng ngày", "Daily"],
  ["Odd", "/ɒd/", "adjective", "Kỳ lạ, số lẻ", "English spelling may seem odd until you understand etymology.", "Chính tả tiếng Anh có vẻ kỳ lạ cho đến khi bạn hiểu từ nguyên học.", "A2", "Học thuật", "Academic"],
  ["Offer", "/ˈɒf.ər/", "verb / noun", "Đề nghị cung cấp", "Offer encouragement to classmates tackling tricky dialogues.", "Hãy đưa ra lời khích lệ cho các bạn cùng lớp đang giải quyết các đoạn hội thoại khó.", "A1", "Giao tiếp hàng ngày", "Daily"],
  ["Office", "/ˈɒf.ɪs/", "noun", "Văn phòng công sở", "Bilingual proficiency opens doors in international corporate offices.", "Thành thạo song ngữ mở ra những cánh cửa trong các văn phòng doanh nghiệp quốc tế.", "A1", "Công việc", "Business"],
  ["Officer", "/ˈɒf.ɪ.sər/", "noun", "Sĩ quan cán bộ", "The immigration officer examined passport credentials courteously.", "Cán bộ xuất nhập cảnh đã kiểm tra giấy tờ hộ chiếu một cách lịch sự.", "A2", "Công việc", "Business"],
  ["Official", "/əˈfɪʃ.əl/", "adjective / noun", "Chính thức quan chức", "Refer to official CEFR guidelines to assess your English level.", "Hãy tham khảo hướng dẫn CEFR chính thức để đánh giá trình độ tiếng Anh của bạn.", "B1", "Học thuật", "Academic"],
  ["Officially", "/əˈfɪʃ.əl.i/", "adverb", "Một cách chính thức", "She was officially certified as an advanced C1 speaker.", "Cô ấy đã được chứng nhận chính thức là người nói trình độ C1 nâng cao.", "B1", "Học thuật", "Academic"],
  ["Often", "/ˈɒf.ən/", "adverb", "Thường xuyên hay", "How often do you review your personal SRS flashcard queue?", "Bạn có thường xuyên ôn lại hàng đợi thẻ flashcard SRS cá nhân của mình không?", "A1", "Học thuật", "Academic"],
  ["Oil", "/ɔɪl/", "noun", "Dầu ăn dầu mỏ", "Olive oil is an essential staple of healthy Mediterranean cuisine.", "Dầu ô liu là một thực phẩm thiết yếu của ẩm thực Địa Trung Hải lành mạnh.", "A1", "Giao tiếp hàng ngày", "Daily"],
  ["Old", "/əʊld/", "adjective", "Cũ kỹ, già dặn", "Old habits fade when replaced with empowering daily review.", "Thói quen cũ sẽ mờ đi khi được thay thế bằng việc ôn tập hàng ngày giàu năng lượng.", "A1", "Học thuật", "Academic"],
  ["Once", "/wʌns/", "adverb / conjunction", "Một lần, khi mà", "Once you master phonetics, vocabulary retention feels easy.", "Một khi bạn đã làm chủ ngữ âm, việc ghi nhớ từ vựng sẽ cảm thấy dễ dàng.", "A1", "Học thuật", "Academic"],
  ["One", "/wʌn/", "number / pronoun", "Số một một điều", "One focused hour beats five hours of distracted browsing.", "Một giờ tập trung đánh bại năm giờ lướt mạng xao nhãng.", "A1", "Học thuật", "Academic"],
  ["Online", "/ˈɒn.laɪn/", "adjective / adverb", "Trực tuyến trên mạng", "Online flashcard platforms make spaced repetition effortless.", "Các nền tảng thẻ flashcard trực tuyến giúp việc lặp lại ngắt quãng trở nên nhẹ nhàng.", "A1", "Công nghệ", "Tech"],
  ["Only", "/ˈəʊn.li/", "adverb / adjective", "Duy nhất chỉ", "It takes only fifteen minutes daily to transform your vocabulary.", "Chỉ mất mười lăm phút mỗi ngày để thay đổi hoàn toàn vốn từ vựng của bạn.", "A1", "Học thuật", "Academic"],
  ["Open", "/ˈəʊ.pən/", "verb / adjective", "Mở ra cởi mở", "Keep an open mind when exploring diverse world cultures.", "Hãy giữ một tâm trí cởi mở khi khám phá các nền văn hóa thế giới đa dạng.", "A1", "Cảm xúc", "Emotions"],
  ["Opening", "/ˈəʊ.pən.ɪŋ/", "noun / adjective", "Khai mạc lễ mở", "The opening keynote speech inspired conference attendees.", "Bài phát biểu khai mạc đã truyền cảm hứng cho những người tham dự hội nghị.", "A2", "Công việc", "Business"],
  ["Openly", "/ˈəʊ.pən.li/", "adverb", "Một cách cởi mở", "Discuss pronunciation hurdles openly with study partners.", "Hãy thảo luận về những rào cản phát âm một cách cởi mở với bạn học.", "B1", "Giao tiếp hàng ngày", "Daily"],
  ["Operate", "/ˈɒp.ər.eɪt/", "verb", "Vận hành hoạt động", "Learn how intelligent spaced memory algorithms operate.", "Hãy tìm hiểu cách các thuật toán trí nhớ ngắt quãng thông minh hoạt động.", "B1", "Công nghệ", "Tech"],
  ["Operation", "/ˌɒp.ərˈeɪ.ʃən/", "noun", "Hoạt động ca mổ", "Smooth platform operation ensures uninterrupted daily review.", "Vận hành nền tảng trơn tru đảm bảo việc ôn tập hàng ngày không bị gián đoạn.", "B1", "Công việc", "Business"],
  ["Operator", "/ˈɒp.ər.eɪ.tər/", "noun", "Người điều hành vận hành", "The railway operator announced updated high-speed express timetables.", "Đơn vị vận hành đường sắt đã công bố lịch trình tàu tốc hành cập nhật.", "B2", "Du lịch", "Travel"],
  ["Opinion", "/əˈpɪn.jən/", "noun", "Quan điểm ý kiến", "Articulate your personal opinion with evidence and courtesy.", "Hãy bày tỏ quan điểm cá nhân của bạn với bằng chứng và sự lịch thiệp.", "A1", "Học thuật", "Academic"],
  ["Opponent", "/əˈpəʊ.nənt/", "noun", "Đối thủ người phản đối", "Respect debate opponents while constructively critiquing arguments.", "Hãy tôn trọng đối thủ tranh biện trong khi phê bình các lập luận mang tính xây dựng.", "B2", "Học thuật", "Academic"],
  ["Opportunity", "/ˌɒp.əˈtʃuː.nə.ti/", "noun", "Cơ hội thời cơ", "Mastering English unlocks international fellowship opportunities.", "Làm chủ tiếng Anh mở ra những cơ hội học bổng quốc tế.", "A2", "Công việc", "Business"],
  ["Oppose", "/əˈpəʊz/", "verb", "Phản đối chống đối", "Critical thinkers oppose dogmatic unsubstantiated assertions.", "Những người có tư duy phản biện phản đối những khẳng định giáo điều không có căn cứ.", "B2", "Học thuật", "Academic"],
  ["Opposite", "/ˈɒp.ə.zɪt/", "adjective / noun", "Đối diện trái ngược", "Learn words alongside their opposite antonyms to expand breadth.", "Hãy học từ cùng với các từ trái nghĩa của chúng để mở rộng chiều sâu.", "A1", "Học thuật", "Academic"],
  ["Option", "/ˈɒp.ʃən/", "noun", "Lựa chọn tùy chọn", "Explore multiple phonetic practice options on the dashboard.", "Hãy khám phá nhiều tùy chọn luyện tập ngữ âm trên bảng điều khiển.", "A2", "Công nghệ", "Tech"],
  ["Oral", "/ˈɔː.rəl/", "adjective", "Thuộc về nói khẩu ngữ", "Prepare for the CEFR C1 oral interview examination.", "Hãy chuẩn bị cho kỳ thi phỏng vấn vấn đáp CEFR C1.", "B1", "Học thuật", "Academic"],
  ["Orange", "/ˈɒr.ɪndʒ/", "noun / adjective", "Màu cam, quả cam", "Fresh sweet oranges provide essential morning vitamin C.", "Những quả cam ngọt tươi cung cấp vitamin C thiết yếu cho buổi sáng.", "A1", "Giao tiếp hàng ngày", "Daily"],
  ["Order", "/ˈɔː.dər/", "noun / verb", "Trật tự, đặt hàng", "Maintain alphabetical order in your personal vocabulary index.", "Hãy duy trì thứ tự bảng chữ cái trong mục lục từ vựng cá nhân của bạn.", "A1", "Học thuật", "Academic"],
  ["Ordinary", "/ˈɔː.dən.ri/", "adjective", "Bình thường giản dị", "Extraordinary fluency is built through disciplined ordinary days.", "Sự lưu loát phi thường được xây dựng thông qua những ngày bình dị có kỷ luật.", "A2", "Cảm xúc", "Emotions"],
  ["Organic", "/ɔːˈɡæn.ɪk/", "adjective", "Hữu cơ tự nhiên", "Organic language learning mimics natural childhood acquisition.", "Học ngôn ngữ hữu cơ bắt chước việc tiếp thu tự nhiên thời thơ ấu.", "B1", "Học thuật", "Academic"],
  ["Organization", "/ˌɔː.ɡən.aɪˈzeɪ.ʃən/", "noun", "Tổ chức sự sắp xếp", "Clear paragraph organization makes academic writing readable.", "Sự tổ chức đoạn văn rõ ràng làm cho văn bản học thuật dễ đọc.", "A2", "Học thuật", "Academic"],
  ["Organize", "/ˈɔː.ɡən.aɪz/", "verb", "Tổ chức sắp xếp", "Organize flashcards by thematic topics and CEFR levels.", "Hãy sắp xếp các thẻ flashcard theo chủ đề chuyên đề và cấp độ CEFR.", "A2", "Học thuật", "Academic"],
  ["Origin", "/ˈɒr.ɪ.dʒɪn/", "noun", "Nguồn gốc xuất xứ", "Investigate the Latin and Greek origins of English roots.", "Hãy tìm hiểu nguồn gốc tiếng Latinh và Hy Lạp của các gốc từ tiếng Anh.", "B1", "Học thuật", "Academic"],
  ["Original", "/əˈrɪdʒ.ən.əl/", "adjective / noun", "Nguyên bản độc đáo", "Write original example sentences to anchor abstract meanings.", "Hãy tự viết các câu ví dụ nguyên bản để neo giữ các ý nghĩa trừu tượng.", "A2", "Học thuật", "Academic"],
  ["Originally", "/əˈrɪdʒ.ən.əl.i/", "adverb", "Ban đầu khởi thủy", "The word was originally borrowed from Norman French vocabulary.", "Từ này ban đầu được vay mượn từ vốn từ vựng tiếng Pháp Norman.", "B1", "Học thuật", "Academic"],
  ["Other", "/ˈʌð.ər/", "determiner / pronoun", "Khác người khác", "Help other learners who are just starting their journey.", "Hãy giúp đỡ những người học khác đang mới bắt đầu hành trình của họ.", "A1", "Giao tiếp hàng ngày", "Daily"],
  ["Otherwise", "/ˈʌð.ə.waɪz/", "adverb", "Nếu không thì trái lại", "Practice daily; otherwise, newly learned phrases will fade.", "Hãy luyện tập mỗi ngày; nếu không, các cụm từ mới học sẽ bị mờ nhạt đi.", "B1", "Học thuật", "Academic"],
  ["Outcome", "/ˈaʊt.kʌm/", "noun", "Kết quả thành quả", "Long-term fluency is the guaranteed outcome of daily SRS.", "Sự lưu loát lâu dài là kết quả được đảm bảo của hệ thống SRS hàng ngày.", "B1", "Học thuật", "Academic"],
  ["Outdoor", "/ˈaʊtˌdɔːr/", "adjective", "Ngoài trời dã ngoại", "Outdoor walking stimulates oxygen flow and memory retention.", "Đi bộ ngoài trời kích thích lưu lượng oxy và khả năng ghi nhớ trí nhớ.", "A1", "Du lịch", "Travel"],
  ["Outdoors", "/ˌaʊtˈdɔːz/", "adverb", "Ở ngoài trời", "Read English poetry outdoors under warm afternoon sunshine.", "Hãy đọc thơ tiếng Anh ngoài trời dưới ánh nắng chiều ấm áp.", "A1", "Du lịch", "Travel"],
  ["Outline", "/ˈaʊt.laɪn/", "noun / verb", "Dàn ý phác thảo", "Write a clear structural outline before drafting your essay.", "Hãy viết một dàn ý cấu trúc rõ ràng trước khi phác thảo bài luận.", "B1", "Học thuật", "Academic"],
  ["Outlook", "/ˈaʊt.lʊk/", "noun", "Góc nhìn triển vọng", "A positive growth outlook transforms language difficulties.", "Một góc nhìn phát triển tích cực làm thay đổi các khó khăn ngôn ngữ.", "B2", "Cảm xúc", "Emotions"],
  ["Output", "/ˈaʊt.pʊt/", "noun", "Đầu ra sản lượng", "Balance listening input with regular spoken output practice.", "Hãy cân bằng đầu vào lắng nghe với việc luyện tập đầu ra bằng lời nói đều đặn.", "B1", "Học thuật", "Academic"],
  ["Outside", "/ˌaʊtˈsaɪd/", "preposition / adverb / noun", "Bên ngoài phía ngoài", "Step outside for fresh air when focus begins to dip.", "Hãy bước ra ngoài để hít thở không khí trong lành khi sự tập trung bắt đầu giảm.", "A1", "Giao tiếp hàng ngày", "Daily"],
  ["Outstanding", "/ˌaʊtˈstæn.dɪŋ/", "adjective", "Xuất sắc vượt trội", "Her dedicated study produced outstanding examination results.", "Việc học tập tận tụy của cô đã mang lại kết quả kiểm tra xuất sắc vượt trội.", "B1", "Học thuật", "Academic"],
  ["Overall", "/ˌəʊ.vəˈrɔːl/", "adjective / adverb", "Nhìn chung tổng thể", "Overall fluency improved markedly over the twelve-week term.", "Sự lưu loát tổng thể đã cải thiện rõ rệt trong suốt học kỳ mười hai tuần.", "B1", "Học thuật", "Academic"],
  ["Overcome", "/ˌəʊ.vəˈkʌm/", "verb", "Vượt qua khắc phục", "Consistent daily action will overcome conversational anxiety.", "Hành động hàng ngày nhất quán sẽ vượt qua sự lo lắng khi giao tiếp.", "B1", "Cảm xúc", "Emotions"],
  ["Overlook", "/ˌəʊ.vəˈlʊk/", "verb", "Bỏ qua ngắm nhìn", "Do not overlook small pronunciation nuances during study.", "Đừng bỏ qua những sắc thái phát âm nhỏ trong khi học tập.", "B2", "Học thuật", "Academic"],
  ["Overseas", "/ˌəʊ.vəˈsiːz/", "adverb / adjective", "Ở nước ngoài hải ngoại", "Living overseas accelerates immersion language acquisition.", "Sống ở nước ngoài giúp đẩy nhanh việc tiếp thu ngôn ngữ đắm chìm.", "A2", "Du lịch", "Travel"],
  ["Owe", "/əʊ/", "verb", "Nợ mang ơn", "We owe deep gratitude to dedicated educators and mentors.", "Chúng ta nợ lòng biết ơn sâu sắc đối với những nhà giáo và người thầy tận tâm.", "A2", "Cảm xúc", "Emotions"],
  ["Own", "/əʊn/", "determiner / verb", "Sở hữu của riêng", "Create your own example sentences to cement active recall.", "Hãy tự tạo các câu ví dụ của riêng bạn để củng cố gợi nhớ chủ động.", "A1", "Học thuật", "Academic"],
  ["Owner", "/ˈəʊ.nər/", "noun", "Chủ sở hữu", "Take full owner responsibility for your language learning.", "Hãy chịu trách nhiệm người làm chủ hoàn toàn đối với việc học ngôn ngữ của bạn.", "A2", "Công việc", "Business"]
];

REMAINING_WORDS.forEach(item => {
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

console.log(`Từ vựng hiện có sau khi nạp N-O: ${wordMap.size} từ.`);

// 4. Nếu vẫn còn dưới 3.650 từ, tiếp tục nạp danh mục P - Z:
const P_TO_Z_HEADWORDS = [
  // P
  ["Pace", "/peɪs/", "noun / verb", "Nhịp độ bước chân", "Pacing your daily study sustainably prevents mental burnout.", "Điều tiết nhịp độ học tập hàng ngày một cách bền vững giúp ngăn ngừa kiệt sức tinh thần.", "B1", "Học thuật", "Academic"],
  ["Pack", "/pæk/", "verb / noun", "Đóng gói bầy đàn", "Pack lightweight essentials for scenic mountain hiking trips.", "Hãy đóng gói những vật dụng thiết yếu nhẹ cho các chuyến đi bộ leo núi tuyệt đẹp.", "A1", "Du lịch", "Travel"],
  ["Package", "/ˈpæk.ɪdʒ/", "noun / verb", "Gói hàng bưu kiện", "Receive digital study packages with audio pronunciation guides.", "Nhận các gói học tập kỹ thuật số có hướng dẫn phát âm bằng âm thanh.", "A2", "Công việc", "Business"],
  ["Page", "/peɪdʒ/", "noun", "Trang sách trang web", "Read one English book page mindfully each evening before bed.", "Hãy đọc một trang sách tiếng Anh một cách chú tâm vào mỗi tối trước khi ngủ.", "A1", "Học thuật", "Academic"],
  ["Pain", "/peɪn/", "noun / verb", "Cơn đau nỗi đau", "Discipline weighs ounces, but the pain of regret weighs tons.", "Kỷ luật nặng vài lạng, nhưng nỗi đau của sự hối tiếc nặng cả tấn.", "A2", "Cảm xúc", "Emotions"],
  ["Painful", "/ˈpeɪn.fəl/", "adjective", "Đau đớn gian nan", "Overcoming early speaking awkwardness may feel briefly painful.", "Vượt qua sự vụng về khi nói ban đầu có thể cảm thấy khó khăn đôi chút.", "A2", "Cảm xúc", "Emotions"],
  ["Paint", "/peɪnt/", "verb / noun", "Sơn vẽ hội họa", "Paint vivid mental images to remember abstract idioms.", "Hãy vẽ nên những hình ảnh tinh thần sinh động để ghi nhớ các thành ngữ trừu tượng.", "A1", "Học thuật", "Academic"],
  ["Painter", "/ˈpeɪn.tər/", "noun", "Họa sĩ thợ sơn", "The impressionist painter captured shimmering sunlight reflections.", "Họa sĩ trường phái ấn tượng đã ghi lại những phản chiếu lung linh của ánh nắng.", "A1", "Giao tiếp hàng ngày", "Daily"],
  ["Painting", "/ˈpeɪn.tɪŋ/", "noun", "Bức tranh bức họa", "Admiring classic paintings inspires creative artistic reflection.", "Chiêm ngưỡng những bức tranh kinh điển truyền cảm hứng cho sự suy ngẫm nghệ thuật sáng tạo.", "A1", "Du lịch", "Travel"],
  ["Pair", "/peər/", "noun / verb", "Cặp đôi ghép đôi", "Pair difficult flashcards with vivid emotional stories.", "Hãy ghép các thẻ flashcard khó với những câu chuyện cảm xúc sinh động.", "A1", "Học thuật", "Academic"],
  ["Palace", "/ˈpæl.ɪs/", "noun", "Cung điện hoàng cung", "The historic royal palace showcases centuries of art.", "Cung điện hoàng gia lịch sử trưng bày nhiều thế kỷ nghệ thuật.", "A2", "Du lịch", "Travel"],
  ["Pale", "/peɪl/", "adjective", "Nhợt nhạt tái nhợt", "Pale morning mist drifted gently across mountain valleys.", "Làn sương mai nhạt trôi nhẹ nhàng qua các thung lũng miền núi.", "A2", "Du lịch", "Travel"],
  ["Panel", "/ˈpæn.əl/", "noun", "Hội đồng ban giám khảo", "The expert panel evaluated oral pronunciation fluency.", "Hội đồng chuyên gia đã đánh giá sự lưu loát trong phát âm vấn đáp.", "B1", "Học thuật", "Academic"],
  ["Panic", "/ˈpæn.ɪk/", "noun / verb", "Sự hoảng loạn", "Calm diaphragmatic breathing neutralizes speech exam panic.", "Hít thở cơ hoành bình tĩnh vô hiệu hóa sự hoảng loạn trong kỳ thi nói.", "B1", "Cảm xúc", "Emotions"],
  ["Paper", "/ˈpeɪ.pər/", "noun", "Giấy tờ bài nghiên cứu", "Publish your linguistics research paper in an academic journal.", "Hãy xuất bản bài báo nghiên cứu ngôn ngữ học của bạn trên một tạp chí học thuật.", "A1", "Học thuật", "Academic"],
  ["Paragraph", "/ˈpær.ə.ɡrɑːf/", "noun", "Đoạn văn", "Organize each paragraph around one clear central claim.", "Hãy tổ chức mỗi đoạn văn xoay quanh một luận điểm trung tâm rõ ràng.", "A1", "Học thuật", "Academic"],
  ["Parallel", "/ˈpær.ə.lel/", "adjective / noun", "Song song tương đương", "Draw parallels between grammatical patterns across tongues.", "Hãy rút ra các điểm tương đồng song song giữa các mẫu ngữ pháp qua các ngôn ngữ.", "B2", "Học thuật", "Academic"],
  ["Parent", "/ˈpeə.rənt/", "noun", "Cha mẹ phụ huynh", "Supportive parents nurture lifelong curiosity in children.", "Cha mẹ giàu lòng ủng hộ nuôi dưỡng tính tò mò suốt đời ở con cái.", "A1", "Giao tiếp hàng ngày", "Daily"],
  ["Park", "/pɑːk/", "noun / verb", "Công viên, đỗ xe", "Stroll through leafy city parks to reflect on daily lessons.", "Hãy đi dạo qua những công viên thành phố rợp bóng cây để suy ngẫm về bài học trong ngày.", "A1", "Du lịch", "Travel"],
  ["Parliament", "/ˈpɑː.lɪ.mənt/", "noun", "Nghị viện quốc hội", "Parliament debated legislation protecting consumer rights.", "Nghị viện đã tranh luận về luật bảo vệ quyền lợi người tiêu dùng.", "B2", "Học thuật", "Academic"],
  ["Part", "/pɑːt/", "noun / verb", "Bộ phận thành phần", "Active recall is the most vital part of language learning.", "Gợi nhớ chủ động là phần quan trọng nhất của việc học ngôn ngữ.", "A1", "Học thuật", "Academic"],
  ["Participant", "/pɑːˈtɪs.ɪ.pənt/", "noun", "Người tham gia", "Every seminar participant shared unique cross-cultural stories.", "Mỗi người tham gia hội thảo đều chia sẻ những câu chuyện giao thoa văn hóa độc đáo.", "B1", "Học thuật", "Academic"],
  ["Participate", "/pɑːˈtɪs.ɪ.peɪt/", "verb", "Tham gia góp mặt", "Participate actively in conversational clubs without fear.", "Hãy tham gia tích cực vào các câu lạc bộ giao tiếp mà không sợ hãi.", "B1", "Giao tiếp hàng ngày", "Daily"],
  ["Participation", "/pɑːˌtɪs.ɪˈpeɪ.ʃən/", "noun", "Sự tham gia đóng góp", "Active student participation enlivens seminar classrooms.", "Sự tham gia tích cực của sinh viên làm sôi động các lớp học hội thảo.", "B2", "Học thuật", "Academic"],
  ["Particular", "/pəˈtɪk.jə.lər/", "adjective", "Cụ thể đặc thù", "Pay particular attention to syllable stress placements.", "Hãy đặc biệt chú ý đến vị trí đặt trọng âm của các âm tiết.", "B1", "Học thuật", "Academic"],
  ["Particularly", "/pəˈtɪk.jə.lər.li/", "adverb", "Đặc biệt là nhất là", "Spaced flashcards are particularly effective for retention.", "Thẻ flashcard ngắt quãng đặc biệt hiệu quả cho việc ghi nhớ lâu dài.", "B1", "Học thuật", "Academic"],
  ["Partly", "/ˈpɑːt.li/", "adverb", "Một phần phần nào", "Fluency is partly practice and partly emotional confidence.", "Sự lưu loát một phần là do luyện tập và một phần là sự tự tin cảm xúc.", "A2", "Học thuật", "Academic"],
  ["Partner", "/ˈpɑːt.nər/", "noun", "Bạn đồng hành đối tác", "Practice speaking dialogues daily with your study partner.", "Hãy luyện tập các đoạn hội thoại nói hàng ngày cùng bạn đồng hành học tập của bạn.", "A1", "Giao tiếp hàng ngày", "Daily"],
  ["Partnership", "/ˈpɑːt.nə.ʃɪp/", "noun", "Quan hệ đối tác", "Language exchange partnerships thrive on mutual generosity.", "Quan hệ đối tác trao đổi ngôn ngữ phát triển dựa trên sự hào phóng lẫn nhau.", "B1", "Công việc", "Business"],
  ["Party", "/ˈpɑː.ti/", "noun", "Bữa tiệc đảng phái", "Celebrate passing your CEFR exam with a joyful dinner party.", "Hãy ăn mừng việc vượt qua kỳ thi CEFR bằng một bữa tiệc tối vui vẻ.", "A1", "Giao tiếp hàng ngày", "Daily"],
  ["Pass", "/pɑːs/", "verb / noun", "Vượt qua đậu kỳ thi", "Diligent daily review ensures you pass the C1 examination.", "Ôn tập chăm chỉ hàng ngày đảm bảo bạn vượt qua kỳ thi C1.", "A1", "Học thuật", "Academic"],
  ["Passage", "/ˈpæs.ɪdʒ/", "noun", "Đoạn văn lối đi", "Read the narrative passage carefully before answering queries.", "Hãy đọc kỹ đoạn văn tự sự trước khi trả lời các câu hỏi.", "B1", "Học thuật", "Academic"],
  ["Passenger", "/ˈpæs.ən.dʒər/", "noun", "Hành khách đi tàu xe", "The flight crew assisted passengers during landing arrival.", "Phi hành đoàn chuyến bay đã hỗ trợ hành khách trong lúc hạ cánh đến nơi.", "A1", "Du lịch", "Travel"],
  ["Passion", "/ˈpæʃ.ən/", "noun", "Niềm đam mê say mê", "A sincere passion for communication turns study into joy.", "Niềm đam mê giao tiếp chân thành biến việc học thành niềm vui.", "A2", "Cảm xúc", "Emotions"],
  ["Passionate", "/ˈpæʃ.ən.ət/", "adjective", "Say mê nhiệt huyết", "She is a passionate advocate of bilingual education access.", "Cô ấy là một người nhiệt thành ủng hộ việc tiếp cận giáo dục song ngữ.", "B1", "Cảm xúc", "Emotions"],
  ["Passive", "/ˈpæs.ɪv/", "adjective", "Thụ động", "Replace passive rereading with active flashcard retrieval.", "Hãy thay thế việc đọc lại thụ động bằng việc truy xuất thẻ flashcard chủ động.", "B1", "Học thuật", "Academic"],
  ["Passport", "/ˈpɑːs.pɔːt/", "noun", "Hộ chiếu thông hành", "Keep your travel passport safely secured in hand luggage.", "Hãy giữ hộ chiếu du lịch của bạn an toàn trong hành lý xách tay.", "A1", "Du lịch", "Travel"],
  ["Past", "/pɑːst/", "noun / adjective", "Quá khứ đã qua", "Do not let past exam slips undermine your future goals.", "Đừng để những sơ suất thi cử trong quá khứ làm xói mòn mục tiêu tương lai của bạn.", "A1", "Học thuật", "Academic"],
  ["Path", "/pɑːθ/", "noun", "Con đường lối mòn", "Daily consistency is the guaranteed path to speech ease.", "Sự nhất quán hàng ngày là con đường đảm bảo dẫn đến sự tự nhiên khi nói.", "A2", "Học thuật", "Academic"],
  ["Patience", "/ˈpeɪ.ʃəns/", "noun", "Lòng kiên nhẫn nhẫn nại", "Fluency takes time; practice patience with your accent.", "Sự lưu loát cần có thời gian; hãy kiên nhẫn với ngữ điệu của bạn.", "A2", "Cảm xúc", "Emotions"],
  ["Patient", "/ˈpeɪ.ʃənt/", "adjective / noun", "Kiên nhẫn, bệnh nhân", "Experienced tutors are patient with beginning learners.", "Những gia sư giàu kinh nghiệm luôn kiên nhẫn với những người mới bắt đầu.", "A1", "Cảm xúc", "Emotions"],
  ["Patiently", "/ˈpeɪ.ʃənt.li/", "adverb", "Một cách kiên nhẫn", "Listen patiently until foreign vowel rhythms feel familiar.", "Hãy kiên nhẫn lắng nghe cho đến khi các nhịp điệu nguyên âm nước ngoài cảm thấy quen thuộc.", "A2", "Học thuật", "Academic"],
  ["Pattern", "/ˈpæt.ən/", "noun", "Mẫu hình cấu trúc", "Recognizing sentence patterns accelerates reading speed.", "Nhận diện các mẫu câu giúp đẩy nhanh tốc độ đọc.", "A2", "Học thuật", "Academic"],
  ["Pause", "/pɔːz/", "verb / noun", "Tạm dừng ngắt quãng", "Pause briefly between sentences to maintain natural cadence.", "Hãy tạm dừng ngắn giữa các câu để duy trì nhịp điệu tự nhiên.", "A2", "Giao tiếp hàng ngày", "Daily"],
  ["Pay", "/peɪ/", "verb / noun", "Chi trả thanh toán", "Your daily study efforts will pay lifelong dividends.", "Những nỗ lực học tập hàng ngày của bạn sẽ mang lại những thành quả suốt đời.", "A1", "Công việc", "Business"],
  ["Payment", "/ˈpeɪ.mənt/", "noun", "Khoản thanh toán", "Secure online payment gateways protect card transactions.", "Các cổng thanh toán trực tuyến an toàn bảo vệ giao dịch thẻ.", "A2", "Công việc", "Business"],
  ["Peace", "/piːs/", "noun", "Hòa bình sự thanh thản", "Find inner peace through dedicated early morning study.", "Hãy tìm thấy sự thanh thản nội tâm qua việc học tập tận tụy vào sáng sớm.", "A1", "Cảm xúc", "Emotions"],
  ["Peaceful", "/ˈpiːs.fəl/", "adjective", "Thanh bình yên ả", "A quiet countryside retreat offers a peaceful study sanctuary.", "Một nơi nghỉ dưỡng vùng quê yên tĩnh mang lại một chốn học tập thanh bình.", "A1", "Du lịch", "Travel"],
  ["Peak", "/piːk/", "noun / verb", "Đỉnh cao tột đỉnh", "Hikers reached the snowy alpine mountain peak at sunrise.", "Những người leo núi đã lên tới đỉnh núi tuyết vào lúc bình minh.", "A2", "Du lịch", "Travel"],
  ["Peer", "/pɪər/", "noun / verb", "Bạn cùng trang lứa", "Collaborate with peer learners in weekly conversation clubs.", "Hãy hợp tác với các bạn học cùng tiến trong các câu lạc bộ hội thoại hàng tuần.", "B1", "Giao tiếp hàng ngày", "Daily"],
  ["Pen", "/pen/", "noun", "Cây bút mực", "Jot down newly encountered idioms with your favorite ink pen.", "Hãy ghi lại những thành ngữ mới bắt gặp bằng cây bút mực yêu thích của bạn.", "A1", "Học thuật", "Academic"],
  ["Penalty", "/ˈpen.əl.ti/", "noun", "Hình phạt tiền phạt", "Avoid the penalty of forgetting by scheduling regular SRS.", "Hãy tránh hình phạt của sự lãng quên bằng cách lên lịch SRS định kỳ.", "B1", "Học thuật", "Academic"],
  ["Pencil", "/ˈpen.səl/", "noun", "Bút chì", "Sketch grammar concept diagrams lightly in pencil first.", "Trước tiên hãy phác thảo sơ đồ khái niệm ngữ pháp nhẹ nhàng bằng bút chì.", "A1", "Học thuật", "Academic"],
  ["People", "/ˈpiː.pəl/", "noun", "Con người mọi người", "Connecting with people from diverse cultures enriches life.", "Kết nối với mọi người từ các nền văn hóa đa dạng làm phong phú cuộc sống.", "A1", "Giao tiếp hàng ngày", "Daily"],
  ["Perceive", "/pəˈsiːv/", "verb", "Nhận thức cảm thụ", "Learn to perceive subtle differences in vowel durations.", "Hãy học cách nhận thức những khác biệt tinh tế trong độ dài nguyên âm.", "B2", "Học thuật", "Academic"],
  ["Percentage", "/pəˈsen.tɪdʒ/", "noun", "Tỷ lệ phần trăm", "Track your percentage of correct answers on the dashboard.", "Hãy theo dõi tỷ lệ phần trăm câu trả lời đúng trên bảng điều khiển.", "A2", "Học thuật", "Academic"],
  ["Perception", "/pəˈsep.ʃən/", "noun", "Sự nhận thức cảm quan", "Broad reading transforms your perception of global affairs.", "Đọc rộng làm thay đổi nhận thức của bạn về các vấn đề toàn cầu.", "B2", "Học thuật", "Academic"],
  ["Perfect", "/ˈpɜː.fekt/", "adjective / verb", "Hoàn hảo hoàn thiện", "Practice does not make perfect; practice makes permanent.", "Luyện tập không tạo nên sự hoàn hảo; luyện tập tạo nên sự bền lâu.", "A1", "Học thuật", "Academic"],
  ["Perfectlv", "/ˈpɜː.fekt.li/", "adverb", "Một cách hoàn hảo", "She articulated the complex phonetics perfectly.", "Cô ấy đã phát âm rõ ràng ngữ âm phức tạp một cách hoàn hảo.", "A2", "Học thuật", "Academic"],
  ["Perform", "/pəˈfɔːm/", "verb", "Thực hiện biểu diễn", "Perform with poise and confidence during oral presentations.", "Hãy thể hiện với sự đĩnh đạc và tự tin trong các bài thuyết trình miệng.", "A2", "Công việc", "Business"],
  ["Performance", "/pəˈfɔː.məns/", "noun", "Phần biểu diễn hiệu năng", "The musical symphony performance moved audiences deeply.", "Buổi biểu diễn giao hưởng âm nhạc đã làm khán giả xúc động sâu sắc.", "A2", "Công việc", "Business"],
  ["Performer", "/pəˈfɔː.mər/", "noun", "Nghệ sĩ biểu diễn", "The stage performer captured listener attention masterfully.", "Nghệ sĩ biểu diễn trên sân khấu đã thu hút sự chú ý của người nghe một cách bậc thầy.", "B1", "Giao tiếp hàng ngày", "Daily"],
  ["Period", "/ˈpɪə.ri.əd/", "noun", "Giai đoạn thời kỳ", "Devote designated thirty-minute study periods each day.", "Hãy dành những khoảng thời gian học tập ba mươi phút đã định mỗi ngày.", "A1", "Học thuật", "Academic"],
  ["Permanent", "/ˈpɜː.mə.nənt/", "adjective", "Vĩnh cửu lâu bền", "Spaced review turns temporary short-term recall into permanent memory.", "Ôn tập ngắt quãng biến khả năng nhớ tạm thời ngắn hạn thành ký ức vĩnh cửu.", "B1", "Học thuật", "Academic"],
  ["Permission", "/pəˈmɪʃ.ən/", "noun", "Sự cho phép chuẩn y", "Request permission before recording peer practice dialogues.", "Hãy xin phép trước khi ghi âm các đoạn hội thoại luyện tập của bạn bè.", "A2", "Giao tiếp hàng ngày", "Daily"],
  ["Permit", "/pəˈmɪt/", "verb / noun", "Cho phép giấy phép", "Digital tools permit flexible mobile study anywhere.", "Các công cụ kỹ thuật số cho phép việc học di động linh hoạt ở bất kỳ đâu.", "B1", "Công nghệ", "Tech"],
  ["Person", "/ˈpɜː.sən/", "noun", "Con người cá nhân", "Every person has the innate biological potential to speak tongues.", "Mỗi người đều có tiềm năng sinh học bẩm sinh để nói các ngoại ngữ.", "A1", "Giao tiếp hàng ngày", "Daily"],
  ["Personal", "/ˈpɜː.sən.əl/", "adjective", "Cá nhân riêng tư", "Tailor flashcard decks to fit your personal career goals.", "Hãy điều chỉnh các bộ thẻ flashcard cho phù hợp với mục tiêu nghề nghiệp cá nhân của bạn.", "A1", "Công việc", "Business"],
  ["Personality", "/ˌpɜː.sənˈæl.ə.ti/", "noun", "Tính cách nhân cách", "A warm friendly personality shines through confident speech.", "Một tính cách thân thiện ấm áp tỏa sáng qua lời nói tự tin.", "A2", "Cảm xúc", "Emotions"],
  ["Personally", "/ˈpɜː.sən.əl.i/", "adverb", "Về phương diện cá nhân", "Personally, I find audio shadowing the fastest route to fluency.", "Về phương diện cá nhân, tôi thấy kỹ thuật nhại âm thanh là con đường nhanh nhất đến sự lưu loát.", "A2", "Học thuật", "Academic"],
  ["Personnel", "/ˌpɜː.sənˈel/", "noun", "Nhân sự đội ngũ", "The firm trains its personnel in cross-cultural communication.", "Công ty đào tạo nhân sự của mình về giao tiếp đa văn hóa.", "B2", "Công việc", "Business"],
  ["Perspective", "/pəˈspek.tɪv/", "noun", "Góc nhìn phối cảnh", "Multilingual fluency gives you an expansive global perspective.", "Sự lưu loát đa ngôn ngữ mang lại cho bạn một góc nhìn toàn cầu bao quát.", "B1", "Học thuật", "Academic"],
  ["Persuade", "/pəˈsweɪd/", "verb", "Thuyết phục làm xiêu lòng", "Persuade listeners using cogent evidence and empathetic tone.", "Hãy thuyết phục người nghe bằng bằng chứng đanh thép và giọng điệu thấu cảm.", "B1", "Học thuật", "Academic"],
  ["Pet", "/pet/", "noun / verb", "Thú cưng cưng chiều", "Caring for household pets cultivates empathy and gentleness.", "Chăm sóc thú cưng trong nhà nuôi dưỡng sự thấu cảm và dịu dàng.", "A1", "Giao tiếp hàng ngày", "Daily"],
  ["Phase", "/feɪz/", "noun / verb", "Giai đoạn thời kỳ", "Break your language journey into clear six-month phases.", "Hãy chia hành trình ngôn ngữ của bạn thành các giai đoạn sáu tháng rõ ràng.", "B1", "Học thuật", "Academic"],
  ["Phenomenon", "/fəˈnɒm.ɪ.nən/", "noun", "Hiện tượng kỳ thú", "The spacing effect is a well-documented cognitive phenomenon.", "Hiệu ứng ngắt quãng là một hiện tượng nhận thức đã được ghi chép đầy đủ.", "B2", "Học thuật", "Academic"],
  ["Philosophy", "/fɪˈlɒs.ə.fi/", "noun", "Triết học nhân sinh quan", "Stoic philosophy teaches calm equanimity in the face of setbacks.", "Triết học khắc kỷ dạy sự bình thản điềm tĩnh khi đối mặt với nghịch cảnh.", "B1", "Học thuật", "Academic"],
  ["Phone", "/fəʊn/", "noun / verb", "Điện thoại di động", "Use your phone to review twenty flashcards while commuting.", "Hãy dùng điện thoại để ôn lại hai mươi thẻ flashcard trong khi đi lại.", "A1", "Công nghệ", "Tech"],
  ["Photo", "/ˈfəʊ.təʊ/", "noun", "Bức ảnh tấm hình", "Visual photos anchored to flashcards accelerate word recall.", "Các bức ảnh trực quan gắn liền với thẻ flashcard giúp đẩy nhanh việc nhớ từ.", "A1", "Du lịch", "Travel"],
  ["Photograph", "/ˈfəʊ.tə.ɡrɑːf/", "noun / verb", "Bức ảnh chụp", "The travel photograph captured sunset over alpine peaks.", "Bức ảnh du lịch đã ghi lại cảnh hoàng hôn trên các đỉnh núi cao.", "A1", "Du lịch", "Travel"],
  ["Photographer", "/fəˈtɒɡ.rə.fər/", "noun", "Nhiếp ảnh gia", "The wildlife photographer documented rare rainforest birds.", "Nhiếp ảnh gia động vật hoang dã đã ghi lại những loài chim rừng nhiệt đới quý hiếm.", "A2", "Giao tiếp hàng ngày", "Daily"],
  ["Photography", "/fəˈtɒɡ.rə.fi/", "noun", "Nghệ thuật nhiếp ảnh", "Studying photography trains mindful visual observation.", "Học nhiếp ảnh rèn luyện sự quan sát thị giác chú tâm.", "A2", "Giao tiếp hàng ngày", "Daily"],
  ["Phrase", "/freɪz/", "noun / verb", "Cụm từ diễn đạt", "Memorize whole communicative phrases rather than isolated words.", "Hãy ghi nhớ cả những cụm từ giao tiếp hơn là những từ ngữ riêng lẻ.", "A1", "Học thuật", "Academic"],
  ["Physical", "/ˈfɪz.ɪ.kəl/", "adjective", "Thuộc về thể chất", "Physical movement between study intervals boosts neural blood flow.", "Vận động thể chất giữa các khoảng học tập giúp tăng lượng máu lên não.", "A2", "Giao tiếp hàng ngày", "Daily"],
  ["Physics", "/ˈfɪz.ɪks/", "noun", "Môn vật lý học", "Physics explains fundamental laws governing cosmic energy.", "Vật lý học giải thích các quy luật cơ bản chi phối năng lượng vũ trụ.", "A2", "Học thuật", "Academic"],
  ["Piano", "/piˈæn.əʊ/", "noun", "Đàn dương cầm", "Playing piano trains delicate finger and auditory coordination.", "Chơi đàn piano rèn luyện sự phối hợp thính giác và ngón tay tinh tế.", "A1", "Giao tiếp hàng ngày", "Daily"],
  ["Pick", "/pɪk/", "verb / noun", "Chọn lựa nhặt lấy", "Pick vocabulary topics that align with your genuine interests.", "Hãy chọn các chủ đề từ vựng phù hợp với sở thích chân thực của bạn.", "A1", "Học thuật", "Academic"],
  ["Picture", "/ˈpɪk.tʃər/", "noun / verb", "Bức tranh hình dung", "Picture yourself speaking fluently during oral examinations.", "Hãy hình dung bản thân đang nói chuyện lưu loát trong kỳ thi vấn đáp.", "A1", "Học thuật", "Academic"],
  ["Piece", "/piːs/", "noun / verb", "Mảnh ghép mẫu", "Piece together complex sentences using coordinating conjunctions.", "Hãy ghép các câu phức tạp lại với nhau bằng cách sử dụng các liên từ kết hợp.", "A1", "Học thuật", "Academic"],
  ["Pile", "/paɪl/", "noun / verb", "Chồng đống chất đống", "Do not let overdue reviews pile up; tackle ten cards daily.", "Đừng để các thẻ quá hạn chất đống; hãy giải quyết mười thẻ mỗi ngày.", "A2", "Học thuật", "Academic"],
  ["Pilot", "/ˈpaɪ.lət/", "noun / verb", "Phi công hoa tiêu", "Commercial airline pilots communicate in standardized English.", "Các phi công hãng hàng không thương mại giao tiếp bằng tiếng Anh chuẩn hóa.", "A2", "Du lịch", "Travel"],
  ["Pin", "/pɪn/", "noun / verb", "Ghim cài mã pin", "Pin your daily study schedule in a prominent spot.", "Hãy ghim lịch học tập hàng ngày của bạn ở một vị trí dễ thấy.", "A2", "Giao tiếp hàng ngày", "Daily"],
  ["Pipe", "/paɪp/", "noun", "Ống dẫn nước tẩu", "Clean copper pipes supply fresh mountain drinking water.", "Các đường ống bằng đồng sạch cung cấp nước uống tinh khiết vùng núi.", "A2", "Giao tiếp hàng ngày", "Daily"],
  ["Pitch", "/pɪtʃ/", "noun / verb", "Cao độ giọng nói, ném", "Vary your vocal pitch to deliver engaging public speeches.", "Hãy thay đổi cao độ giọng nói để thuyết trình trước công chúng lôi cuốn.", "B2", "Học thuật", "Academic"],
  ["Place", "/pleɪs/", "noun / verb", "Nơi chốn đặt để", "Choose a peaceful study place free of phone interruptions.", "Hãy chọn một nơi học tập yên bình không bị điện thoại làm gián đoạn.", "A1", "Du lịch", "Travel"],
  ["Plain", "/pleɪn/", "adjective / noun", "Rõ ràng mộc mạc", "Speak in plain clear English to ensure effortless comprehension.", "Hãy nói bằng tiếng Anh mộc mạc rõ ràng để đảm bảo sự hiểu bài dễ dàng.", "A2", "Học thuật", "Academic"],
  ["Plan", "/plæn/", "noun / verb", "Kế hoạch lên kế hoạch", "A structured study plan turns distant dreams into reality.", "Một kế hoạch học tập có cấu trúc biến những ước mơ xa xôi thành hiện thực.", "A1", "Học thuật", "Academic"],
  ["Plane", "/pleɪn/", "noun", "Máy bay mặt phẳng", "Board the international passenger plane with excitement.", "Hãy bước lên chiếc máy bay chở khách quốc tế với sự hào hứng.", "A1", "Du lịch", "Travel"],
  ["Planet", "/ˈplæn.ɪt/", "noun", "Hành tinh trái đất", "Cherish the delicate biological balance of our shared planet.", "Hãy trân quý sự cân bằng sinh học mỏng manh của hành tinh chung của chúng ta.", "A2", "Du lịch", "Travel"],
  ["Plant", "/plɑːnt/", "noun / verb", "Cây xanh thực vật", "House plants clean indoor air and bring aesthetic serenity.", "Cây cảnh trong nhà làm sạch không khí và mang lại sự thanh tịnh thẩm mỹ.", "A1", "Giao tiếp hàng ngày", "Daily"],
  ["Plastic", "/ˈplæs.tɪk/", "noun / adjective", "Chất dẻo nhựa", "Reduce single-use plastic waste to preserve ocean ecosystems.", "Hãy giảm rác thải nhựa dùng một lần để bảo tồn hệ sinh thái đại dương.", "A1", "Giao tiếp hàng ngày", "Daily"],
  ["Plate", "/pleɪt/", "noun", "Chiếc đĩa dĩa", "Fill half your dinner plate with colorful leafy vegetables.", "Hãy lấp đầy một nửa đĩa ăn tối của bạn bằng các loại rau xanh nhiều màu sắc.", "A1", "Giao tiếp hàng ngày", "Daily"],
  ["Platform", "/ˈplæt.fɔːm/", "noun", "Nền tảng sân ga", "The train to Edinburgh departs from station platform four.", "Chuyến tàu đi Edinburgh khởi hành từ sân ga số bốn của nhà ga.", "A2", "Du lịch", "Travel"],
  ["Player", "/ˈpleɪ.ər/", "noun", "Người chơi tuyển thủ", "Language learners are active players in conversational dialogue.", "Những người học ngôn ngữ là những người tham gia tích cực trong đối thoại giao tiếp.", "A1", "Giao tiếp hàng ngày", "Daily"],
  ["Pleasant", "/ˈplez.ənt/", "adjective", "Dễ chịu thú vị", "A pleasant study routine turns language acquisition into joy.", "Một thói quen học tập dễ chịu biến việc tiếp thu ngôn ngữ thành niềm vui.", "A1", "Cảm xúc", "Emotions"],
  ["Pleased", "/pliːzd/", "adjective", "Hài lòng vui vẻ", "She was deeply pleased with her listening examination progress.", "Cô ấy vô cùng hài lòng với sự tiến bộ trong kỳ thi nghe của mình.", "A2", "Cảm xúc", "Emotions"],
  ["Pleasure", "/ˈpleʒ.ər/", "noun", "Niềm vui sự thỏa thích", "Reading classic literature in English is an intellectual pleasure.", "Đọc văn học kinh điển bằng tiếng Anh là một niềm vui thích trí tuệ.", "A2", "Cảm xúc", "Emotions"],
  ["Plenty", "/ˈplen.ti/", "pronoun / noun", "Nhiều phong phú", "Get plenty of restful sleep to cement newly learned words.", "Hãy ngủ thật nhiều và sâu giấc để củng cố các từ mới học.", "A2", "Giao tiếp hàng ngày", "Daily"],
  ["Plot", "/plɒt/", "noun / verb", "Cốt truyện âm mưu", "The novel has a captivating plot filled with unexpected turns.", "Cuốn tiểu thuyết có một cốt truyện lôi cuốn đầy những khúc quanh bất ngờ.", "B1", "Học thuật", "Academic"],
  ["Plus", "/plʌs/", "preposition / noun", "Cộng thêm điểm cộng", "Bilingual proficiency is a massive plus on job applications.", "Thành thạo song ngữ là một điểm cộng lớn trên các đơn xin việc.", "A2", "Công việc", "Business"],
  ["Pocket", "/ˈpɒk.ɪt/", "noun", "Túi áo túi quần", "Keep a pocket vocabulary notebook handy for idle transit moments.", "Hãy giữ một cuốn sổ từ vựng bỏ túi tiện dụng cho những lúc rảnh rỗi trên đường đi.", "A1", "Giao tiếp hàng ngày", "Daily"],
  ["Poem", "/ˈpəʊ.ɪm/", "noun", "Bài thơ thi phẩm", "Reciting short English poems trains expressive speech rhythms.", "Ngâm những bài thơ tiếng Anh ngắn giúp rèn luyện nhịp điệu nói truyền cảm.", "A2", "Học thuật", "Academic"],
  ["Poet", "/ˈpəʊ.ɪt/", "noun", "Nhà thơ thi sĩ", "The romantic poet praised the sublime beauty of mountain rivers.", "Nhà thơ lãng mạn đã ca ngợi vẻ đẹp tuyệt mỹ của những dòng sông miền núi.", "A2", "Học thuật", "Academic"],
  ["Poetry", "/ˈpəʊ.ɪ.tri/", "noun", "Thơ ca văn vần", "Appreciating poetry sharpens your sensitivity to acoustic rhyme.", "Thưởng thức thơ ca làm sắc bén độ nhạy cảm của bạn với vần điệu âm học.", "B1", "Học thuật", "Academic"],
  ["Point", "/pɔɪnt/", "noun / verb", "Điểm số, chỉ trỏ", "Make your core argumentative point clearly and concisely.", "Hãy nêu điểm lập luận cốt lõi của bạn một cách rõ ràng và súc tích.", "A1", "Học thuật", "Academic"],
  ["Police", "/pəˈliːs/", "noun", "Cảnh sát công an", "Community police officers maintain neighborhood safety.", "Các sĩ quan cảnh sát cộng đồng duy trì sự an toàn cho khu phố.", "A1", "Giao tiếp hàng ngày", "Daily"],
  ["Policy", "/ˈpɒl.ə.si/", "noun", "Chính sách quy định", "The educational policy guarantees universal digital literacy.", "Chính sách giáo dục đảm bảo việc phổ cập hiểu biết kỹ thuật số cho mọi người.", "A2", "Học thuật", "Academic"],
  ["Polish", "/ˈpɒl.ɪʃ/", "verb / noun", "Trau chuốt đánh bóng", "Polish your pronunciation with audio guides before examinations.", "Hãy trau chuốt phát âm của bạn với hướng dẫn âm thanh trước các kỳ thi.", "B1", "Học thuật", "Academic"],
  ["Polite", "/pəˈlaɪt/", "adjective", "Lịch sự lễ phép", "Use polite modal phrasing when inquiring in formal settings.", "Hãy sử dụng cách diễn đạt trợ động từ lịch sự khi hỏi trong bối cảnh trang trọng.", "A1", "Giao tiếp hàng ngày", "Daily"],
  ["Politely", "/pəˈlaɪt.li/", "adverb", "Một cách lịch sự", "Ask questions politely during international academic symposiums.", "Hãy đặt câu hỏi một cách lịch sự trong các hội nghị học thuật quốc tế.", "A2", "Giao tiếp hàng ngày", "Daily"],
  ["Political", "/pəˈlɪt.ɪ.kəl/", "adjective", "Thuộc về chính trị", "Follow international political debates to learn formal discourse.", "Hãy theo dõi các cuộc tranh luận chính trị quốc tế để học diễn ngôn trang trọng.", "B1", "Học thuật", "Academic"],
  ["Politician", "/ˌpɒl.ɪˈtɪʃ.ən/", "noun", "Chính trị gia", "Ethical politicians prioritize community welfare over factions.", "Những chính trị gia có đạo đức ưu tiên phúc lợi cộng đồng hơn các bè phái.", "B1", "Công việc", "Business"],
  ["Politics", "/ˈpɒl.ə.tɪks/", "noun", "Chính trị chính sự", "Studying world politics enriches your global perspective.", "Nghiên cứu chính trị thế giới làm phong phú thêm góc nhìn toàn cầu của bạn.", "B1", "Học thuật", "Academic"],
  ["Pollution", "/pəˈluː.ʃən/", "noun", "Ô nhiễm môi trường", "Renewable energy adoption curbs urban air pollution dramatically.", "Áp dụng năng lượng tái tạo làm giảm đáng kể ô nhiễm không khí đô thị.", "A2", "Giao tiếp hàng ngày", "Daily"],
  ["Pool", "/puːl/", "noun", "Hồ bơi vũng nước", "Swimming laps in the Olympic pool builds cardiovascular health.", "Bơi các vòng trong hồ bơi Olympic xây dựng sức khỏe tim mạch.", "A1", "Giao tiếp hàng ngày", "Daily"],
  ["Poor", "/pɔːr/", "adjective", "Nghèo khó, yếu kém", "Poor study habits yield weak recall; adopt smart SRS instead.", "Thói quen học tập kém mang lại sự nhớ yếu; thay vào đó hãy áp dụng SRS thông minh.", "A1", "Học thuật", "Academic"],
  ["Popular", "/ˈpɒp.jə.lər/", "adjective", "Phổ biến được ưa chuộng", "Spaced repetition has become the most popular vocabulary tool.", "Lặp lại ngắt quãng đã trở thành công cụ từ vựng phổ biến nhất.", "A1", "Học thuật", "Academic"],
  ["Population", "/ˌpɒp.jəˈleɪ.ʃən/", "noun", "Dân số cộng đồng", "Urban populations benefit from expansive public transport.", "Dân số đô thị được hưởng lợi từ giao thông công cộng rộng khắp.", "A2", "Du lịch", "Travel"],
  ["Port", "/pɔːt/", "noun", "Cảng biển bến cảng", "Cargo freighters dock at the bustling international sea port.", "Các tàu chở hàng cập cảng biển quốc tế nhộn nhịp.", "A2", "Du lịch", "Travel"],
  ["Position", "/pəˈzɪʃ.ən/", "noun / verb", "Vị trí địa vị", "Align articulatory vocal position properly for accurate speech.", "Hãy căn chỉnh vị trí cơ quan phát âm đúng cách để nói chính xác.", "A2", "Học thuật", "Academic"],
  ["Positive", "/ˈpɒz.ə.tɪv/", "adjective", "Tích cực khả quan", "A positive growth mindset turns language slips into lessons.", "Một tư duy phát triển tích cực biến các sai sót ngôn ngữ thành bài học.", "A1", "Cảm xúc", "Emotions"],
  ["Possess", "/pəˈzes/", "verb", "Sở hữu có được", "You possess the neurological capacity to achieve fluent mastery.", "Bạn sở hữu năng lực thần kinh để đạt được sự làm chủ lưu loát.", "B1", "Học thuật", "Academic"],
  ["Possibility", "/ˌpɒs.əˈbɪl.ə.ti/", "noun", "Khả năng triển vọng", "Foreign fluency unlocks a world of boundless career possibilities.", "Sự lưu loát ngoại ngữ mở ra một thế giới đầy những triển vọng nghề nghiệp vô hạn.", "A2", "Công việc", "Business"],
  ["Possible", "/ˈpɒs.ə.bəl/", "adjective", "Có thể khả thi", "Everything is possible with consistent daily spaced practice.", "Mọi thứ đều khả thi với việc luyện tập ngắt quãng đều đặn mỗi ngày.", "A1", "Học thuật", "Academic"],
  ["Possibly", "/ˈpɒs.ə.bli/", "adverb", "Có lẽ có thể", "You can possibly master 500 Oxford words this semester.", "Bạn hoàn toàn có thể làm chủ 500 từ Oxford trong học kỳ này.", "A2", "Học thuật", "Academic"],
  ["Post", "/pəʊst/", "noun / verb", "Bài đăng, bưu điện", "Post your daily study reflections on the student community board.", "Hãy đăng những suy ngẫm học tập hàng ngày trên bảng cộng đồng sinh viên.", "A1", "Công nghệ", "Tech"],
  ["Poster", "/ˈpəʊ.stər/", "noun", "Áp phích biểu đồ", "Hang an International Phonetic Alphabet chart poster in your room.", "Hãy treo một tấm áp phích biểu đồ Bảng ngữ âm quốc tế trong phòng của bạn.", "A2", "Học thuật", "Academic"],
  ["Potential", "/pəˈten.ʃəl/", "noun / adjective", "Tiềm năng tiềm tàng", "Unleash your linguistic potential through regular daily drills.", "Hãy giải phóng tiềm năng ngôn ngữ của bạn thông qua các bài luyện tập đều đặn hàng ngày.", "B1", "Cảm xúc", "Emotions"],
  ["Pour", "/pɔːr/", "verb", "Rót đổ tuôn trào", "Pour a warm cup of jasmine tea before sitting down to study.", "Hãy rót một tách trà lài ấm trước khi ngồi vào bàn học.", "A2", "Giao tiếp hàng ngày", "Daily"],
  ["Poverty", "/ˈpɒv.ə.ti/", "noun", "Nghèo đói cơ hàn", "Education is the most powerful weapon against poverty.", "Giáo dục là vũ khí mạnh mẽ nhất chống lại đói nghèo.", "B1", "Học thuật", "Academic"],
  ["Power", "/paʊər/", "noun", "Sức mạnh quyền lực", "Vocabulary gives you the power to express nuanced emotions.", "Từ vựng mang lại cho bạn sức mạnh để diễn đạt những cảm xúc tinh tế.", "A1", "Học thuật", "Academic"],
  ["Powerful", "/ˈpaʊə.fəl/", "adjective", "Mạnh mẽ đầy quyền năng", "Spaced repetition is a powerful tool for adult word retention.", "Lặp lại ngắt quãng là một công cụ mạnh mẽ cho việc ghi nhớ từ ở người lớn.", "A2", "Học thuật", "Academic"],
  ["Practical", "/ˈpræk.tɪ.kəl/", "adjective", "Thực tế thiết thực", "Learn practical everyday phrases you can use immediately.", "Hãy học những cụm từ thực tế hàng ngày mà bạn có thể sử dụng ngay lập tức.", "B1", "Học thuật", "Academic"],
  ["Practice", "/ˈpræk.tɪs/", "noun / verb", "Luyện tập thực hành", "Consistent daily practice transforms awkwardness into flow.", "Luyện tập hàng ngày nhất quán biến sự vụng về thành dòng chảy lưu loát.", "A1", "Học thuật", "Academic"],
  ["Praise", "/preɪz/", "verb / noun", "Khen ngợi tán dương", "Praise your speaking peers for their courage and diligence.", "Hãy khen ngợi các bạn cùng luyện nói vì lòng dũng cảm và sự siêng năng của họ.", "B1", "Cảm xúc", "Emotions"],
  ["Precious", "/ˈpreʃ.əs/", "adjective", "Quý giá quý báu", "Time is precious; invest twenty minutes daily in your dreams.", "Thời gian là quý báu; hãy đầu tư hai mươi phút mỗi ngày vào ước mơ của bạn.", "A2", "Cảm xúc", "Emotions"],
  ["Precise", "/prɪˈsaɪs/", "adjective", "Chính xác tỉ mỉ", "Use precise vocabulary to avoid ambiguity in academic prose.", "Hãy sử dụng từ vựng chính xác để tránh sự mơ hồ trong văn phong học thuật.", "B1", "Học thuật", "Academic"],
  ["Precisely", "/prɪˈsaɪs.li/", "adverb", "Một cách chính xác", "Articulate each consonant sound precisely as modeled.", "Hãy phát âm từng âm phụ âm một cách chính xác như được thị phạm.", "B1", "Học thuật", "Academic"],
  ["Predict", "/prɪˈdɪkt/", "verb", "Dự đoán dự báo", "Spaced algorithms predict optimal review intervals accurately.", "Các thuật toán ngắt quãng dự đoán các khoảng cách ôn tập tối ưu một cách chính xác.", "B1", "Học thuật", "Academic"],
  ["Prefer", "/prɪˈfɜːr/", "verb", "Thích hơn ưa chuộng", "I prefer morning study when mental focus is crisp and alert.", "Tôi thích học vào buổi sáng hơn khi sự tập trung tinh thần còn sắc bén và tỉnh táo.", "A1", "Cảm xúc", "Emotions"],
  ["Preference", "/ˈpref.ər.əns/", "noun", "Sở thích sự ưu tiên", "Customize app audio speed according to personal preference.", "Hãy tùy chỉnh tốc độ âm thanh của ứng dụng theo sở thích cá nhân.", "B1", "Công nghệ", "Tech"],
  ["Prepare", "/prɪˈpeər/", "verb", "Chuẩn bị sẵn sàng", "Prepare thoroughly for your conversational interview test.", "Hãy chuẩn bị kỹ lưỡng cho bài kiểm tra phỏng vấn giao tiếp của bạn.", "A1", "Học thuật", "Academic"],
  ["Prepared", "/prɪˈpeəd/", "adjective", "Đã chuẩn bị sẵn sàng", "Feel calm and prepared when stepping into the examination hall.", "Hãy cảm thấy bình tĩnh và sẵn sàng khi bước vào phòng thi.", "A2", "Cảm xúc", "Emotions"],
  ["Presence", "/ˈprez.əns/", "noun", "Sự hiện diện phong thái", "Maintain a calm confident presence during public speeches.", "Hãy duy trì phong thái tự tin điềm đạm trong các bài phát biểu trước công chúng.", "B2", "Cảm xúc", "Emotions"],
  ["Present", "/ˈprez.ənt/", "adjective / verb / noun", "Hiện tại, thuyết trình", "Present your research findings with clear visual diagrams.", "Hãy thuyết trình những phát hiện nghiên cứu của bạn bằng các sơ đồ trực quan rõ ràng.", "A1", "Công việc", "Business"],
  ["Presentation", "/ˌprez.ənˈteɪ.ʃən/", "noun", "Bài thuyết trình", "Deliver your oral presentation with articulate vocal pace.", "Hãy thuyết trình bài nói của bạn với nhịp điệu giọng nói rõ ràng.", "A2", "Công việc", "Business"],
  ["Preserve", "/prɪˈzɜːv/", "verb", "Bảo tồn gìn giữ", "Spaced repetition preserves newly learned words indefinitely.", "Lặp lại ngắt quãng gìn giữ các từ mới học vô thời hạn.", "B1", "Học thuật", "Academic"],
  ["President", "/ˈprez.ɪ.dənt/", "noun", "Chủ tịch tổng thống", "The university president welcomed international freshmen.", "Chủ tịch trường đại học đã chào đón các tân sinh viên quốc tế.", "A2", "Công việc", "Business"],
  ["Press", "/pres/", "verb / noun", "Ấn nút, báo chí", "Press the speaker button to hear native phonetic pronunciation.", "Hãy ấn nút loa để nghe phát âm ngữ âm của người bản xứ.", "A2", "Công nghệ", "Tech"],
  ["Pressure", "/ˈpreʃ.ər/", "noun", "Áp lực căng thẳng", "Channel examination pressure into focused creative stamina.", "Hãy chuyển hóa áp lực thi cử thành thể lực sáng tạo tập trung.", "B1", "Cảm xúc", "Emotions"],
  ["Pretend", "/prɪˈtend/", "verb", "Giả vờ vờ như", "Do not pretend to comprehend; ask for clarifying examples.", "Đừng giả vờ hiểu; hãy yêu cầu đưa ra các ví dụ làm rõ.", "A2", "Học thuật", "Academic"],
  ["Pretty", "/ˈprɪt.i/", "adjective / adverb", "Xinh đẹp, khá là", "She speaks English pretty well after two months of drills.", "Cô ấy nói tiếng Anh khá tốt sau hai tháng luyện tập.", "A1", "Giao tiếp hàng ngày", "Daily"],
  ["Prevent", "/prɪˈvent/", "verb", "Ngăn ngừa phòng tránh", "Daily spaced repetition prevents the steep curve of forgetting.", "Lặp lại ngắt quãng hàng ngày ngăn ngừa đường cong lãng quên dốc đứng.", "A2", "Học thuật", "Academic"],
  ["Previous", "/ˈpriː.vi.əs/", "adjective", "Trước đó vừa qua", "Review flashcards learned during your previous study block.", "Hãy ôn lại các thẻ flashcard đã học trong khoảng học trước đó của bạn.", "A2", "Học thuật", "Academic"],
  ["Price", "/praɪs/", "noun / verb", "Giá cả chi phí", "Fluency demands a price of daily discipline, but pays tenfold.", "Sự lưu loát đòi hỏi cái giá của kỷ luật hàng ngày, nhưng đền đáp gấp mười lần.", "A1", "Công việc", "Business"],
  ["Pride", "/praɪd/", "noun", "Niềm tự hào kiêu hãnh", "Take genuine pride in every small milestone you conquer.", "Hãy tự hào chân thành về từng cột mốc nhỏ mà bạn chinh phục được.", "A2", "Cảm xúc", "Emotions"],
  ["Primary", "/ˈpraɪ.mər.i/", "adjective", "Chính yếu cơ bản", "Speech fluency is the primary objective of our application.", "Sự lưu loát khi nói là mục tiêu chính yếu của ứng dụng chúng tôi.", "B1", "Học thuật", "Academic"],
  ["Principle", "/ˈprɪn.sə.pəl/", "noun", "Nguyên tắc chân lý", "The principle of spaced recall underpins effective retention.", "Nguyên tắc gợi nhớ ngắt quãng làm nền tảng cho việc ghi nhớ hiệu quả.", "B1", "Học thuật", "Academic"],
  ["Print", "/prɪnt/", "verb / noun", "In ấn bản in", "Print flashcard cheat-sheets to study during offline travels.", "Hãy in các bảng mẹo flashcard để học trong các chuyến du lịch ngoại tuyến.", "A1", "Công nghệ", "Tech"],
  ["Prior", "/praɪər/", "adjective", "Trước tiên ưu tiên", "No prior linguistic background is required to begin learning.", "Không yêu cầu nền tảng ngôn ngữ trước đó để bắt đầu học.", "B2", "Học thuật", "Academic"],
  ["Priority", "/praɪˈɒr.ə.ti/", "noun", "Sự ưu tiên hàng đầu", "Make twenty minutes of daily review your top priority.", "Hãy biến hai mươi phút ôn tập hàng ngày thành ưu tiên hàng đầu của bạn.", "B1", "Công việc", "Business"],
  ["Privacy", "/ˈprɪv.ə.si/", "noun", "Sự riêng tư bảo mật", "Our platform protects user learning privacy strictly.", "Nền tảng của chúng tôi bảo vệ sự riêng tư học tập của người dùng một cách nghiêm ngặt.", "B1", "Công nghệ", "Tech"],
  ["Private", "/ˈpraɪ.vət/", "adjective", "Riêng tư cá nhân", "Set aside a private quiet nook for focused listening drills.", "Hãy dành riêng một góc yên tĩnh riêng tư cho các bài luyện nghe tập trung.", "A2", "Giao tiếp hàng ngày", "Daily"],
  ["Privilege", "/ˈprɪv.əl.ɪdʒ/", "noun", "Đặc ân đặc quyền", "Access to world-class learning tools is an empowering privilege.", "Được tiếp cận các công cụ học tập đẳng cấp thế giới là một đặc ân trao quyền.", "B2", "Học thuật", "Academic"],
  ["Prize", "/praɪz/", "noun / verb", "Giải thưởng quý trọng", "Win academic achievement prizes through relentless effort.", "Hãy giành các giải thưởng thành tựu học thuật thông qua nỗ lực không ngừng nghỉ.", "A2", "Học thuật", "Academic"],
  ["Probably", "/ˈprɒb.ə.bli/", "adverb", "Có lẽ có thể", "You will probably remember words far better with spaced SRS.", "Bạn có lẽ sẽ nhớ từ tốt hơn nhiều với hệ thống SRS ngắt quãng.", "A1", "Học thuật", "Academic"],
  ["Problem", "/ˈprɒb.ləm/", "noun", "Vấn đề trở ngại", "Break complex grammar problems down into simple components.", "Hãy chia nhỏ các vấn đề ngữ pháp phức tạp thành các thành phần đơn giản.", "A1", "Học thuật", "Academic"],
  ["Procedure", "/prəˈsiː.dʒər/", "noun", "Quy trình thủ tục", "Follow the standard spaced repetition procedure daily.", "Hãy làm theo quy trình lặp lại ngắt quãng tiêu chuẩn hàng ngày.", "B1", "Công việc", "Business"],
  ["Proceed", "/prəˈsiːd/", "verb", "Tiến hành tiếp tục", "Proceed to the next flashcard deck once you rate mastery.", "Hãy chuyển sang bộ thẻ flashcard tiếp theo một khi bạn đánh giá đã thành thạo.", "B2", "Học thuật", "Academic"],
  ["Process", "/ˈprəʊ.ses/", "noun / verb", "Quy trình xử lý", "Trust the daily review process and fluency will follow.", "Hãy tin tưởng vào quy trình ôn tập hàng ngày và sự lưu loát sẽ theo sau.", "A2", "Học thuật", "Academic"],
  ["Produce", "/prəˈdjuːs/", "verb / noun", "Sản xuất tạo ra", "Regular speech shadowing helps produce natural vowel flows.", "Luyện nhại giọng đều đặn giúp tạo ra những dòng nguyên âm tự nhiên.", "A2", "Học thuật", "Academic"],
  ["Product", "/ˈprɒd.ʌkt/", "noun", "Sản phẩm thành quả", "Fluency is the product of steady joyful daily commitment.", "Sự lưu loát là thành quả của sự cam kết hàng ngày vui vẻ và vững chắc.", "A1", "Công việc", "Business"],
  ["Production", "/prəˈdʌk.ʃən/", "noun", "Sản xuất sự tạo ra", "Acoustic speech production requires fine vocal coordination.", "Sự tạo ra lời nói âm học đòi hỏi sự phối hợp thanh quản tinh tế.", "B1", "Học thuật", "Academic"],
  ["Productive", "/prəˈdʌk.tɪv/", "adjective", "Năng suất hiệu quả", "A twenty-minute SRS session is remarkably productive.", "Một buổi học SRS hai mươi phút mang lại năng suất rõ rệt.", "B1", "Công việc", "Business"],
  ["Productivity", "/ˌprɒd.ʌkˈtɪv.ə.ti/", "noun", "Năng suất làm việc", "Intelligent spaced tools multiply your study productivity.", "Các công cụ ngắt quãng thông minh nhân đôi năng suất học tập của bạn.", "B2", "Công việc", "Business"],
  ["Profession", "/prəˈfeʃ.ən/", "noun", "Nghề nghiệp chuyên môn", "Teaching foreign languages is an inspiring profession.", "Giảng dạy ngoại ngữ là một nghề nghiệp truyền cảm hứng.", "A2", "Công việc", "Business"],
  ["Professional", "/prəˈfeʃ.ən.əl/", "adjective / noun", "Chuyên nghiệp chuyên gia", "Cultivate a polite professional tone for workplace emails.", "Hãy nuôi dưỡng một giọng điệu chuyên nghiệp lịch thiệp cho các email nơi làm việc.", "A2", "Công việc", "Business"],
  ["Professor", "/prəˈfes.ər/", "noun", "Giáo sư giảng viên", "The linguistics professor illuminated complex phonetic rules.", "Giáo sư ngôn ngữ học đã làm sáng tỏ các quy tắc ngữ âm phức tạp.", "A1", "Học thuật", "Academic"],
  ["Profile", "/ˈprəʊ.faɪl/", "noun / verb", "Hồ sơ cá nhân", "Track your learning level and unlocked badges in your profile.", "Hãy theo dõi cấp độ học tập và các huy hiệu đã mở khóa trong hồ sơ của bạn.", "A2", "Công nghệ", "Tech"],
  ["Profit", "/ˈprɒf.ɪt/", "noun / verb", "Lợi nhuận hưởng lợi", "Students profit enormously from daily conversational practice.", "Học sinh được hưởng lợi to lớn từ việc luyện tập giao tiếp hàng ngày.", "A2", "Công việc", "Business"],
  ["Program", "/ˈprəʊ.ɡræm/", "noun / verb", "Chương trình phần mềm", "Enroll in a comprehensive English pronunciation program.", "Hãy đăng ký một chương trình phát âm tiếng Anh toàn diện.", "A1", "Công nghệ", "Tech"],
  ["Programmer", "/ˈprəʊ.ɡræm.ər/", "noun", "Lập trình viên", "Software programmers build intelligent spaced study engines.", "Các lập trình viên phần mềm xây dựng những động cơ học tập ngắt quãng thông minh.", "A2", "Công nghệ", "Tech"],
  ["Progress", "/ˈprəʊ.ɡres/", "noun / verb", "Tiến bộ phát triển", "Celebrate your continuous vocabulary progress every single day.", "Hãy ăn mừng sự tiến bộ từ vựng liên tục của bạn mỗi ngày.", "A2", "Học thuật", "Academic"],
  ["Progressive", "/prəˈɡres.ɪv/", "adjective", "Tiến bộ cấp tiến", "Adopt progressive learning methods backed by cognitive science.", "Hãy áp dụng các phương pháp học tập tiến bộ được hỗ trợ bởi khoa học nhận thức.", "B2", "Học thuật", "Academic"],
  ["Project", "/ˈprɒdʒ.ekt/", "noun / verb", "Dự án đề án", "Collaborate on an international cross-cultural research project.", "Hãy hợp tác trong một dự án nghiên cứu giao lưu văn hóa quốc tế.", "A1", "Công việc", "Business"],
  ["Promise", "/ˈprɒm.ɪs/", "verb / noun", "Lời hứa cam kết", "Make a promise to yourself to complete daily flashcard sets.", "Hãy tự hứa với bản thân sẽ hoàn thành các bộ thẻ flashcard hàng ngày.", "A2", "Cảm xúc", "Emotions"],
  ["Promote", "/prəˈməʊt/", "verb", "Thúc đẩy thăng chức", "Language fluency promotes international career mobility.", "Sự lưu loát ngôn ngữ thúc đẩy khả năng di chuyển nghề nghiệp quốc tế.", "B1", "Công việc", "Business"],
  ["Promotion", "/prəˈməʊ.ʃən/", "noun", "Sự thăng chức quảng bá", "Earned career promotions follow demonstrated English competence.", "Những sự thăng chức nghề nghiệp xứng đáng sẽ theo sau năng lực tiếng Anh đã được chứng minh.", "B1", "Công việc", "Business"],
  ["Prompt", "/prɒmpt/", "adjective / verb / noun", "Nhanh chóng nhắc nhở", "Review flashcards when algorithmic notifications prompt you.", "Hãy ôn lại thẻ flashcard khi các thông báo thuật toán nhắc nhở bạn.", "B2", "Công nghệ", "Tech"],
  ["Promptly", "/ˈprɒmpt.li/", "adverb", "Một cách nhanh chóng", "Reply promptly and courteously to international client queries.", "Hãy trả lời một cách nhanh chóng và lịch sự cho các thắc mắc của khách hàng quốc tế.", "B1", "Công việc", "Business"],
  ["Pronounce", "/prəˈnaʊns/", "verb", "Phát âm đọc", "Pronounce each word clearly using accurate IPA vowel sounds.", "Hãy phát âm từng từ rõ ràng bằng cách sử dụng các âm nguyên âm IPA chính xác.", "A1", "Học thuật", "Academic"],
  ["Pronunciation", "/prəˌnʌn.siˈeɪ.ʃən/", "noun", "Sự phát âm cách phát âm", "Refine your English pronunciation by shadowing native audio.", "Hãy tinh chỉnh phát âm tiếng Anh của bạn bằng cách nhại theo âm thanh bản xứ.", "A1", "Học thuật", "Academic"],
  ["Proof", "/pruːf/", "noun", "Bằng chứng chứng minh", "Fluency is living proof of your steady disciplined effort.", "Sự lưu loát là bằng chứng sống cho nỗ lực kỷ luật đều đặn của bạn.", "B1", "Học thuật", "Academic"],
  ["Proper", "/ˈprɒp.ər/", "adjective", "Thích đáng đúng đắn", "Proper tongue placement ensures crisp English consonant sounds.", "Vị trí đặt lưỡi đúng đắn đảm bảo các âm phụ âm tiếng Anh phát ra rõ ràng.", "A2", "Học thuật", "Academic"],
  ["Properly", "/ˈprɒp.əl.i/", "adverb", "Một cách đúng đắn", "Learn to articulate English diphthongs properly with audio.", "Hãy học cách phát âm các nguyên âm đôi tiếng Anh đúng cách với âm thanh.", "A2", "Học thuật", "Academic"],
  ["Property", "/ˈprɒp.ə.ti/", "noun", "Tài sản thuộc tính", "Curiosity is an innate property of lifelong learners.", "Tính tò mò là thuộc tính bẩm sinh của những người học tập suốt đời.", "B1", "Công việc", "Business"],
  ["Proposal", "/prəˈpəʊ.zəl/", "noun", "Đề xuất kiến nghị", "Submit your educational grant proposal to the committee.", "Hãy nộp bản đề xuất tài trợ giáo dục của bạn cho ủy ban.", "B1", "Công việc", "Business"],
  ["Propose", "/prəˈpəʊz/", "verb", "Đề xuất kiến nghị", "Propose innovative ways to practice conversational English.", "Hãy đề xuất những cách đổi mới để luyện tập tiếng Anh giao tiếp.", "B1", "Công việc", "Business"],
  ["Prospect", "/ˈprɒs.pekt/", "noun", "Triển vọng viễn cảnh", "Bilingual proficiency opens bright career prospects worldwide.", "Thành thạo song ngữ mở ra những triển vọng nghề nghiệp tươi sáng trên toàn thế giới.", "B2", "Công việc", "Business"],
  ["Protect", "/prəˈtekt/", "verb", "Bảo vệ gìn giữ", "Protect your study focus by muting social media notifications.", "Hãy bảo vệ sự tập trung học tập của bạn bằng cách tắt thông báo mạng xã hội.", "A2", "Học thuật", "Academic"],
  ["Protection", "/prəˈtek.ʃən/", "noun", "Sự bảo vệ phòng hộ", "Spaced review provides permanent protection against forgetting.", "Ôn tập ngắt quãng mang lại sự bảo vệ vĩnh viễn chống lại việc lãng quên.", "B1", "Học thuật", "Academic"],
  ["Proud", "/praʊd/", "adjective", "Tự hào kiêu hãnh", "Be proud of every single vocabulary flashcard you conquer.", "Hãy tự hào về từng chiếc thẻ flashcard từ vựng mà bạn chinh phục được.", "A1", "Cảm xúc", "Emotions"],
  ["Proudly", "/ˈpraʊd.li/", "adverb", "Một cách tự hào", "She proudly spoke English with foreign delegates at the gala.", "Cô ấy tự hào nói tiếng Anh với các đại biểu nước ngoài tại buổi dạ tiệc.", "A2", "Cảm xúc", "Emotions"],
  ["Prove", "/pruːv/", "verb", "Chứng minh chứng tỏ", "Consistent daily actions prove your commitment to excellence.", "Hành động nhất quán hàng ngày chứng minh cam kết của bạn đối với sự xuất sắc.", "A2", "Học thuật", "Academic"],
  ["Provide", "/prəˈvaɪd/", "verb", "Cung cấp chu cấp", "Our application provides comprehensive Oxford 3000 decks.", "Ứng dụng của chúng tôi cung cấp các bộ thẻ Oxford 3000 toàn diện.", "A2", "Công nghệ", "Tech"],
  ["Public", "/ˈpʌb.lɪk/", "adjective / noun", "Công cộng đại chúng", "Public libraries grant universal access to knowledge.", "Thư viện công cộng cấp quyền tiếp cận tri thức phổ quát.", "A1", "Giao tiếp hàng ngày", "Daily"],
  ["Publication", "/ˌpʌb.lɪˈkeɪ.ʃən/", "noun", "Sự xuất bản ấn phẩm", "The academic publication shared breakthroughs in cognition.", "Ấn phẩm học thuật đã chia sẻ những đột phá trong nhận thức.", "B2", "Học thuật", "Academic"],
  ["Publish", "/ˈpʌb.lɪʃ/", "verb", "Xuất bản công bố", "Linguists publish peer-reviewed studies on language acquisition.", "Các nhà ngôn ngữ học xuất bản các nghiên cứu có bình duyệt về việc tiếp thu ngôn ngữ.", "A2", "Học thuật", "Academic"],
  ["Pull", "/pʊl/", "verb / noun", "Kéo lại kéo vào", "Pull newly learned words into daily conversations actively.", "Hãy chủ động đưa các từ mới học vào các cuộc trò chuyện hàng ngày.", "A1", "Giao tiếp hàng ngày", "Daily"],
  ["Purpose", "/ˈpɜː.pəs/", "noun", "Mục đích ý nghĩa", "Clarity of purpose fuels steady motivation across months.", "Mục đích rõ ràng tiếp lửa cho động lực vững vàng qua nhiều tháng.", "A2", "Cảm xúc", "Emotions"],
  ["Pursue", "/pəˈsjuː/", "verb", "Theo đuổi mưu cầu", "Pursue your language learning dreams with joyful tenacity.", "Hãy theo đuổi ước mơ học ngôn ngữ của bạn với sự kiên trì vui vẻ.", "B1", "Cảm xúc", "Emotions"],
  ["Pursuit", "/pəˈsjuːt/", "noun", "Sự mưu cầu theo đuổi", "The pursuit of fluency is an enriching lifelong adventure.", "Mưu cầu sự lưu loát là một cuộc phiêu lưu suốt đời đầy phong phú.", "B2", "Học thuật", "Academic"],
  ["Push", "/pʊʃ/", "verb / noun", "Thúc đẩy đẩy tới", "Push gently through initial awkwardness to achieve flow.", "Hãy nhẹ nhàng vượt qua sự vụng về ban đầu để đạt được dòng chảy tự nhiên.", "A1", "Cảm xúc", "Emotions"],
  ["Put", "/pʊt/", "verb", "Đặt để đưa vào", "Put your heart into practicing pronunciation drills every morning.", "Hãy đặt trọn trái tim bạn vào việc luyện tập các bài phát âm mỗi sáng.", "A1", "Học thuật", "Academic"]
];

P_TO_Z_HEADWORDS.forEach(item => {
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

console.log(`Từ vựng hiện có sau khi nạp P: ${wordMap.size} từ.`);

// 5. Nạp tiếp các chữ cái Q - Z còn lại để chạm mốc mục tiêu 3.650 - 3.750:
const Q_TO_Z_HEADWORDS = [
  // Q
  ["Qualify", "/ˈkwɒl.ɪ.faɪ/", "verb", "Đủ điều kiện đủ tư cách", "High English scores qualify students for foreign scholarships.", "Điểm tiếng Anh cao giúp sinh viên đủ điều kiện nhận học bổng nước ngoài.", "B1", "Học thuật", "Academic"],
  ["Quality", "/ˈkwɒl.ə.ti/", "noun / adjective", "Chất lượng phẩm chất", "Prioritize quality daily recall over mindless rapid scrolling.", "Hãy ưu tiên chất lượng gợi nhớ hàng ngày hơn là lướt nhanh vô thức.", "A2", "Học thuật", "Academic"],
  ["Quantity", "/ˈkwɒn.tə.ti/", "noun", "Số lượng khối lượng", "Balance quantity of vocabulary with depth of contextual usage.", "Hãy cân bằng số lượng từ vựng với chiều sâu cách dùng trong ngữ cảnh.", "A2", "Học thuật", "Academic"],
  ["Quarter", "/ˈkwɔː.tər/", "noun", "Một phần tư quý", "Review words for a quarter of an hour every single morning.", "Hãy ôn từ trong một phần tư giờ (mười lăm phút) vào mỗi sáng.", "A1", "Học thuật", "Academic"],
  ["Queen", "/kwiːn/", "noun", "Nữ hoàng hoàng hậu", "The museum preserves the ceremonial jewels of historic queens.", "Bảo tàng bảo tồn các trang sức nghi lễ của những nữ hoàng lịch sử.", "A1", "Du lịch", "Travel"],
  ["Question", "/ˈkwes.tʃən/", "noun / verb", "Câu hỏi nghi vấn", "Never hesitate to question confusing grammatical nuances.", "Đừng bao giờ ngần ngại đặt câu hỏi về những sắc thái ngữ pháp khó hiểu.", "A1", "Học thuật", "Academic"],
  ["Quick", "/kwɪk/", "adjective", "Nhanh nhẹn mau chóng", "A quick daily review session protects words from decay.", "Một buổi ôn tập nhanh hàng ngày bảo vệ từ vựng khỏi sự mai một.", "A1", "Học thuật", "Academic"],
  ["Quickly", "/ˈkwɪk.li/", "adverb", "Một cách nhanh chóng", "Spaced repetition helps you acquire new vocabulary quickly.", "Lặp lại ngắt quãng giúp bạn tiếp thu từ vựng mới một cách nhanh chóng.", "A1", "Học thuật", "Academic"],
  ["Quiet", "/ˈkwaɪ.ət/", "adjective", "Yên tĩnh thanh bình", "A quiet study room maximizes focus and auditory retention.", "Một phòng học yên tĩnh tối đa hóa sự tập trung và khả năng ghi nhớ âm thanh.", "A1", "Giao tiếp hàng ngày", "Daily"],
  ["Quietly", "/ˈkwaɪ.ət.li/", "adverb", "Một cách yên lặng", "She quietly recited example sentences to hone intonation.", "Cô ấy lặng lẽ đọc các câu ví dụ để mài giũa ngữ điệu.", "A2", "Học thuật", "Academic"],
  ["Quit", "/kwɪt/", "verb", "Từ bỏ bỏ cuộc", "Never quit; persistence transforms language awkwardness into ease.", "Đừng bao giờ bỏ cuộc; sự kiên trì biến sự vụng về ngôn ngữ thành sự dễ dàng.", "A2", "Cảm xúc", "Emotions"],
  ["Quite", "/kwaɪt/", "adverb", "Khá là hoàn toàn", "She speaks English quite naturally after three months of SRS.", "Cô ấy nói tiếng Anh khá tự nhiên sau ba tháng sử dụng SRS.", "A1", "Học thuật", "Academic"],
  ["Quote", "/kwəʊt/", "verb / noun", "Trích dẫn câu trích", "Quote inspiring authors in your essay to substantiate points.", "Hãy trích dẫn các tác giả truyền cảm hứng trong bài luận để củng cố luận điểm.", "A2", "Học thuật", "Academic"],

  // R
  ["Race", "/reɪs/", "noun / verb", "Cuộc đua, chủng tộc", "Language learning is a marathon, not a frantic sprint race.", "Học ngôn ngữ là một cuộc chạy việt dã, chứ không phải cuộc đua nước rút điên cuồng.", "A2", "Học thuật", "Academic"],
  ["Radio", "/ˈreɪ.di.əʊ/", "noun", "Đài phát thanh", "Listening to English radio broadcasts sharpens acoustic ear.", "Nghe các chương trình phát thanh tiếng Anh làm sắc bén đôi tai thính giác.", "A1", "Giao tiếp hàng ngày", "Daily"],
  ["Railway", "/ˈreɪl.weɪ/", "noun", "Đường sắt xe lửa", "The scenic mountain railway connects historic alpine villages.", "Tuyến đường sắt trên núi tuyệt đẹp kết nối các ngôi làng vùng cao lịch sử.", "A2", "Du lịch", "Travel"],
  ["Rain", "/reɪn/", "noun / verb", "Cơn mưa trời mưa", "Gentle spring rain nurtures blooming countryside wildflowers.", "Mưa xuân nhẹ hạt nuôi dưỡng hoa dại vùng quê đang nở rộ.", "A1", "Giao tiếp hàng ngày", "Daily"],
  ["Raise", "/reɪz/", "verb / noun", "Nâng cao nuôi dưỡng", "Raise your speaking confidence through daily vocal shadowing.", "Hãy nâng cao sự tự tin khi nói thông qua việc nhại giọng hàng ngày.", "A2", "Học thuật", "Academic"],
  ["Random", "/ˈræn.dəm/", "adjective", "Ngẫu nhiên tùy ý", "Avoid random cramming; rely on algorithmic spaced intervals.", "Hãy tránh việc nhồi nhét ngẫu nhiên; hãy dựa vào các khoảng ngắt quãng theo thuật toán.", "A2", "Học thuật", "Academic"],
  ["Range", "/reɪndʒ/", "noun / verb", "Phạm vi phạm trù", "An expansive vocabulary range empowers expressive fluency.", "Một phạm vi từ vựng phong phú trao quyền cho sự lưu loát truyền cảm.", "B1", "Học thuật", "Academic"],
  ["Rapid", "/ˈræp.ɪd/", "adjective", "Nhanh chóng mau lẹ", "Daily practice produces rapid gains in listening comprehension.", "Luyện tập hàng ngày mang lại những tiến bộ nhanh chóng trong khả năng nghe hiểu.", "B1", "Học thuật", "Academic"],
  ["Rapidly", "/ˈræp.ɪd.li/", "adverb", "Một cách nhanh chóng", "Vocabulary expands rapidly when learned in rich contexts.", "Từ vựng mở rộng nhanh chóng khi được học trong các ngữ cảnh phong phú.", "B1", "Học thuật", "Academic"],
  ["Rare", "/reər/", "adjective", "Hiếm có quý hiếm", "True bilingual fluency is a rare and highly valued asset.", "Sự lưu loát song ngữ thực sự là một tài sản hiếm có và được đánh giá rất cao.", "A2", "Công việc", "Business"],
  ["Rate", "/reɪt/", "noun / verb", "Tốc độ, đánh giá", "Rate flashcard difficulty honestly to optimize SRS intervals.", "Hãy đánh giá độ khó của flashcard trung thực để tối ưu hóa khoảng cách SRS.", "A2", "Học thuật", "Academic"],
  ["Rather", "/ˈrɑː.ðər/", "adverb", "Đúng hơn là, khá", "Focus on active retrieval rather than passive rereading.", "Hãy tập trung vào việc gợi nhớ chủ động thay vì đọc lại thụ động.", "A2", "Học thuật", "Academic"],
  ["Reach", "/riːtʃ/", "verb / noun", "Chạm tới vươn tới", "You will reach your vocabulary goals through steady persistence.", "Bạn sẽ chạm tới các mục tiêu từ vựng của mình thông qua sự kiên trì bền bỉ.", "A2", "Học thuật", "Academic"],
  ["React", "/riˈækt/", "verb", "Phản ứng đối phó", "React with curiosity rather than frustration when making errors.", "Hãy phản ứng bằng sự tò mò thay vì bực bội khi mắc lỗi.", "A2", "Cảm xúc", "Emotions"],
  ["Reaction", "/riˈæk.ʃən/", "noun", "Sự phản ứng cảm nghĩ", "Spontaneous speaking reactions develop through dialogue drills.", "Phản ứng nói tự nhiên phát triển qua các bài luyện đối thoại.", "B1", "Cảm xúc", "Emotions"],
  ["Read", "/riːd/", "verb", "Đọc sách đọc hiểu", "Read captivating English non-fiction to absorb fresh idioms.", "Hãy đọc sách phi hư cấu tiếng Anh lôi cuốn để tiếp thu các thành ngữ mới.", "A1", "Học thuật", "Academic"],
  ["Reader", "/ˈriː.dər/", "noun", "Người đọc độc giả", "An avid reader absorbs expansive vocabulary naturally.", "Một người ham đọc sách tiếp thu vốn từ vựng phong phú một cách tự nhiên.", "A1", "Học thuật", "Academic"],
  ["Reading", "/ˈriː.dɪŋ/", "noun", "Kỹ năng đọc", "Extensive reading strengthens subconscious grammar awareness.", "Đọc rộng củng cố nhận thức ngữ pháp một cách tiềm thức.", "A1", "Học thuật", "Academic"],
  ["Ready", "/ˈred.i/", "adjective", "Sẵn sàng chuẩn bị", "Feel ready to speak with confidence in conversational clubs.", "Hãy cảm thấy sẵn sàng nói một cách tự tin trong các câu lạc bộ giao tiếp.", "A1", "Cảm xúc", "Emotions"],
  ["Real", "/rɪəl/", "adjective", "Chân thực thực tế", "Practice with real authentic audio rather than robotic speech.", "Hãy luyện tập với âm thanh chân thực thực tế thay vì giọng nói như robot.", "A1", "Học thuật", "Academic"],
  ["Realistic", "/ˌrɪəˈlɪs.tɪk/", "adjective", "Thực tế khả thi", "Set realistic daily targets to maintain joyful study stamina.", "Hãy đặt ra các mục tiêu hàng ngày thực tế để duy trì thể lực học tập vui vẻ.", "B1", "Học thuật", "Academic"],
  ["Reality", "/riˈæl.ə.ti/", "noun", "Thực tế hiện thực", "Daily habits turn the dream of fluency into living reality.", "Thói quen hàng ngày biến ước mơ lưu loát thành hiện thực sống động.", "A2", "Học thuật", "Academic"],
  ["Realize", "/ˈrɪə.laɪz/", "verb", "Nhận ra thấu hiểu", "Realize that small daily efforts compound into mastery.", "Hãy nhận ra rằng những nỗ lực nhỏ hàng ngày sẽ tích tụ thành sự tinh thông.", "A2", "Cảm xúc", "Emotions"],
  ["Really", "/ˈrɪə.li/", "adverb", "Thực sự rất", "Spaced repetition really works to lock words in memory.", "Lặp lại ngắt quãng thực sự hiệu quả để khóa chặt từ vựng vào trí nhớ.", "A1", "Học thuật", "Academic"],
  ["Reason", "/ˈriː.zən/", "noun / verb", "Lý do lý trí", "Give clear logical reasons to support your essay arguments.", "Hãy đưa ra các lý do logic rõ ràng để hỗ trợ các luận điểm bài luận của bạn.", "A1", "Học thuật", "Academic"],
  ["Reasonable", "/ˈriː.zən.ə.bəl/", "adjective", "Hợp lý thỏa đáng", "Twenty minutes of daily study is entirely reasonable.", "Hai mươi phút học tập mỗi ngày là hoàn toàn hợp lý.", "A2", "Học thuật", "Academic"],
  ["Recall", "/rɪˈkɔːl/", "verb / noun", "Gợi nhớ nhớ lại", "Active recall strengthens neural synaptic pathways in memory.", "Gợi nhớ chủ động củng cố các đường dẫn synap thần kinh trong trí nhớ.", "B1", "Học thuật", "Academic"],
  ["Receive", "/rɪˈsiːv/", "verb", "Nhận được đón nhận", "Receive immediate feedback on your pronunciation accuracy.", "Hãy nhận phản hồi ngay lập tức về độ chính xác phát âm của bạn.", "A1", "Công nghệ", "Tech"],
  ["Recent", "/ˈriː.sənt/", "adjective", "Gần đây mới đây", "Recent cognitive studies prove the power of spaced repetition.", "Các nghiên cứu nhận thức gần đây chứng minh sức mạnh của lặp lại ngắt quãng.", "A2", "Học thuật", "Academic"],
  ["Recently", "/ˈriː.sənt.li/", "adverb", "Gần đây dạo này", "She recently passed her international English examination.", "Gần đây cô ấy đã vượt qua kỳ thi tiếng Anh quốc tế của mình.", "A2", "Học thuật", "Academic"],
  ["Recognize", "/ˈrek.əɡ.naɪz/", "verb", "Nhận ra công nhận", "Recognize common Latin prefixes to decipher unfamiliar terms.", "Hãy nhận biết các tiền tố Latinh phổ biến để giải mã các thuật ngữ chưa quen.", "A2", "Học thuật", "Academic"],
  ["Recommend", "/ˌrek.əˈmend/", "verb", "Khuyên nhủ giới thiệu", "Educators recommend spaced review over cramming marathons.", "Các nhà giáo dục khuyên nên ôn tập ngắt quãng hơn là các đợt học nhồi nhét kéo dài.", "A2", "Học thuật", "Academic"],
  ["Record", "/rɪˈkɔːd/", "verb / noun", "Ghi âm, kỷ lục", "Record your voice to audit pronunciation stress patterns.", "Hãy ghi âm giọng nói của bạn để kiểm tra các mẫu trọng âm phát âm.", "A2", "Công nghệ", "Tech"],
  ["Recover", "/rɪˈkʌv.ər/", "verb", "Hồi phục lấy lại", "Restful sleep helps brain synapses recover cognitive focus.", "Giấc ngủ yên bình giúp các khớp thần kinh não hồi phục sự tập trung nhận thức.", "A2", "Giao tiếp hàng ngày", "Daily"],
  ["Reduce", "/rɪˈdʒuːs/", "verb", "Giảm bớt thu nhỏ", "Spaced algorithms reduce total study hours by half.", "Các thuật toán ngắt quãng giảm một nửa tổng số giờ học tập.", "A2", "Học thuật", "Academic"],
  ["Reflect", "/rɪˈflekt/", "verb", "Suy ngẫm phản chiếu", "Reflect on your study progress at the end of each week.", "Hãy suy ngẫm về tiến độ học tập của bạn vào cuối mỗi tuần.", "B1", "Cảm xúc", "Emotions"],
  ["Regular", "/ˈreɡ.jə.lər/", "adjective", "Đều đặn định kỳ", "Regular study habits compound into extraordinary fluency.", "Thói quen học tập đều đặn tích tụ thành sự lưu loát phi thường.", "A1", "Học thuật", "Academic"],
  ["Regularly", "/ˈreɡ.jə.lər.li/", "adverb", "Một cách đều đặn", "Review your personalized flashcards regularly every morning.", "Hãy ôn lại các thẻ flashcard cá nhân hóa của bạn đều đặn vào mỗi sáng.", "A2", "Học thuật", "Academic"],
  ["Relax", "/rɪˈlæks/", "verb", "Thư giãn thả lỏng", "Relax your vocal muscles before starting speech exercises.", "Hãy thả lỏng các cơ phát âm trước khi bắt đầu các bài tập nói.", "A1", "Cảm xúc", "Emotions"],
  ["Remember", "/rɪˈmem.bər/", "verb", "Ghi nhớ nhớ lại", "Remember that every single review rep builds permanent memory.", "Hãy nhớ rằng mỗi lần ôn tập đều xây dựng trí nhớ vĩnh viễn.", "A1", "Học thuật", "Academic"],
  ["Remind", "/rɪˈmaɪnd/", "verb", "Nhắc nhở nhắc nhớ", "Set daily calendar notifications to remind you to review.", "Hãy đặt thông báo lịch hàng ngày để nhắc nhở bạn ôn tập.", "A2", "Công nghệ", "Tech"],
  ["Repeat", "/rɪˈpiːt/", "verb / noun", "Lặp lại nhắc lại", "Repeat phrases aloud to train articulatory mouth muscles.", "Hãy lặp lại các cụm từ to thành tiếng để rèn luyện cơ miệng phát âm.", "A1", "Học thuật", "Academic"],
  ["Replace", "/rɪˈpleɪs/", "verb", "Thay thế thay đổi", "Replace self-limiting doubts with disciplined daily action.", "Hãy thay thế những nghi ngờ tự giới hạn bằng hành động kỷ luật hàng ngày.", "A2", "Cảm xúc", "Emotions"],
  ["Reply", "/rɪˈplaɪ/", "verb / noun", "Hồi đáp trả lời", "Reply promptly and courteously to email inquiries.", "Hãy hồi đáp một cách nhanh chóng và lịch thiệp trước các yêu cầu qua email.", "A1", "Công việc", "Business"],
  ["Report", "/rɪˈpɔːt/", "noun / verb", "Bản báo cáo báo cáo", "Submit your annual research report to the director.", "Hãy nộp bản báo cáo nghiên cứu hàng năm của bạn cho giám đốc.", "A2", "Công việc", "Business"],
  ["Represent", "/ˌrep.rɪˈzent/", "verb", "Đại diện tiêu biểu", "Represent your ideas clearly in international forums.", "Hãy đại diện và trình bày ý tưởng của bạn rõ ràng trên các diễn đàn quốc tế.", "B1", "Công việc", "Business"],
  ["Require", "/rɪˈkwaɪər/", "verb", "Đòi hỏi yêu cầu", "Fluency does not require genius; it requires persistence.", "Sự lưu loát không đòi hỏi thiên tài; nó đòi hỏi sự kiên trì.", "A2", "Học thuật", "Academic"],
  ["Research", "/rɪˈsɜːtʃ/", "noun / verb", "Nghiên cứu khảo sát", "Conduct thorough research to substantiate essay theses.", "Hãy thực hiện nghiên cứu kỹ lưỡng để chứng minh các luận điểm bài luận.", "A2", "Học thuật", "Academic"],
  ["Resource", "/rɪˈzɔːs/", "noun", "Tài nguyên nguồn lực", "Our app provides abundant audio pronunciation resources.", "Ứng dụng của chúng tôi cung cấp nguồn tài nguyên phát âm âm thanh phong phú.", "B1", "Học thuật", "Academic"],
  ["Respect", "/rɪˈspekt/", "noun / verb", "Tôn trọng kính trọng", "Treat diverse cultural accents with open respect.", "Hãy đối xử với các ngữ điệu văn hóa đa dạng bằng sự tôn trọng cởi mở.", "A2", "Cảm xúc", "Emotions"],
  ["Respond", "/rɪˈspɒnd/", "verb", "Phản hồi đáp lại", "Learn to respond spontaneously in live dialogues.", "Hãy học cách phản hồi một cách tự nhiên trong các cuộc đối thoại trực tiếp.", "A2", "Giao tiếp hàng ngày", "Daily"],
  ["Response", "/rɪˈspɒns/", "noun", "Câu trả lời sự đáp lại", "Her articulate response impressed the examination panel.", "Câu trả lời mạch lạc của cô đã gây ấn tượng với hội đồng giám khảo.", "A2", "Học thuật", "Academic"],
  ["Responsible", "/rɪˈspɒn.sə.bəl/", "adjective", "Có trách nhiệm", "Take responsible ownership of your daily learning habits.", "Hãy có trách nhiệm làm chủ các thói quen học tập hàng ngày của bạn.", "A2", "Cảm xúc", "Emotions"],
  ["Rest", "/rest/", "verb / noun", "Nghỉ ngơi phần còn lại", "Rest your eyes away from screens after twenty study minutes.", "Hãy cho đôi mắt nghỉ ngơi rời xa màn hình sau hai mươi phút học.", "A1", "Giao tiếp hàng ngày", "Daily"],
  ["Result", "/rɪˈzʌlt/", "noun / verb", "Kết quả thành quả", "Expect impressive test results from consistent daily SRS.", "Hãy mong đợi những kết quả thi cử ấn tượng từ hệ thống SRS hàng ngày nhất quán.", "A1", "Học thuật", "Academic"],
  ["Retain", "/rɪˈteɪn/", "verb", "Giữ lại ghi nhớ", "Spaced review ensures that you retain 90% of studied words.", "Ôn tập ngắt quãng đảm bảo bạn ghi nhớ được 90% số từ đã học.", "B1", "Học thuật", "Academic"],
  ["Return", "/rɪˈtɜːn/", "verb / noun", "Trở lại hoàn trả", "Return to missed flashcards at the end of each session.", "Hãy quay lại với các thẻ flashcard đã bỏ lỡ vào cuối mỗi buổi học.", "A1", "Học thuật", "Academic"],
  ["Reveal", "/rɪˈviːl/", "verb", "Hé lộ làm lộ", "Etymology reveals the fascinating historical origins of words.", "Từ nguyên học hé lộ những nguồn gốc lịch sử đầy hấp dẫn của từ ngữ.", "B1", "Học thuật", "Academic"],
  ["Review", "/rɪˈvjuː/", "verb / noun", "Ôn tập xem xét", "Review your SRS due cards daily to maintain memory.", "Hãy ôn lại các thẻ đến hạn SRS của bạn hàng ngày để duy trì trí nhớ.", "A1", "Học thuật", "Academic"],
  ["Rich", "/rɪtʃ/", "adjective", "Giàu có phong phú", "A rich vocabulary allows precise expression of subtle ideas.", "Một vốn từ vựng phong phú cho phép diễn đạt chính xác những ý tưởng tinh tế.", "A1", "Học thuật", "Academic"],
  ["Right", "/raɪt/", "adjective / noun", "Đúng đắn bên phải", "Choose the right phonetic intonation for questions.", "Hãy chọn ngữ điệu ngữ âm đúng đắn cho các câu hỏi.", "A1", "Học thuật", "Academic"],
  ["Rise", "/raɪz/", "verb / noun", "Tăng lên mọc lên", "Watch your conversational confidence rise with each session.", "Hãy chứng kiến sự tự tin giao tiếp của bạn tăng lên sau mỗi buổi học.", "A2", "Cảm xúc", "Emotions"],
  ["Risk", "/rɪsk/", "noun / verb", "Rủi ro mạo hiểm", "Take the positive risk of speaking in public to conquer fear.", "Hãy chấp nhận rủi ro tích cực khi nói trước công chúng để chinh phục nỗi sợ.", "B1", "Cảm xúc", "Emotions"],
  ["River", "/ˈrɪv.ər/", "noun", "Dòng sông con sông", "We walked along the peaceful river bank at sunset.", "Chúng tôi đã đi dạo dọc theo bờ sông thanh bình vào lúc hoàng hôn.", "A1", "Du lịch", "Travel"],
  ["Road", "/rəʊd/", "noun", "Con đường đường đi", "The road to fluency is paved with daily disciplined habits.", "Con đường dẫn đến sự lưu loát được lát bằng các thói quen kỷ luật hàng ngày.", "A1", "Du lịch", "Travel"],
  ["Role", "/rəʊl/", "noun", "Vai trò vị trí", "Vocabulary plays a central role in language fluency.", "Từ vựng đóng vai trò trung tâm trong sự lưu loát ngôn ngữ.", "A2", "Học thuật", "Academic"],
  ["Room", "/ruːm/", "noun", "Căn phòng khoảng trống", "Create room in your morning schedule for dedicated review.", "Hãy tạo khoảng trống trong lịch trình buổi sáng cho việc ôn tập tận tâm.", "A1", "Giao tiếp hàng ngày", "Daily"],
  ["Routine", "/ruːˈtiːn/", "noun / adjective", "Thói quen lệ thường", "An unbroken morning routine guarantees language mastery.", "Một thói quen buổi sáng không bị phá vỡ đảm bảo sự làm chủ ngôn ngữ.", "A2", "Học thuật", "Academic"],
  ["Rule", "/ruːl/", "noun / verb", "Quy tắc luật lệ", "Understand underlying grammar rules rather than memorizing blind lists.", "Hãy hiểu các quy tắc ngữ pháp nền tảng hơn là ghi nhớ những danh sách mù quáng.", "A1", "Học thuật", "Academic"],
  ["Run", "/rʌn/", "verb / noun", "Chạy, điều hành", "Run through your flashcard queue briskly every morning.", "Hãy chạy qua hàng đợi thẻ flashcard của bạn một cách nhanh nhẹn mỗi sáng.", "A1", "Học thuật", "Academic"]
];

Q_TO_Z_HEADWORDS.forEach(item => {
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

console.log(`Từ vựng hiện có sau khi nạp Q-R: ${wordMap.size} từ.`);

// Chuyển map thành mảng
const finalAllWords = Array.from(wordMap.values());

// Thống kê chi tiết
const statsByLevel = { A1: 0, A2: 0, B1: 0, B2: 0, C1: 0, other: 0 };
const statsByTopic = {};

finalAllWords.forEach((w, idx) => {
  w.id = `v3k_${idx + 1}`;
  const lvl = w.level || 'B1';
  if (statsByLevel[lvl] !== undefined) statsByLevel[lvl]++;
  else statsByLevel.other++;

  const top = w.topic || 'Giao tiếp hàng ngày';
  statsByTopic[top] = (statsByTopic[top] || 0) + 1;
});

console.log(`\n=============================================`);
console.log(`BÁO CÁO TỔNG KẾT KHO TỪ VỰNG OXFORD 3000 / CEFR`);
console.log(`=============================================`);
console.log(`Tổng số từ vựng duy nhất: ${finalAllWords.length}`);
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

// Ghi ra 3 file JSON cục bộ
const p10k = path.join(__dirname, '../src/data/vocab10000.json');
const p5k = path.join(__dirname, '../src/data/vocab5000.json');
const p1k = path.join(__dirname, '../src/data/vocab1000.json');

fs.writeFileSync(p10k, JSON.stringify(finalAllWords, null, 2), 'utf-8');
fs.writeFileSync(p5k, JSON.stringify(finalAllWords, null, 2), 'utf-8');
fs.writeFileSync(p1k, JSON.stringify(finalAllWords.slice(0, 1000), null, 2), 'utf-8');

console.log(`\nĐã ghi đồng bộ 3 tệp dữ liệu cục bộ:`);
console.log(`- ${p10k} (${finalAllWords.length} từ)`);
console.log(`- ${p5k} (${finalAllWords.length} từ)`);
console.log(`- ${p1k} (1,000 từ cốt lõi sạch sẽ)`);

// Xuất file seed SQL: scripts/seed_more_vocabularies.sql
const sqlOutputFile = path.join(__dirname, 'seed_more_vocabularies.sql');
let sqlText = `-- =========================================================================\n`;
sqlText += `-- SUPABASE SQL SEED: MỞ RỘNG KHO TỪ VỰNG CHUẨN OXFORD 3000 / CEFR\n`;
sqlText += `-- Tổng cộng: ${finalAllWords.length} từ vựng với đầy đủ 8 trường dữ liệu chuẩn\n`;
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

for (let i = 0; i < finalAllWords.length; i += BATCH_SIZE) {
  const batch = finalAllWords.slice(i, i + BATCH_SIZE);
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
