/**
 * Tiện ích làm sạch văn bản, chuẩn hóa nghĩa tiếng Việt & che từ vựng mục tiêu cho Arcade Arena & Flashcards
 */

// Bộ từ điển nghĩa thuần Việt toàn diện cho hàng trăm từ vựng Oxford 3000, 5000 & Academic Word List (AWL)
export const CORE_VOCAB_MEANINGS: Record<string, string> = {
  yield: 'Sinh lợi, sản lượng, nhường đường',
  justify: 'Bào chữa, biện minh, căn lề văn bản',
  adapt: 'Thích nghi, điều chỉnh cho phù hợp',
  observe: 'Quan sát, theo dõi cẩn thận',
  analyze: 'Phân tích chi tiết dữ liệu',
  focus: 'Tập trung, tiêu điểm chú ý',
  enhance: 'Nâng cao, tăng cường chất lượng',
  maintain: 'Duy trì, giữ gìn và bảo dưỡng',
  promote: 'Thúc đẩy, quảng bá và thăng chức',
  resolve: 'Giải quyết triệt để vấn đề',
  acquire: 'Thu nhận, đạt được kỹ năng',
  allocate: 'Phân bổ nguồn lực và ngân sách',
  evaluate: 'Đánh giá định lượng toàn diện',
  assess: 'Thẩm định và lượng giá',
  demonstrate: 'Chứng minh bằng thực tế dẫn chứng',
  expand: 'Mở rộng quy mô và phạm vi',
  integrate: 'Tích hợp và kết hợp hài hòa',
  implement: 'Triển khai và thực thi kế hoạch',
  innovate: 'Đổi mới sáng tạo công nghệ',
  generate: 'Tạo ra, phát sinh dữ liệu',
  optimize: 'Tối ưu hóa hiệu năng hệ thống',
  collaborate: 'Hợp tác chặt chẽ cùng làm việc',
  consolidate: 'Hợp nhất, củng cố vị thế',
  leverage: 'Tận dụng đòn bẩy và thế mạnh',
  mitigate: 'Giảm thiểu rủi ro và thiệt hại',
  facilitate: 'Tạo điều kiện thuận lợi',
  sustain: 'Duy trì bền vững lâu dài',
  synthesize: 'Tổng hợp thông tin từ nhiều nguồn',
  transform: 'Chuyển đổi toàn diện cấu trúc',
  validate: 'Xác thực tính hợp lệ',
  execute: 'Thực thi lệnh hoặc kế hoạch',
  monitor: 'Giám sát liên tục trạng thái',
  establish: 'Thiết lập nền tảng vững chắc',
  navigate: 'Điều hướng và tìm phương hướng',
  accelerate: 'Tăng tốc tiến độ thực hiện',
  benchmark: 'Đối sánh chuẩn hiệu suất',
  restructure: 'Tái cấu trúc bộ máy vận hành',
  prioritize: 'Ưu tiên hạng mục quan trọng',
  streamline: 'Tinh gọn quy trình làm việc',
  communicate: 'Giao tiếp và truyền đạt thông tin',
  coordinate: 'Phối hợp nhịp nhàng các bộ phận',
  formulate: 'Xây dựng và hình thành chiến lược',
  differentiate: 'Phân biệt điểm khác nhau',
  illustrate: 'Minh họa bằng ví dụ thực tế',
  incorporate: 'Tích hợp vào hệ thống chung',
  empower: 'Trao quyền và tiếp thêm năng lực',
  inspire: 'Truyền cảm hứng và động lực',
  deliver: 'Bàn giao sản phẩm đúng hạn',
  accountable: 'Chịu trách nhiệm giải trình',
  accurate: 'Chính xác, chuẩn xác từng chi tiết',
  achieve: 'Đạt được thành tựu, mục tiêu',
  acknowledge: 'Công nhận, thừa nhận sự thật',
  adequate: 'Đầy đủ, thỏa đáng theo yêu cầu',
  advocate: 'Ủng hộ, tán thành công khai',
  aesthetic: 'Thuộc về thẩm mỹ, nghệ thuật',
  afford: 'Đủ khả năng chi trả tài chính',
  aggressive: 'Quyết liệt, xông xáo năng nổ',
  alternative: 'Phương án thay thế, lựa chọn khác',
  apparent: 'Rõ ràng, hiển nhiên thấy được',
  appreciate: 'Đánh giá cao, trân trọng cảm kích',
  appropriate: 'Thích hợp, đúng mực chuẩn mực',
  arbitrary: 'Tùy tiện, độc đoán không căn cứ',
  aspect: 'Khía cạnh, góc độ xem xét',
  assemble: 'Tập hợp, lắp ráp linh kiện',
  attribute: 'Quy cho, thuộc tính đặc trưng',
  authentic: 'Đích thực, chân thật nguyên bản',
  authority: 'Thẩm quyền, cơ quan chức năng',
  available: 'Có sẵn, sẵn sàng sử dụng',
  benefit: 'Lợi ích, phúc lợi hỗ trợ',
  boundary: 'Ranh giới, giới hạn phạm vi',
  capable: 'Có năng lực, có khả năng làm được',
  category: 'Hạng mục, thể loại phân loại',
  challenge: 'Thử thách, thách thức khó khăn',
  channel: 'Kênh truyền tải thông tin',
  clarify: 'Làm rõ, giải thích sáng tỏ',
  cognitive: 'Thuộc về nhận thức, tư duy não bộ',
  coherent: 'Mạch lạc, liên kết chặt chẽ',
  cohesive: 'Gắn kết, đồng lòng đoàn kết',
  commodity: 'Hàng hóa thương mại thiết yếu',
  compatible: 'Tương thích, hòa hợp với nhau',
  compensate: 'Đền bù, bồi thường thiệt hại',
  competent: 'Có đủ năng lực, thành thạo công việc',
  component: 'Thành phần, linh kiện cấu thành',
  compound: 'Hợp chất, phức hợp nhiều phần',
  comprehend: 'Hiểu thấu đáo, lĩnh hội trọn vẹn',
  compromise: 'Thỏa hiệp, nhượng bộ lẫn nhau',
  conceive: 'Hình thành ý niệm, tưởng tượng',
  concentrate: 'Tập trung cao độ tinh thần',
  conclude: 'Kết luận, đúc rút nhận định',
  concurrent: 'Đồng thời xảy ra cùng lúc',
  condition: 'Điều kiện, trạng thái hiện tại',
  conduct: 'Tiến hành, thực hiện nghiên cứu',
  confirm: 'Xác nhận tính chính xác',
  conflict: 'Xung đột, mâu thuẫn bất đồng',
  conform: 'Tuân thủ quy chuẩn chung',
  consent: 'Đồng ý, chấp thuận chính thức',
  consequent: 'Hậu quả kéo theo, kết quả là',
  considerable: 'Đáng kể, to lớn có ý nghĩa',
  consistent: 'Nhất quán, kiên định trước sau',
  constitute: 'Cấu thành, tạo nên tổng thể',
  constrain: 'Bắt buộc, gò bó kiềm chế',
  construct: 'Xây dựng, kiến tạo công trình',
  consult: 'Tham vấn, hỏi ý kiến chuyên gia',
  consume: 'Tiêu thụ, sử dụng năng lượng',
  contact: 'Liên hệ, tiếp xúc giao dịch',
  contemporary: 'Đương đại, cùng thời kỳ',
  context: 'Ngữ cảnh, bối cảnh thực tế',
  contrast: 'Tương phản, đối lập rõ rệt',
  contribute: 'Đóng góp, cống hiến giá trị',
  controversy: 'Tranh cãi, bất đồng dư luận',
  convene: 'Triệu tập cuộc họp hội nghị',
  convert: 'Chuyển đổi hình thức, định dạng',
  convince: 'Thuyết phục người khác tin tưởng',
  core: 'Cốt lõi, trọng tâm trung tâm',
  corporate: 'Thuộc về doanh nghiệp, công ty',
  correspond: 'Tương ứng, trao đổi thư từ',
  crucial: 'Cực kỳ quan trọng, sống còn',
  currency: 'Tiền tệ, sự lưu hành hiện hành',
  decade: 'Thập kỷ, giai đoạn mười năm',
  decline: 'Suy giảm, từ chối lịch sự',
  deduce: 'Suy luận logic từ dữ liệu',
  define: 'Định nghĩa, xác định rõ ràng',
  definite: 'Xác định, rõ ràng dứt khoát',
  discrete: 'Riêng biệt, rời rạc độc lập',
  diverse: 'Đa dạng, phong phú nhiều chủng loại',
  document: 'Tài liệu, dẫn chứng văn bản',
  domain: 'Lĩnh vực chuyên môn, tên miền',
  domestic: 'Nội địa, trong nước gia đình',
  dominate: 'Thống trị, chiếm ưu thế vượt trội',
  duration: 'Khoảng thời gian kéo dài',
  dynamic: 'Năng động, biến đổi liên tục',
  economy: 'Nền kinh tế, sự tiết kiệm',
  eliminate: 'Loại bỏ hoàn toàn triệt tiêu',
  emerge: 'Nổi lên, xuất hiện rõ nét',
  emphasis: 'Sự nhấn mạnh, tầm quan trọng',
  enable: 'Cho phép, tạo điều kiện thực hiện',
  encounter: 'Bắt gặp, chạm trán bất ngờ',
  energy: 'Năng lượng, nhiệt huyết sức sống',
  enforce: 'Thực thi, bắt buộc chấp hành luật',
  ensure: 'Đảm bảo, bảo đảm chắc chắn',
  entity: 'Thực thể, tổ chức độc lập',
  environment: 'Môi trường sống xung quanh',
  equate: 'Đánh đồng, coi như ngang bằng',
  equip: 'Trang bị công cụ dụng cụ',
  equivalent: 'Tương đương về giá trị',
  erode: 'Xói mòn, làm hao mòn dần',
  estate: 'Bất động sản, di sản tài sản',
  estimate: 'Ước tính, dự toán chi phí',
  ethical: 'Thuộc về đạo đức, chuẩn mực',
  evident: 'Hiển nhiên, bằng chứng rõ rệt',
  evolve: 'Tiến hóa, phát triển qua thời gian',
  exceed: 'Vượt quá hạn mức quy định',
  exclude: 'Loại trừ ra ngoài danh sách',
  exhibit: 'Trưng bày, biểu lộ triển lãm',
  explicit: 'Rõ ràng, dứt khoát minh bạch',
  exploit: 'Khai thác, tận dụng triệt để',
  export: 'Xuất khẩu ra thị trường ngoài',
  expose: 'Phơi bày, vạch trần bí mật',
  extend: 'Mở rộng, gia hạn thời gian',
  extract: 'Chiết xuất, trích xuất dữ liệu',
  factor: 'Yếu tố, nhân tố ảnh hưởng',
  feature: 'Đặc điểm nổi bật, tính năng',
  federal: 'Thuộc về liên bang chính phủ',
  flexible: 'Linh hoạt, dễ thích nghi',
  fluctuate: 'Dao động, biến động lên xuống',
  format: 'Định dạng, cách trình bày',
  formula: 'Công thức, phương thức giải quyết',
  foundation: 'Nền móng, tổ chức quỹ sáng lập',
  framework: 'Khung cấu trúc, nền tảng',
  function: 'Chức năng, nhiệm vụ hoạt động',
  fundamental: 'Cơ bản, nền tảng cốt yếu',
  guarantee: 'Bảo hành, cam kết chắc chắn',
  guideline: 'Hướng dẫn, nguyên tắc chỉ đạo',
  hypothesis: 'Giả thuyết khoa học đặt ra',
  identical: 'Giống hệt nhau từng chi tiết',
  identify: 'Nhận diện, xác định danh tính',
  impact: 'Tác động mạnh mẽ, ảnh hưởng',
  implicit: 'Ngầm hiểu, ẩn ý không nói thẳng',
  imply: 'Ám chỉ, ngụ ý bóng gió',
  impose: 'Áp đặt quy định, thuế khóa',
  incentive: 'Chính sách đãi ngộ khích lệ',
  incidence: 'Tỷ lệ xảy ra, tần suất phát sinh',
  income: 'Thu nhập tài chính kiếm được',
  index: 'Chỉ số, bảng mục lục tra cứu',
  indicate: 'Chỉ ra, biểu thị dấu hiệu',
  individual: 'Cá nhân riêng lẻ độc lập',
  induce: 'Gây ra, xui khiến dẫn tới',
  inevitable: 'Không thể tránh khỏi tất yếu',
  infer: 'Suy ra, rút ra kết luận',
  infrastructure: 'Cơ sở hạ tầng kỹ thuật',
  inherent: 'Vốn có, cố hữu bẩm sinh',
  initial: 'Ban đầu, khởi đầu tiên phong',
  initiative: 'Sáng kiến tiên phong khởi xướng',
  injure: 'Làm bị thương, tổn hại sức khỏe',
  input: 'Dữ liệu đầu vào, ý kiến đóng góp',
  insert: 'Chèn vào, lồng ghép thêm',
  insight: 'Thấu hiểu sâu sắc bản chất',
  inspect: 'Thanh tra, kiểm tra kỹ lưỡng',
  instance: 'Ví dụ điển hình, trường hợp cụ thể',
  institute: 'Viện nghiên cứu, học viện',
  instruct: 'Hướng dẫn, chỉ thị thi hành',
  integral: 'Không thể thiếu, trọn vẹn',
  integrity: 'Tính chính trực, toàn vẹn dữ liệu',
  intelligence: 'Trí thông minh, tình báo',
  intensity: 'Cường độ, mức độ mãnh liệt',
  interact: 'Tương tác, giao tiếp qua lại',
  intermediate: 'Trung cấp, mức độ trung gian',
  internal: 'Nội bộ bên trong tổ chức',
  interpret: 'Thông dịch, giải thích ý nghĩa',
  interval: 'Khoảng thời gian nghỉ, quãng',
  intervene: 'Can thiệp vào giải quyết',
  intrinsic: 'Thực chất bên trong bản chất',
  invest: 'Đầu tư vốn và thời gian',
  investigate: 'Điều tra khảo sát vụ việc',
  invoke: 'Kích hoạt, gọi hàm thực thi',
  involve: 'Liên quan, kéo theo bao gồm',
  isolate: 'Cô lập, cách ly biệt lập',
  issue: 'Vấn đề nan giải, số phát hành',
  journal: 'Tạp chí chuyên ngành, nhật ký',
  label: 'Nhãn mác, dán nhãn phân loại',
  labor: 'Lao động, nhân lực làm việc',
  layer: 'Lớp phân tầng trong kiến trúc',
  lecture: 'Bài thuyết trình, bài giảng bài',
  legal: 'Hợp pháp, thuộc về luật pháp',
  legislate: 'Lập pháp, ban hành quy định',
  liberal: 'Tự do, cởi mở phóng khoáng',
  licence: 'Giấy phép hành nghề bản quyền',
  logic: 'Tư duy logic, lập luận hợp lý',
  major: 'Chuyên ngành chính, trọng đại',
  manipulate: 'Thao túng, điều khiển xử lý',
  manual: 'Sách hướng dẫn, thủ công bằng tay',
  margin: 'Biên lợi nhuận, lề trang giấy',
  mature: 'Trưởng thành, chín chắn hoàn thiện',
  maximize: 'Tối đa hóa lợi nhuận năng suất',
  mechanism: 'Cơ chế vận hành, bộ máy',
  media: 'Phương tiện truyền thông đại chúng',
  mediate: 'Làm trung gian hòa giải',
  medical: 'Thuộc về y tế, chăm sóc sức khỏe',
  medium: 'Phương tiện trung gian, mức vừa',
  mental: 'Thuộc về tinh thần, tâm trí',
  method: 'Phương pháp luận khoa học',
  migrate: 'Di cư, di chuyển dữ liệu hệ thống',
  minimal: 'Tối thiểu, mức độ nhỏ nhất',
  minimize: 'Tối thiểu hóa chi phí rủi ro',
  minimum: 'Mức tối thiểu quy định',
  ministry: 'Bộ ban ngành chính phủ',
  minor: 'Thứ yếu, phụ không đáng kể',
  mode: 'Chế độ hoạt động, phương thức',
  modify: 'Chỉnh sửa, điều chỉnh thông số',
  motive: 'Động cơ thúc đẩy hành động',
  mutual: 'Lẫn nhau, có đi có lại',
  negate: 'Phủ nhận, vô hiệu hóa tác dụng',
  network: 'Mạng lưới kết nối giao lưu',
  neutral: 'Trung lập, không thiên vị ai',
  norm: 'Chuẩn mực xã hội, quy tắc',
  notion: 'Khái niệm, quan niệm suy nghĩ',
  nuclear: 'Thuộc về hạt nhân nguyên tử',
  objective: 'Mục tiêu đề ra, khách quan',
  obtain: 'Đạt được, thu thập được',
  obvious: 'Rõ ràng, dễ dàng nhận thấy',
  occupy: 'Chiếm đóng, chiếm giữ không gian',
  occur: 'Xảy ra, xuất hiện phát sinh',
  offset: 'Bù đắp, cân đối khoản chênh lệch',
  ongoing: 'Đang diễn ra liên tục',
  option: 'Lựa chọn, tùy chọn khả thi',
  orient: 'Định hướng mục tiêu hành động',
  outcome: 'Kết quả cuối cùng đạt được',
  output: 'Sản lượng đầu ra thành phẩm',
  overall: 'Tổng thể, nhìn chung toàn diện',
  overlap: 'Chồng chéo, trùng lặp lẫn nhau',
  panel: 'Hội đồng chuyên gia, bảng điều khiển',
  paragraph: 'Đoạn văn hoàn chỉnh trong bài',
  parallel: 'Song song đồng thời cùng chạy',
  parameter: 'Tham số cấu hình hệ thống',
  participate: 'Tham gia, góp mặt đóng góp',
  partner: 'Đối tác kinh doanh đồng hành',
  passive: 'Thụ động, bị động chờ đợi',
  perceive: 'Nhận thức, cảm nhận hiểu được',
  percent: 'Tỷ lệ phần trăm tính toán',
  period: 'Khoảng thời kỳ, giai đoạn',
  persist: 'Kiên trì bền bỉ không bỏ cuộc',
  perspective: 'Góc nhìn, quan điểm cá nhân',
  phase: 'Giai đoạn phát triển dự án',
  phenomenon: 'Hiện tượng tự nhiên kỳ thú',
  philosophy: 'Triết lý sống, hệ tư tưởng',
  physical: 'Thuộc về thể chất, vật lý',
  policy: 'Chính sách quy định ban hành',
  portion: 'Phần chia, khẩu phần phân bổ',
  pose: 'Đưa ra nguy cơ, tạo dáng',
  positive: 'Tích cực, khả quan lạc quan',
  potential: 'Tiềm năng phát triển tương lai',
  precede: 'Đi trước, diễn ra trước đó',
  precise: 'Chính xác tỉ mỉ từng chi tiết',
  predict: 'Dự đoán trước diễn biến',
  preliminary: 'Sơ bộ, bước chuẩn bị đầu tiên',
  presume: 'Phỏng đoán, mặc định cho là',
  previous: 'Trước đó, tiền nhiệm đã qua',
  primary: 'Chính yếu, bậc tiểu học',
  prime: 'Thời kỳ hoàng kim, nguyên tố',
  principal: 'Hiệu trưởng, tiền vốn gốc',
  principle: 'Nguyên lý hoạt động cốt lõi',
  prior: 'Ưu tiên trước, có trước đó',
  priority: 'Sự ưu tiên hàng đầu cần làm',
  proceed: 'Tiếp tục tiến hành công việc',
  process: 'Quy trình các bước thực hiện',
  professional: 'Chuyên nghiệp, có tay nghề cao',
  prohibit: 'Cấm đoán, ngăn cấm nghiêm ngặt',
  project: 'Dự án kế hoạch thực hiện',
  proportion: 'Tỷ lệ tương quan so sánh',
  prospect: 'Triển vọng phát triển sau này',
  protocol: 'Giao thức truyền thông quy ước',
  psychology: 'Tâm lý học con người',
  publication: 'Ấn phẩm sách báo xuất bản',
  publish: 'Xuất bản công bố rộng rãi',
  purchase: 'Mua sắm thanh toán đơn hàng',
  pursue: 'Theo đuổi đam mê mục tiêu',
  qualitative: 'Định tính, thuộc về phẩm chất',
  quote: 'Trích dẫn lời nói, báo giá',
  radical: 'Căn bản, cấp tiến triệt để',
  random: 'Ngẫu nhiên bất kỳ không chọn trước',
  range: 'Phạm vi, dải biến thiên',
  ratio: 'Tỷ số toán học đối sánh',
  rational: 'Hợp lý dựa trên lý trí',
  react: 'Phản ứng đáp lại tác động',
  recover: 'Hồi phục sức khỏe dữ liệu',
  refine: 'Tinh chỉnh, hoàn thiện chi tiết',
  regime: 'Chế độ quản trị, chế độ ăn',
  region: 'Vùng miền, khu vực địa lý',
  register: 'Đăng ký tài khoản thủ tục',
  regulate: 'Quy định điều chỉnh quản lý',
  reinforce: 'Củng cố tăng cường sức mạnh',
  reject: 'Từ chối, bác bỏ đề xuất',
  relax: 'Thư giãn nghỉ ngơi xả stress',
  release: 'Phát hành phiên bản mới',
  relevant: 'Có liên quan, thích đáng',
  reluctance: 'Sự miễn cưỡng ngập ngừng',
  rely: 'Tin cậy dựa dẫm vào ai',
  remove: 'Xóa bỏ, gỡ bỏ thành phần',
  require: 'Yêu cầu đòi hỏi bắt buộc',
  research: 'Nghiên cứu khoa học chuyên sâu',
  reside: 'Cư trú sinh sống tại nơi',
  resource: 'Tài nguyên nguồn lực sẵn có',
  respond: 'Phản hồi, hồi đáp tin nhắn',
  restore: 'Khôi phục lại trạng thái cũ',
  restrain: 'Kiềm chế ngăn chặn hành vi',
  restrict: 'Hạn chế quyền hạn truy cập',
  retain: 'Giữ lại bảo tồn duy trì',
  reveal: 'Tiết lộ bộc lộ bí mật',
  revenue: 'Doanh thu tài chính công ty',
  reverse: 'Đảo ngược tình thế tiến trình',
  revise: 'Ôn tập, sửa đổi văn bản',
  revolution: 'Cuộc cách mạng đổi mới lớn',
  rigid: 'Cứng nhắc khắt khe nghiêm ngặt',
  role: 'Vai trò trọng trách đảm nhận',
  route: 'Lộ trình tuyến đường di chuyển',
  scenario: 'Kịch bản tình huống giả định',
  schedule: 'Lịch trình thời gian biểu',
  scheme: 'Kế hoạch mưu đồ dự án',
  scope: 'Quy mô phạm vi ảnh hưởng',
  section: 'Phần đoạn mục trong tài liệu',
  sector: 'Khu vực ngành nghề kinh tế',
  secure: 'Bảo mật an toàn chắc chắn',
  seek: 'Tìm kiếm, mưu cầu mục tiêu',
  select: 'Lựa chọn phương án tốt nhất',
  sequence: 'Chuỗi trình tự nối tiếp nhau',
  series: 'Chuỗi các sự kiện tập phim',
  shift: 'Ca làm việc, dịch chuyển vị trí',
  significant: 'Có ý nghĩa quan trọng to lớn',
  similar: 'Tương tự giống nhau phần lớn',
  simulate: 'Mô phỏng thử nghiệm thực tế',
  site: 'Địa điểm công trường trang web',
  sole: 'Duy nhất độc nhất vô nhị',
  source: 'Nguồn gốc xuất xứ thông tin',
  specific: 'Cụ thể rõ ràng chi tiết',
  specify: 'Chỉ định cụ thể thông số',
  sphere: 'Hình cầu, phạm vi ảnh hưởng',
  stable: 'Ổn định vững vàng không đổi',
  statistic: 'Số liệu thống kê khoa học',
  status: 'Trạng thái hiện thời địa vị',
  straightforward: 'Thẳng thắn đơn giản dễ hiểu',
  strategy: 'Chiến lược kế hoạch dài hạn',
  stress: 'Căng thẳng áp lực trọng âm',
  structure: 'Cấu trúc kết cấu kiến trúc',
  style: 'Phong cách kiểu cách riêng biệt',
  submit: 'Nộp bài, gửi biểu mẫu đi',
  subsequent: 'Xảy ra sau đó nối tiếp',
  subsidy: 'Trợ cấp tài chính từ nhà nước',
  substitute: 'Vật thay thế người thay thế',
  successor: 'Người kế nhiệm nối nghiệp',
  sufficient: 'Đầy đủ đáp ứng yêu cầu',
  sum: 'Tổng số cộng lại toàn bộ',
  summary: 'Bản tóm tắt nội dung chính',
  supplement: 'Phần bổ sung thêm vào',
  survey: 'Khảo sát ý kiến thị trường',
  survive: 'Sống sót qua cơn nguy kịch',
  suspend: 'Tạm đình chỉ, treo gián đoạn',
  symbol: 'Biểu tượng ký hiệu đặc trưng',
  target: 'Mục tiêu nhắm tới định mức',
  task: 'Nhiệm vụ công việc được giao',
  team: 'Đội nhóm cùng chung chí hướng',
  technical: 'Thuộc về kỹ thuật chuyên môn',
  technique: 'Kỹ thuật kỹ xảo phương pháp',
  technology: 'Công nghệ hiện đại số hóa',
  temporary: 'Tạm thời nhất thời ngắn hạn',
  tense: 'Thời thì ngữ pháp căng thẳng',
  terminate: 'Chấm dứt kết thúc hợp đồng',
  text: 'Văn bản câu chữ tài liệu',
  theme: 'Chủ đề tư tưởng xuyên suốt',
  theory: 'Lý thuyết học thuyết khoa học',
  thesis: 'Luận văn tốt nghiệp tiến sĩ',
  topic: 'Đề tài chủ đề thảo luận',
  trace: 'Dấu vết lần theo nguồn gốc',
  tradition: 'Truyền thống phong tục tập quán',
  transfer: 'Chuyển giao chuyển tiền đi',
  transit: 'Vận chuyển quá cảnh qua nơi',
  transmit: 'Truyền tải tín hiệu dữ liệu',
  transport: 'Giao thông vận tải hàng hóa',
  trend: 'Xu hướng trào lưu thịnh hành',
  trigger: 'Kích hoạt cò súng phát nổ',
  ultimate: 'Tối thượng cuối cùng đỉnh cao',
  undergo: 'Trải qua biến cố phẫu thuật',
  undertake: 'Đảm nhận gánh vác trọng trách',
  uniform: 'Đồng phục, đồng nhất đều đặn',
  unify: 'Thống nhất các mối liên kết',
  unique: 'Độc đáo duy nhất có một không hai',
  utilize: 'Tận dụng khai thác sử dụng',
  valid: 'Hợp lệ còn hạn sử dụng',
  vary: 'Biến đổi thay đổi đa dạng',
  vehicle: 'Phương tiện xe cộ di chuyển',
  version: 'Phiên bản cập nhật phần mềm',
  via: 'Thông qua đường lối trung gian',
  violate: 'Vi phạm quy định luật pháp',
  virtual: 'Ảo trên không gian mạng',
  visible: 'Có thể nhìn thấy rõ ràng',
  vision: 'Tầm nhìn chiến lược thị lực',
  visual: 'Thuộc về thị giác hình ảnh',
  volume: 'Âm lượng thể tích dung lượng',
  voluntary: 'Tự nguyện tình nguyện tham gia',
  welfare: 'Phúc lợi an sinh xã hội',
  widespread: 'Lan rộng phổ biến khắp nơi',
};

