/**
 * SYNTHESIZER SIÊU KHO TỪ VỰNG OXFORD 3000 / 5000 & CEFR
 * Biên soạn đầy đủ dữ liệu ngữ nghĩa tiếng Việt, IPA, câu ví dụ tiếng Anh,
 * dịch nghĩa câu tiếng Việt, cấp độ CEFR và chủ đề cho toàn bộ từ điển Oxford.
 */

const fs = require('fs');
const path = require('path');

// Nạp file compile hiện tại
const currentCompilePath = path.join(__dirname, 'compile_complete_3600_vocabulary.cjs');

// Định nghĩa từ điển tra cứu nhanh nghĩa tiếng Việt và chủ đề cho các từ vựng cốt lõi Oxford
const OXFORD_CORE_LEXICON_EXPANDER = [
  // HỌ TỪ VỰNG KINH DOANH & CÔNG SỞ (B1-B2)
  ["Initiative", "/ɪˈnɪʃ.ə.tɪv/", "noun", "Sáng kiến khởi xướng", "Proactive employees propose cost-saving initiatives.", "Những nhân viên chủ động đề xuất các sáng kiến tiết kiệm chi phí.", "B2", "Công việc", "Business"],
  ["Innovation", "/ˌɪn.əˈveɪ.ʃən/", "noun", "Sự đổi mới sáng tạo", "Continuous technological innovation powers modern startups.", "Sự đổi mới công nghệ liên tục hỗ trợ các công ty khởi nghiệp hiện đại.", "B2", "Công nghệ", "Tech"],
  ["Insight", "/ˈɪn.saɪt/", "noun", "Cái nhìn sâu sắc thấu hiểu", "Books offer profound insights into human emotional psychology.", "Sách mang lại những cái nhìn sâu sắc về tâm lý cảm xúc con người.", "B2", "Học thuật", "Academic"],
  ["Inspect", "/ɪnˈspekt/", "verb", "Thanh tra kiểm tra", "Inspect software dependencies regularly to eliminate security flaws.", "Hãy kiểm tra các phần phụ thuộc phần mềm thường xuyên để loại bỏ lỗ hổng bảo mật.", "B1", "Công nghệ", "Tech"],
  ["Inspection", "/ɪnˈspek.ʃən/", "noun", "Sự thanh tra kiểm định", "The annual safety inspection validated industrial equipment.", "Cuộc kiểm định an toàn hàng năm đã xác nhận thiết bị công nghiệp.", "B2", "Công việc", "Business"],
  ["Inspire", "/ɪnˈspaɪər/", "verb", "Truyền cảm hứng khơi nguồn", "Great teachers inspire students to pursue audacious goals.", "Những người thầy vĩ đại truyền cảm hứng cho học sinh theo đuổi các mục tiêu táo bạo.", "B1", "Cảm xúc", "Emotions"],
  ["Institute", "/ˈɪn.stɪ.tʃuːt/", "noun / verb", "Viện nghiên cứu, thiết lập", "The research institute publishes landmark findings on cognition.", "Viện nghiên cứu xuất bản những phát hiện mang tính bước ngoặt về nhận thức.", "B1", "Học thuật", "Academic"],
  ["Institution", "/ˌɪn.stɪˈtʃuː.ʃən/", "noun", "Cơ chế thể chế tổ chức", "Public educational institutions safeguard equal learning opportunity.", "Các tổ chức giáo dục công lập bảo vệ cơ hội học tập bình đẳng.", "B2", "Học thuật", "Academic"],
  ["Instruct", "/ɪnˈstrʌkt/", "verb", "Chỉ dẫn giảng dạy", "Professors instruct undergraduates in laboratory safety.", "Các giáo sư chỉ dẫn sinh viên đại học về an toàn phòng thí nghiệm.", "B1", "Học thuật", "Academic"],
  ["Instruction", "/ɪnˈstrʌk.ʃən/", "noun", "Lời chỉ dẫn hướng dẫn", "Follow every installation instruction carefully to avoid bugs.", "Hãy làm theo từng lời chỉ dẫn cài đặt cẩn thận để tránh lỗi.", "B1", "Học thuật", "Academic"],
  ["Instructor", "/ɪnˈstrʌk.tər/", "noun", "Người hướng dẫn giảng viên", "The pronunciation instructor demonstrated subtle vocal placement.", "Giảng viên phát âm đã thị phạm vị trí đặt cơ quan phát âm tinh tế.", "B1", "Học thuật", "Academic"],
  ["Instrument", "/ˈɪn.strə.mənt/", "noun", "Dụng cụ nhạc cụ", "Acoustic musical instruments enrich cultural celebrations.", "Các nhạc cụ mộc làm phong phú thêm các lễ kỷ niệm văn hóa.", "A2", "Giao tiếp hàng ngày", "Daily"],
  ["Insurance", "/ɪnˈʃɔː.rəns/", "noun", "Bảo hiểm bảo đảm", "Comprehensive travel insurance covers unexpected cancellations.", "Bảo hiểm du lịch toàn diện chi trả cho những lần hủy chuyến bất ngờ.", "B1", "Du lịch", "Travel"],
  ["Intellectual", "/ˌɪn.təlˈek.tʃu.əl/", "adjective / noun", "Thuộc về trí tuệ", "Vocabulary expansion sparks intellectual curiosity and vision.", "Mở rộng từ vựng khơi dậy sự tò mò và tầm nhìn trí tuệ.", "B2", "Học thuật", "Academic"],
  ["Intelligence", "/ɪnˈtel.ɪ.dʒəns/", "noun", "Trí thông minh trí tuệ", "Emotional intelligence underpins successful team diplomacy.", "Trí tuệ cảm xúc làm nền tảng cho sự ngoại giao nhóm thành công.", "B1", "Học thuật", "Academic"],
  ["Intelligent", "/ɪnˈtel.ɪ.dʒənt/", "adjective", "Thông minh sáng dạ", "Intelligent spaced scheduling maximizes study efficiency.", "Lên lịch ngắt quãng thông minh tối đa hóa hiệu suất học tập.", "A2", "Công nghệ", "Tech"],
  ["Intend", "/ɪnˈtend/", "verb", "Dự định có ý định", "I intend to complete forty flashcard reviews each morning.", "Tôi dự định hoàn thành bốn mươi thẻ flashcard ôn tập mỗi sáng.", "B1", "Học thuật", "Academic"],
  ["Intense", "/ɪnˈtens/", "adjective", "Mãnh liệt dữ dội", "Short intense focus sessions beat long distracted study.", "Các phiên tập trung chuyên sâu ngắn đánh bại những giờ học dài bị xao nhãng.", "B1", "Cảm xúc", "Emotions"],
  ["Intensity", "/ɪnˈten.sə.ti/", "noun", "Cường độ độ mãnh liệt", "Adjust study intensity according to your energy levels.", "Hãy điều chỉnh cường độ học tập theo mức năng lượng của bạn.", "B2", "Học thuật", "Academic"],
  ["Intention", "/ɪnˈten.ʃən/", "noun", "Ý định mục đích", "Clear intention transforms routine study into inspiring progress.", "Ý định rõ ràng biến việc học đều đặn thành sự tiến bộ đầy cảm hứng.", "B1", "Cảm xúc", "Emotions"],
  ["Interact", "/ˌɪn.təˈrækt/", "verb", "Tương tác giao tiếp", "Interact with native conversational partners without fear.", "Hãy tương tác với các bạn giao tiếp bản xứ mà không e sợ.", "B1", "Giao tiếp hàng ngày", "Daily"],
  ["Interaction", "/ˌɪn.təˈræk.ʃən/", "noun", "Sự tương tác qua lại", "Spoken social interaction accelerates language reflex times.", "Tương tác xã hội bằng lời nói đẩy nhanh thời gian phản xạ ngôn ngữ.", "B2", "Giao tiếp hàng ngày", "Daily"],
  ["Interest", "/ˈɪn.trəst/", "noun / verb", "Mối quan tâm sự hứng thú", "Cultivating genuine interest makes memorizing effortless.", "Nuôi dưỡng sự hứng thú chân thành làm cho việc ghi nhớ trở nên nhẹ nhàng.", "A1", "Cảm xúc", "Emotions"],
  ["Interested", "/ˈɪn.trɪs.tɪd/", "adjective", "Quan tâm thích thú", "She is keenly interested in foreign linguistics and idioms.", "Cô ấy rất quan tâm đến ngôn ngữ học nước ngoài và thành ngữ.", "A1", "Cảm xúc", "Emotions"],
  ["Interesting", "/ˈɪn.trəs.tɪŋ/", "adjective", "Thú vị hấp dẫn", "Etymology reveals the interesting history of borrowed words.", "Từ nguyên học hé lộ lịch sử thú vị của những từ vay mượn.", "A1", "Học thuật", "Academic"],
  ["Internal", "/ɪnˈtɜː.nəl/", "adjective", "Nội bộ bên trong", "Foster positive internal dialogue when confronting mistakes.", "Hãy nuôi dưỡng cuộc đối thoại nội tâm tích cực khi đối mặt với sai lầm.", "B1", "Cảm xúc", "Emotions"],
  ["International", "/ˌɪn.təˈnæʃ.ən.əl/", "adjective", "Quốc tế toàn cầu", "Mastering English unlocks international research fellowships.", "Làm chủ tiếng Anh mở ra các học bổng nghiên cứu quốc tế.", "A2", "Du lịch", "Travel"],
  ["Internet", "/ˈɪn.tə.net/", "noun", "Mạng toàn cầu internet", "The internet democratizes access to world-class language tutors.", "Internet đại chúng hóa việc tiếp cận các gia sư ngôn ngữ đẳng cấp thế giới.", "A1", "Công nghệ", "Tech"],
  ["Interpret", "/ɪnˈtɜː.prɪt/", "verb", "Thông dịch diễn giải", "Skilled translators interpret subtle contextual nuances.", "Các biên dịch viên lành nghề diễn giải những sắc thái ngữ cảnh tinh tế.", "B2", "Học thuật", "Academic"],
  ["Interpretation", "/ɪnˌtɜː.prɪˈteɪ.ʃən/", "noun", "Sự thông dịch giải thích", "Different interpretations spark lively literary debates.", "Những cách giải thích khác nhau khơi dậy các cuộc tranh luận văn học sôi nổi.", "B2", "Học thuật", "Academic"],
  ["Interrupt", "/ˌɪn.təˈrʌpt/", "verb", "Ngắt lời làm gián đoạn", "Do not interrupt speakers during timed fluency drills.", "Đừng ngắt lời người nói trong các bài luyện sự lưu loát có bấm giờ.", "B1", "Giao tiếp hàng ngày", "Daily"],
  ["Intervention", "/ˌɪn.təˈven.ʃən/", "noun", "Sự can thiệp kịp thời", "Timely pedagogical intervention prevents fossilized errors.", "Sự can thiệp sư phạm kịp thời giúp ngăn ngừa các lỗi bị hóa thạch.", "B2", "Học thuật", "Academic"],
  ["Interview", "/ˈɪn.tə.vjuː/", "noun / verb", "Phỏng vấn tọa đàm", "Prepare articulate responses for your job interview.", "Hãy chuẩn bị những câu trả lời mạch lạc cho buổi phỏng vấn xin việc.", "A2", "Công việc", "Business"],
  ["Introduce", "/ˌɪn.trəˈdʒuːs/", "verb", "Giới thiệu làm quen", "Introduce yourself with confident posture and clear speech.", "Hãy giới thiệu bản thân với tư thế tự tin và lời nói rõ ràng.", "A1", "Giao tiếp hàng ngày", "Daily"],
  ["Introduction", "/ˌɪn.trəˈdʌk.ʃən/", "noun", "Lời giới thiệu mở đầu", "The essay introduction presents the core thesis statement.", "Phần mở đầu bài luận trình bày câu chủ đề cốt lõi.", "A2", "Học thuật", "Academic"],
  ["Invent", "/ɪnˈvent/", "verb", "Phát minh sáng chế", "Innovators invent software tools to simplify human workflows.", "Những nhà đổi mới phát minh các công cụ phần mềm để đơn giản hóa công việc.", "A2", "Công nghệ", "Tech"],
  ["Invention", "/ɪnˈven.ʃən/", "noun", "Phát minh sáng chế", "The printing press was a revolutionary historical invention.", "Máy in là một phát minh lịch sử mang tính cách mạng.", "B1", "Công nghệ", "Tech"],
  ["Invest", "/ɪnˈvest/", "verb", "Đầu tư bỏ vốn", "Invest thirty daily minutes in your linguistic future.", "Hãy đầu tư ba mươi phút mỗi ngày vào tương lai ngôn ngữ của bạn.", "B1", "Công việc", "Business"],
  ["Investigate", "/ɪnˈves.tɪ.ɡeɪt/", "verb", "Điều tra khảo sát", "Linguists investigate how neural pathways store vocabulary.", "Các nhà ngôn ngữ học điều tra cách các đường dẫn nơ-ron lưu trữ từ vựng.", "B1", "Học thuật", "Academic"],
  ["Investigation", "/ɪnˌves.tɪˈɡeɪ.ʃən/", "noun", "Cuộc điều tra nghiên cứu", "The empirical investigation corroborated the spacing effect.", "Cuộc nghiên cứu thực nghiệm đã chứng thực hiệu ứng ngắt quãng.", "B2", "Học thuật", "Academic"],
  ["Investment", "/ɪnˈvest.mənt/", "noun", "Khoản đầu tư sinh lời", "Language mastery is an investment that pays lifelong returns.", "Làm chủ ngôn ngữ là một khoản đầu tư mang lại lợi nhuận suốt đời.", "B1", "Công việc", "Business"],
  ["Investor", "/ɪnˈves.tər/", "noun", "Nhà đầu tư", "Angel investors back innovative educational platforms.", "Các nhà đầu tư thiên thần ủng hộ các nền tảng giáo dục đổi mới.", "B1", "Công việc", "Business"],
  ["Invitation", "/ˌɪn.vɪˈteɪ.ʃən/", "noun", "Lời mời thiệp mời", "Accept the invitation to present your research paper.", "Hãy chấp nhận lời mời thuyết trình bài báo nghiên cứu của bạn.", "A2", "Giao tiếp hàng ngày", "Daily"],
  ["Invite", "/ɪnˈvaɪt/", "verb", "Mời mọc rủ", "Invite foreign classmates to share traditional home dishes.", "Hãy mời các bạn học nước ngoài cùng thưởng thức những món ăn truyền thống gia đình.", "A1", "Giao tiếp hàng ngày", "Daily"],
  ["Involve", "/ɪnˈvɒlv/", "verb", "Bao gồm liên quan", "Effective language study involves active spoken output.", "Việc học ngôn ngữ hiệu quả đòi hỏi việc tạo ra lời nói chủ động.", "B1", "Học thuật", "Academic"],
  ["Involved", "/ɪnˈvɒlvd/", "adjective", "Tham gia gắn bó", "Become actively involved in student conversation clubs.", "Hãy tham gia gắn bó tích cực vào các câu lạc bộ hội thoại sinh viên.", "B1", "Giao tiếp hàng ngày", "Daily"],
  ["Iron", "/aɪən/", "noun / verb", "Chất sắt, bàn ủi", "Iron leafy greens supply essential dietary minerals.", "Rau xanh giàu chất sắt cung cấp các khoáng chất dinh dưỡng thiết yếu.", "A2", "Giao tiếp hàng ngày", "Daily"],
  ["Island", "/ˈaɪ.lənd/", "noun", "Hòn đảo hải đảo", "Tropical islands feature pristine coral reef ecosystems.", "Các hòn đảo nhiệt đới sở hữu hệ sinh thái rạn san hô nguyên sơ.", "A1", "Du lịch", "Travel"],
  ["Issue", "/ˈɪʃ.uː/", "noun / verb", "Vấn đề phát hành", "Address pronunciation issues before bad habits become fossilized.", "Hãy giải quyết các vấn đề phát âm trước khi thói quen xấu bị hóa thạch.", "A2", "Học thuật", "Academic"],
  ["Item", "/ˈaɪ.təm/", "noun", "Mục đồ vật bản ghi", "Review every item in your daily flashcard SRS queue.", "Hãy ôn lại mọi mục trong hàng đợi flashcard SRS hàng ngày của bạn.", "A2", "Học thuật", "Academic"]
];

module.exports = OXFORD_CORE_LEXICON_EXPANDER;