export function cleanWordString(word: string): string {
  if (!word || typeof word !== 'string') return '';
  return word
    .replace(/\s*\((?:Set|Batch|Lesson|Unit|Pack)\s*\d+\)/gi, '')
    .replace(/\s*\[(?:Set|Batch|Lesson|Unit|Pack)\s*\d+\]/gi, '')
    .trim();
}

/**
 * Làm sạch nghĩa tiếng Việt cho Word Scramble, SpeedMatch & Quiz:
 * - Tra cứu ngay lập tức bộ từ điển CORE_VOCAB_MEANINGS (chứa 'justify', 'adapt', 'observe'...)
 * - Xóa bỏ triệt để mọi template thừa, text rác và các từ tiếng Anh bọc trong ngoặc kép
 */
export function cleanMeaningForScramble(meaning: string, targetWord?: string): string {
  const cleanTarget = targetWord ? targetWord.toLowerCase().replace(/[^a-zA-Z]/g, '').trim() : '';

  // 1. ƯU TIÊN SỐ 1: Tra cứu trực tiếp từ điển nghĩa chuẩn cốt lõi
  if (cleanTarget && CORE_VOCAB_MEANINGS[cleanTarget]) {
    return CORE_VOCAB_MEANINGS[cleanTarget];
  }

  // 2. Tra cứu từ gốc nếu targetWord có đuôi (ed, ing, s, ly, tion, ment, able)
  if (cleanTarget && cleanTarget.length > 4) {
    const baseCandidates = [
      cleanTarget.replace(/(?:ing|ly|ed|es|s|tion|ment|able|ive)$/, ''),
      cleanTarget.replace(/e?ly$/, ''),
      cleanTarget.replace(/e?d$/, ''),
    ];
    for (const cand of baseCandidates) {
      if (cand && CORE_VOCAB_MEANINGS[cand]) {
        return CORE_VOCAB_MEANINGS[cand];
      }
    }
  }

  if (!meaning || typeof meaning !== 'string') {
    return 'Từ vựng tiếng Anh giao tiếp & học thuật';
  }

  // 3. Làm sạch triệt để các tiền tố rác
  let clean = meaning
    .replace(/^Từ vựng học thuật & giao tiếp thông dụng\s*:\s*/gi, '')
    .replace(/^Khái niệm (?:và|về) ứng dụng nâng cao\s*:\s*/gi, '')
    .replace(/^Khái niệm và ứng dụng thực tiễn\s*[:\-]?\s*/gi, '')
    .replace(/^Khái niệm cơ bản\s*:\s*/gi, '')
    .replace(/^Ứng dụng cốt lõi\s*:\s*/gi, '')
    .replace(/^Từ vựng cốt lõi\s*:\s*/gi, '')
    .replace(/^Định nghĩa\s*:\s*/gi, '')
    .replace(/\s*\((?:Set|Batch|Lesson|Unit|Pack)\s*\d+\)/gi, '')
    .replace(/\s*\[(?:Set|Batch|Lesson|Unit|Pack)\s*\d+\]/gi, '')
    // Xóa từ tiếng Anh bị bọc trong ngoặc kép (ví dụ: "Adapt", "Observe", "Justify")
    .replace(/["'][a-zA-Z\s\-']+["']/g, '')
    .replace(/^[:\-\s]+/, '')
    .trim();

  // 4. Nếu targetWord còn xuất hiện trong nghĩa tiếng Việt, xóa bỏ
  if (cleanTarget && cleanTarget.length >= 3) {
    const escaped = cleanTarget.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const leakRegex = new RegExp(`\\b${escaped}\\b`, 'gi');
    clean = clean.replace(leakRegex, '').replace(/\s{2,}/g, ' ').trim();
  }

  // 5. Nếu chuỗi bị rỗng hoặc còn text rác
  if (clean.length < 3 || /^[a-zA-Z\s\-_:;"']+$/.test(clean) || clean.includes('Khái niệm và ứng dụng')) {
    if (cleanTarget && CORE_VOCAB_MEANINGS[cleanTarget]) {
      return CORE_VOCAB_MEANINGS[cleanTarget];
    }
    return 'Từ vựng thông dụng trong giao tiếp';
  }

  // 6. Lấy mệnh đề chính đầu tiên
  const mainPart = clean.split(/[:;]/)[0].trim();
  return mainPart.length >= 3 ? mainPart : clean;
}

export function sanitizeExampleSentence(sentence: string, targetWord?: string): string {
  if (!sentence || typeof sentence !== 'string') {
    const cleanWord = targetWord ? cleanWordString(targetWord) : 'vocabulary';
    return `Consistent practice with ${cleanWord} enhances your English communication skills.`;
  }

  let clean = sentence
    .replace(/\s*\((?:Set|Batch|Lesson|Unit|Pack)\s*\d+\)/gi, '')
    .replace(/\s*\[(?:Set|Batch|Lesson|Unit|Pack)\s*\d+\]/gi, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([.,!?;:])/g, '$1')
    .trim();

  if (clean && !/[.!?]$/.test(clean)) {
    clean += '.';
  }

  return clean;
}

export interface MaskedSentenceResult {
  maskedSentence: string;
  cleanFullSentence: string;
  targetWordClean: string;
}

export function maskTargetWordInSentence(
  sentence: string,
  targetWord: string
): MaskedSentenceResult {
  const targetWordClean = cleanWordString(targetWord);
  let cleanFullSentence = sanitizeExampleSentence(sentence, targetWordClean);

  if (!targetWordClean) {
    return {
      maskedSentence: cleanFullSentence,
      cleanFullSentence,
      targetWordClean: '',
    };
  }

  const escaped = targetWordClean.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const wordRegex = new RegExp(`\\b${escaped}(?:s|es|ed|d|ing|ly)?\\b`, 'gi');

  let maskedSentence = cleanFullSentence.replace(wordRegex, '[ ________ ]');

  if (maskedSentence === cleanFullSentence) {
    maskedSentence = `Please listen and complete the sentence: "We need to [ ________ ] for optimal results."`;
    cleanFullSentence = `Please listen and complete the sentence: We need to ${targetWordClean} for optimal results.`;
  }

  return {
    maskedSentence,
    cleanFullSentence,
    targetWordClean,
  };
}
