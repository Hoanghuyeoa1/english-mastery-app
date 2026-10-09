import { ReadingLesson } from '../types';

export const c2ReadingLessons: ReadingLesson[] = [
  {
    id: 'read_c2_1',
    title: 'The Crisis of Replicability and the Sociology of Scientific Consensus',
    category: 'Science & Habit',
    level: 'C2',
    readTime: '7.0 phút',
    wordCount: 606,
    summary: 'Khảo sát cuộc khủng hoảng tái lập trong khoa học thực nghiệm, áp lực "công bố hay là chết" (publish or perish), và bản chất xã hội học của sự đồng thuận khoa học theo Thomas Kuhn.',
    content: [
      'The foundational ethos of modern scientific empiricism—immortalized in the motto of the Royal Society, "nullius in verba" (take nobody\'s word for it)—presupposes that empirical truth emerges from transparent methodologies, rigorous peer scrutiny, and, above all, independent replicability. In an idealized epistemology, scientific assertions derive credibility not from institutional prestige or dogmatic consensus, but from the repeatable demonstration of physical phenomena under controlled conditions. Over the past two decades, however, this epistemological architecture has been violently destabilized by what is now formally designated as the "replication crisis." Across social psychology, biomedical oncology, neuroscience, and behavioral economics, large-scale collaborative replication initiatives have systematically demonstrated that an alarming proportion of seminal, highly cited peer-reviewed findings fail to withstand independent empirical re-examination under identical experimental conditions.',
      'The systemic origins of this epistemological fragility are fundamentally structural rather than individual. Contemporary academic institutions enforce hyper-competitive career evaluation metrics colloquially summarized as "publish or perish." Scientific journals overwhelmingly favor novel, statistically significant, and counterintuitive findings, while routinely rejecting null results, statistical ambiguities, and direct replication attempts. This structural asymmetry cultivates pervasive methodological pathologies: the "file-drawer effect," wherein researchers bury non-significant trials; "p-hacking," where statistical data is selectively pruned until arbitrarily significant thresholds (p < .05) are crossed; and HARKing (Hypothesizing After Results are Known), which retroactively converts serendipitous noise into confirmed theoretical predictions. Furthermore, the pervasive reliance on binary null-hypothesis significance testing rather than Bayesian estimations blinds researchers to statistical power deficits and false-positive inflation. Far from being isolated instances of overt fraudulent fabrication, these practices represent rational behavioral adaptations to an academic economy that incentivizes narrative velocity over methodological permanence.',
      'This systemic vulnerability demands a critical engagement with the sociology of science, most cogently articulated in Thomas Kuhn\'s landmark treatise, "The Structure of Scientific Revolutions." Kuhn demonstrated that scientific practice does not advance via a disinterested, cumulative accumulation of verified empirical facts. Rather, scientific communities operate within socially institutionalized "paradigms"—dogmatic theoretical constellations and unexamined metaphysical assumptions that dictate which questions are deemed legitimate, which methodologies are admissible, and what constitutes valid empirical evidence. During periods of "normal science," researchers exhibit intense cognitive resistance to anomalous data. Anomalies that threaten foundational paradigm commitments are frequently minimized, dismissed as investigator incompetence, or explained away with ad hoc hypotheses until an epistemological crisis triggers revolutionary paradigm change.',
      'At an even deeper epistemological level, the replication crisis forces a fundamental reckoning with the demarcation problem originally posed by Karl Popper. Classical falsificationism presupposes that a single recalcitrant observation suffices to topple an entire theoretical edifice; in practice, however, Duhem-Quine underdetermination implies that experimental failures can always be blamed on auxiliary hypotheses, uncalibrated instruments, or confounding environmental variables rather than the core theoretical proposition itself. Consequently, contemporary philosophy of science increasingly eschews naive scientific realism in favor of a social-epistemic reliabilism. Scientific truth is reconceptualized not as an immaculate mirror of nature captured in isolated laboratory eureka moments, but as an asymptotic consensus forged through agonistic peer criticism, robust cross-methodological triangulation, and the relentless institutional weeding out of artifactual statistical noise.',
      'To salvage the credibility of the empirical enterprise from cynical nihilism, scientific governance is undergoing urgent structural reformation. The Open Science movement mandates the preregistration of study hypotheses and experimental designs prior to data gathering, effectively precluding post-hoc statistical manipulation. Prestigious journals are inaugurating "Registered Reports," a publishing format where peer review occurs before data collection and acceptance is guaranteed regardless of statistical significance. Furthermore, methodological reforms champion transparent open-data repositories, rigorous statistical Bayesian inference, and the institutional subsidization of dedicated replication consortia. Ultimately, restoring epistemic integrity requires relinquishing the myth of infallible scientific objectivity and embracing organized skepticism as an agonizing, self-correcting human discipline.'
    ],
    keyVocab: [
      { word: 'Replicability', ipa: '/ˌrep.lɪ.kəˈbɪl.ə.ti/', meaning: 'Khả năng tái lập kết quả thực nghiệm một cách độc lập' },
      { word: 'Epistemology', ipa: '/ɪˌpɪs.təˈmɒl.ə.dʒi/', meaning: 'Nhận thức luận, lý thuyết về bản chất tri thức' },
      { word: 'P-hacking', ipa: '/ˈpiː ˌhæk.ɪŋ/', meaning: 'Thao túng phân tích dữ liệu để đạt ý nghĩa thống kê giả tạo' },
      { word: 'Paradigm', ipa: '/ˈpær.ə.daɪm/ ', meaning: 'Hệ hình tư duy, khuôn mẫu lý thuyết chi phối ngành khoa học' },
      { word: 'Anomalous', ipa: '/əˈnɒm.ə.ləs/', meaning: 'Bất thường, dị biệt, đi chệch khỏi quy luật lý thuyết' }
    ],
    questions: [
      {
        id: 'rq_c2_1_1',
        type: 'main_idea',
        question: 'Which statement best articulates the primary thesis advanced by the author?',
        options: [
          'Scientific empiricism is an irreversible failure and should be replaced by intuitive philosophy',
          'The replication crisis is driven primarily by structural institutional incentives and sociological paradigm defenses rather than isolated moral misconduct, requiring systemic methodological reformation',
          'Academic fraud is exclusively concentrated within biomedical pharmacology labs',
          'Statistical p-values below .05 have mathematically proven that all 20th-century scientific discoveries are completely invalid'
        ],
        correctIndex: 1,
        explanation: 'Luận điểm trung tâm: Khủng hoảng tái lập xuất phát từ cấu trúc động lực thể chế (áp lực công bố) và quán tính bảo vệ hệ hình xã hội học, đòi hỏi cải cách cơ chế mở và đăng ký trước nghiên cứu.'
      },
      {
        id: 'rq_c2_1_2',
        type: 'detail',
        question: 'According to paragraph 2, what does the acronym HARKing refer to in experimental research?',
        options: [
          'Hiding Academic Research Knowledge from public commercial scrutiny',
          'Hypothesizing After Results are Known, which retroactively frames serendipitous patterns as predefined theoretical hypotheses',
          'Halting All Research Kinematics during global clinical trial evaluations',
          'Harnessing Advanced Robotic Kinship models in laboratory automation'
        ],
        correctIndex: 1,
        explanation: 'Đoạn 2 nêu rõ: HARKing là viết tắt của "Hypothesizing After Results are Known" - đặt giả thuyết hồi tố sau khi đã có kết quả để biến nhiễu ngẫu nhiên thành giả thuyết tiên liệu.'
      },
      {
        id: 'rq_c2_1_3',
        type: 'inference',
        question: 'Drawing on Thomas Kuhn\'s perspective discussed in paragraph 3, how does a scientific community in "normal science" typically respond to anomalous data?',
        options: [
          'It immediately discards the established paradigm and accepts the anomalous evidence without hesitation',
          'It displays intense cognitive resistance, often dismissing anomalies as investigator error or explaining them away with ad hoc hypotheses to preserve the prevailing paradigm',
          'It permanently disbands peer-review journals and halts scientific research',
          'It holds public plebiscites to vote democratically on empirical truth'
        ],
        correctIndex: 1,
        explanation: 'Đoạn 3 giải thích theo Thomas Kuhn: trong giai đoạn "khoa học bình thường", cộng đồng khoa học kháng cự dữ liệu dị biệt, coi đó là lỗi của người thực nghiệm hoặc tạo giả thuyết phụ (ad hoc) để bảo vệ hệ hình.'
      },
      {
        id: 'rq_c2_1_4',
        type: 'vocab_context',
        question: 'In paragraph 2, the term "file-drawer effect" describes a phenomenon where:',
        options: [
          'Laboratory equipment is systematically locked away during governmental safety inspections',
          'Studies yielding non-significant or null outcomes are buried and unpublished, leaving the scientific literature biased toward positive findings',
          'Office furniture is mass-produced using discarded academic patent papers',
          'Computer hard drives fail to store digital research files securely'
        ],
        correctIndex: 1,
        explanation: '"File-drawer effect" (hiệu ứng ngăn kéo tủ hồ sơ) chỉ tình trạng các nghiên cứu có kết quả không đáng kể (null results) bị cất giấu không công bố, khiến văn đàn khoa học bị lệch hẳn về các kết quả khẳng định tích cực.'
      },
      {
        id: 'rq_c2_1_5',
        type: 'inference',
        question: 'Why does the author argue that practices like p-hacking and HARKing are not merely "isolated instances of overt fraudulent fabrication"?',
        options: [
          'Because individual scientists are completely blameless for criminal actions',
          'Because these practices represent systemic behavioral adaptations to an academic publishing economy that rewards novel statistical narratives over methodological rigor',
          'Because computer software algorithms execute these calculations without human researcher awareness',
          'Because international legal treaties explicitly protect selective data reporting'
        ],
        correctIndex: 1,
        explanation: 'Đoạn 2 kết luận các hành vi này là sự thích ứng hành vi duy lý đối với một nền kinh tế học thuật ưu tiên tốc độ giật gân hơn độ bền phương pháp ("rational behavioral adaptations to an academic economy...").'
      },
      {
        id: 'rq_c2_1_6',
        type: 'detail',
        question: 'How do "Registered Reports" counteract the publication bias of academic journals according to paragraph 5?',
        options: [
          'By prohibiting the use of statistical mathematics in peer-reviewed articles',
          'By conducting peer review and guaranteeing publication prior to data collection, regardless of whether the final results are statistically significant',
          'By requiring authors to pay massive monetary fees to publish controversial hypotheses',
          'By transferring copyright ownership of all scientific data to international patent conglomerates'
        ],
        correctIndex: 1,
        explanation: 'Đoạn 5 nêu rõ Registered Reports phản biện và chấp nhận xuất bản ngay trước khi thu thập dữ liệu ("peer review occurs before data collection and acceptance is guaranteed regardless of statistical significance").'
      },
      {
        id: 'rq_c2_1_7',
        type: 'inference',
        question: 'In the final sentence, what philosophical disposition does the author conclude is necessary to restore scientific integrity?',
        options: [
          'Blind unquestioning faith in prestigious university authority figures',
          'Relinquishing dogmatic claims of infallible objectivity in favor of organized, self-correcting human skepticism',
          'Total cynicism that treats all empirical observations as meaningless illusions',
          'Replacing empirical investigation with algorithmic computer simulations exclusively'
        ],
        correctIndex: 1,
        explanation: 'Câu kết bài khẳng định tính toàn vẹn đòi hỏi từ bỏ ảo tưởng về tính khách quan tuyệt đối không thể sai lầm để đón nhận sự hoài nghi có tổ chức như một kỷ luật tự sửa sai ("organized skepticism as an agonizing, self-correcting human discipline").'
      }
    ]
  },
  {
    id: 'read_c2_2',
    title: 'Synthetic Biology and the Commodification of Evolutionary Heritage: An Ethical Interrogation',
    category: 'Environment',
    level: 'C2',
    readTime: '7.0 phút',
    wordCount: 629,
    summary: 'Đánh giá đạo đức học sinh học về công nghệ chỉnh sửa gen CRISPR và sinh học tổng hợp: từ can thiệp hệ sinh thái đến nguy cơ thương mại hóa di sản tiến hóa tự nhiên.',
    content: [
      'In the nascent decades of the twenty-first century, the rapid convergence of molecular genetics, automated computational design, and synthetic biology has marked an unprecedented metaphysical transition in human history: humankind has progressed from passively deciphering the genetic code of living systems to actively authoring biological reality. Propelled by precise nucleases such as CRISPR-Cas9, base editors, and synthetic DNA synthesis platforms, biotechnologists no longer merely cultivate or selectively breed organisms; they reconstruct them from programmatic genetic substrates. In laboratories across the globe, scientists are synthesizing artificial bacterial chassis, designing synthetic metabolic pathways, and engineering "gene drives" engineered to deliberately bypass traditional Mendelian inheritance to forcibly propagate engineered genetic alterations across entire wild ecological populations. By transcending evolutionary trial-and-error with directed computer-aided cellular synthesis, molecular bioengineers operate under the premise that organic life is essentially programmable matter, subject to mathematical compilation, functional debugging, and automated refactoring.',
      'The prospective humanitarian dividends heralded by proponents of synthetic biology are undeniably immense. Engineered gene drives targeting vector mosquitoes offer the tantalizing prospect of eradicating malaria and dengue fever, which have plagued human civilizations for millennia. Transgenic agricultural cultivars engineered with synthetic photosynthetic pathways promise drought resilience, nitrogen fixation, and staggering yield increases in arid biomes devastated by climate instability. Furthermore, synthetic microorganisms are being designed for deep bioremediation, capable of metabolizing persistent microplastics, industrial per- and polyfluoroalkyl substances (PFAS), and radioactive heavy metals. Under this utilitarian paradigm, the biosphere is conceived not as a sacrosanct ecological balance, but as a sub-optimal, legacy biological system ripe for rational algorithmic optimization.',
      'Yet this technological prometheanism obfuscates profound ecological and ontological perils. By their very architectural design, CRISPR-based gene drives weaponize synthetic genetics to alter wild ecosystems irreversibly. Unlike localized chemical treatments or static genetically modified organisms confined to monoculture agricultural plots, gene drives are engineered for autonomous, perpetual dissemination across biomes. Once released into open ecological niches, the unintended consequences of wiping out an entire vector species—such as cascading trophic disruptions, unexpected competitive releases of secondary pests, or horizontal gene transfer across species barriers—cannot be recalled or quarantined. Furthermore, because natural selection operates across intricate feedback networks honed over millions of years, eradicating a single target population invariably reverberates across the entire trophic cascade with profound ecological consequences. The hubristic belief that complex, dynamic planetary ecosystems can be calculated and controlled with software predictability represents a catastrophic failure of ecological humility.',
      'Furthermore, this ethical interrogation intersects directly with the philosophical paradigm of the Anthropocene and Hans Jonas\'s classical "Imperative of Responsibility." Jonas argued that modern technological power has introduced human actions of such unprecedented causal scale and temporal irreversibility that traditional anthropocentric ethics—centered purely on immediate human reciprocity—is catastrophically inadequate. In unleashing synthetic gene drives across wild ecological biomes, contemporary humans impose unconsented existential risks onto future generations of both human and non-human life who cannot participate in our regulatory deliberation. When biotechnological intervention permanently alters the evolutionary trajectory of the planet to serve the short-term financial quarterly earnings of private agrochemical monopolies, it commits a profound ontological injustice against the integrity of evolutionary deep time.',
      'Beyond ecological instability looms a severe biopolitical crisis: the wholesale commodification of evolutionary heritage. As private corporate conglomerates patent synthetic genetic sequences, foundational biological regulatory networks, and synthetic organism chassis, the primordial genetic commons of planet Earth is systematically enclosed for speculative private capital. In many instances, synthetic biology practices reproduce historic dynamics of "biopiracy," extracting indigenous ecological knowledge and genetic material from developing nations, patenting their modified chemical derivatives in Western laboratories, and leasing them back to the global South at extortionate royalty rates. To avert an era of privatized genetic feudalism, the international community must formulate a binding multilateral governance architecture rooted in the precautionary principle, rigorous biosafety oversight, and democratic sovereignty over the common heritage of life.'
    ],
    keyVocab: [
      { word: 'Prometheanism', ipa: '/prəˈmiː.θi.ə.nɪ.zəm/', meaning: 'Chủ nghĩa Prometheus (tham vọng chinh phục và tái cấu trúc tự nhiên bằng công nghệ)' },
      { word: 'Substrate', ipa: '/ˈsʌb.streɪt/', meaning: 'Cơ chất, chất nền nền tảng' },
      { word: 'Mendelian', ipa: '/menˈdiː.li.ən/', meaning: 'Thuộc về quy luật di truyền phân ly độc lập của Mendel' },
      { word: 'Commodification', ipa: '/kəˌmɒd.ɪ.fɪˈkeɪ.ʃən/', meaning: 'Sự hàng hóa hóa, biến các giá trị tự nhiên thành hàng hóa thương mại' },
      { word: 'Biopiracy', ipa: '/ˌbaɪ.əʊˈpaɪ.rə.si/', meaning: 'Cướp bóc sinh học, chiếm đoạt nguồn gen và tri thức bản địa phi đạo đức' }
    ],
    questions: [
      {
        id: 'rq_c2_2_1',
        type: 'main_idea',
        question: 'Which of the following best synthesizes the central ethical interrogation presented in the article?',
        options: [
          'Synthetic biology is completely devoid of practical applications and should be globally banned without exception',
          'While synthetic biology offers remarkable humanitarian promises, its irreversible ecological risks and corporate commodification of evolutionary commons necessitate precautionary multilateral governance',
          'Gene drives are completely safe because laboratory computer models can predict all ecological mutations with 100% precision',
          'Developing nations should bear the entire financial cost of global biotechnology patent regulation'
        ],
        correctIndex: 1,
        explanation: 'Luận điểm chính: Sinh học tổng hợp hứa hẹn nhiều lợi ích nhưng chứa đựng nguy cơ sinh thái không thể đảo ngược và sự thương mại hóa di sản tiến hóa, đòi hỏi quản trị đa phương dựa trên nguyên tắc phòng ngừa.'
      },
      {
        id: 'rq_c2_2_2',
        type: 'detail',
        question: 'According to paragraph 1, how do engineered gene drives fundamentally diverge from traditional Mendelian genetics?',
        options: [
          'They only function inside frozen laboratory test tubes without affecting living cells',
          'They bypass Mendelian inheritance to forcibly propagate engineered alterations through wild populations at near-total transmission rates',
          'They strictly preserve the natural 50% probability of parental allele inheritance across generations',
          'They prevent organisms from reproducing sexually in natural habitats'
        ],
        correctIndex: 1,
        explanation: 'Đoạn 1 nêu rõ gene drives "deliberately bypass traditional Mendelian inheritance to forcibly propagate engineered genetic alterations across entire wild ecological populations".'
      },
      {
        id: 'rq_c2_2_3',
        type: 'inference',
        question: 'In paragraph 2, why does the author describe the view of the biosphere as "legacy biological system ripe for rational algorithmic optimization" as a form of utilitarian hubris?',
        options: [
          'Because software engineers are incapable of understanding basic cellular biology',
          'Because it reduces intricate, self-regulating planetary ecosystems to defective computer code that humans can master without unintended systemic catastrophes',
          'Because legacy software systems are legally protected by international copyright conventions',
          'Because biological organisms run exclusively on electrical circuits'
        ],
        correctIndex: 1,
        explanation: 'Đoạn 2 & 3 phê phán cái nhìn coi sinh quyển như phần mềm lỗi cần tối ưu thuật toán, thể hiện sự ngạo mạn công nghệ xem nhẹ tính phức tạp khôn lường của hệ sinh thái.'
      },
      {
        id: 'rq_c2_2_4',
        type: 'vocab_context',
        question: 'In paragraph 5, the term "biopiracy" denotes:',
        options: [
          'The illegal armed hijacking of commercial cargo vessels transporting agricultural fertilizers',
          'The unethical appropriation, patenting, and commercialization of indigenous genetic resources and traditional ecological knowledge without equitable consent',
          'The unauthorized digital downloading of peer-reviewed scientific textbooks from internet servers',
          'The intentional release of harmful bacterial pathogens into municipal water reservoirs'
        ],
        correctIndex: 1,
        explanation: '"Biopiracy" chỉ hành vi chiếm đoạt phi đạo đức nguồn gen bản địa và tri thức sinh thái của các nước đang phát triển để cấp bằng sáng chế kiếm lời mà không có sự đồng thuận thỏa đáng.'
      },
      {
        id: 'rq_c2_2_5',
        type: 'inference',
        question: 'What distinction does the author draw between traditional genetically modified crops and gene-drive organisms in paragraph 3?',
        options: [
          'Traditional GMOs are significantly more toxic to human health than gene drives',
          'Traditional GMOs remain largely confined to controlled agricultural plots, whereas gene drives are engineered for autonomous, irreversible dissemination across wild biomes',
          'Gene drives can be easily deactivated using commercial aerial pesticides',
          'Traditional GMO crops do not contain any synthetic DNA nucleotides'
        ],
        correctIndex: 1,
        explanation: 'Đoạn 3 phân biệt: Cây trồng biến đổi gen truyền thống được khoanh vùng trong ruộng trọt, còn gene drive được thiết kế để tự động lây lan vĩnh viễn và không thể thu hồi trong tự nhiên.'
      },
      {
        id: 'rq_c2_2_6',
        type: 'detail',
        question: 'According to paragraph 5, what socio-economic danger arises when multinational conglomerates patent foundational genetic sequences?',
        options: [
          'It leads to the immediate collapse of global stock exchanges',
          'It privatizes the evolutionary genetic commons, fostering a regime of monopolistic genetic feudalism that exploits developing countries',
          'It forces all university professors to work exclusively for governmental military departments',
          'It renders all digital computational software obsolete within months'
        ],
        correctIndex: 1,
        explanation: 'Đoạn 5 cảnh báo việc độc quyền sáng chế nguồn gen biến di sản tiến hóa thành tài sản đầu cơ tư nhân, tạo ra chế độ "phong kiến di truyền" bóc lột thế giới thứ ba.'
      },
      {
        id: 'rq_c2_2_7',
        type: 'inference',
        question: 'What overarching governance framework does the author advocate in the conclusion to safeguard humanity\'s biological future?',
        options: [
          'A totally unregulated free-market competitive environment with zero governmental oversight',
          'A legally binding multilateral governance regime anchored in the precautionary principle and democratic stewardship of life\'s common heritage',
          'A military moratorium that halts all biological education in global high schools',
          'A voluntary corporate pledge signed by biotechnology CEOs every five years'
        ],
        correctIndex: 1,
        explanation: 'Đoạn cuối khẳng định cần một cơ chế quản trị đa phương ràng buộc pháp lý dựa trên nguyên tắc phòng ngừa (precautionary principle) và quyền làm chủ dân chủ với di sản chung của sự sống.'
      }
    ]
  },
  {
    id: 'read_c2_3',
    title: 'The Panopticon Revisited: Surveillance Capitalism and the Erosion of Democratic Agency',
    category: 'Culture & Society',
    level: 'C2',
    readTime: '7.0 phút',
    wordCount: 609,
    summary: 'Phân tích mô hình Chủ nghĩa Tư bản Giám sát của Shoshana Zuboff: từ việc khai thác thặng dư hành vi đến sự xâm thực quyền tự quyết và nền tảng dân chủ tự do.',
    content: [
      'In late-eighteenth-century penal philosophy, Jeremy Bentham conceptualized the "Panopticon"—an architectural design wherein inmates in radial circular cells were subject to perpetual, unverifiable observation by an unseen central inspector. A century and a half later, philosopher Michel Foucault seized upon Bentham\'s prison as the archetypal architectural diagram of modern disciplinary power, demonstrating how institutional surveillance produces internalized obedience and self-policing subjects. Where Bentham\'s original architectural blueprint operated within physical architectural confinement, surveillance capitalism operates through seamless digital ubiquity, weaving behavioral extraction into the essential fabric of mundane daily existence. In the contemporary digital epoch, surveillance has broken out of physical disciplinary enclosures, transmuting from a carceral apparatus of state discipline into the pervasive market engine of global commerce: an unprecedented economic logic that sociologist Shoshana Zuboff conceptualizes as "Surveillance Capitalism."',
      'Under surveillance capitalism, digital network platforms no longer primarily monetize user fees, software licensing, or even targeted product merchandising. Instead, they unilaterally claim raw human private experience as cost-free foundational material for behavioral extraction. Every keystroke, search query, physical geolocation coordinate, interaction dwell time, facial micromovement, and ambient acoustic snippet is harvested as "behavioral surplus." This computational apparatus creates what Zuboff terms an unprecedented "division of learning in society," where tech monopolies know everything about our behavioral inclinations, while we know virtually nothing about their algorithmic architectures of prediction. This colossal torrent of behavioral telemetry is routed through proprietary artificial intelligence pipelines that compute predictive behavioral profiles. These profiles are subsequently packaged and auctioned in what Zuboff terms "behavioral futures markets"—lucrative speculative exchanges where commercial and political actors trade not in physical manufactured commodities, but in targeted guarantees of future human behavior.',
      'The existential peril of this regime lies not merely in the loss of informational privacy, but in the mutation of human agency and the erosion of liberal democracy. As algorithmic surveillance platforms perfected predictive diagnostics, their commercial imperatives inevitably evolved toward behavioral modification and actuation. Through what Zuboff designates as "instrumentarian power," automated platforms deploy algorithmic nudging, automated behavioral tuning, emotional contagion experiments, and synthetic micro-targeting to shape human conduct without physical coercion. When automated digital architectures choreograph the epistemic horizons of millions of citizens—deciding which ideological narratives are amplified and which are silenced—the foundational cornerstone of democratic self-governance, the autonomous reflective citizen capable of uncoerced political deliberation, is systematically dismantled.',
      'At its most catastrophic civilizational frontier, surveillance capitalism dismantles what political theorist Hannah Arendt termed the "common world"—the shared factual reality that constitutes the indispensable prerequisite for public political deliberation. By atomizing citizens into algorithmic filter bubbles tailored to trigger instinctual outrage and confirmation bias, surveillance platforms fracture the collective epistemic commons into mutually hostile ideological fiefdoms incapable of civil discourse. Without a shared consensus on basic empirical facts, democratic compromise becomes structurally impossible, replaced by tribal antipathy and affective polarization. To preserve human freedom in an age of automated behavioral engineering, international legal theorists argue that human rights jurisprudence must evolve beyond physical habeas corpus to encompass "cognitive liberty"—the fundamental, inalienable right to mental self-determination, cognitive privacy, and psychological sanctuary free from automated behavioral modification.',
      'Confronting this civilizational crisis requires moving past the anachronistic fiction of "individual consumer choice." Modern terms-of-service agreements and privacy settings represent fraudulent contractual illusions of consent, designed to disguise non-negotiable systemic extraction behind legal obfuscation. Individual privacy cannot be salvaged through individual consumer vigilance; it demands collective political insurrection and democratic constitutional reclamation. Democratic states must enact structural prohibitions that outlaw behavioral futures markets, designate digital telemetry extraction as a fundamental rights violation, and establish an inviolable constitutional sanctuary for human interiority. Without decisive democratic reassertion over digital architecture, society will capitulate to an automated algorithmic totalitarianism masked as consumer convenience.'
    ],
    keyVocab: [
      { word: 'Panopticon', ipa: '/pænˈɒp.tɪ.kɒn/', meaning: 'Mô hình nhà tù toàn thị (quan sát toàn diện)' },
      { word: 'Behavioral surplus', ipa: '/bɪˈheɪ.vjər.əl ˈsɜː.pləs/', meaning: 'Thặng dư hành vi (dữ liệu vượt quá nhu cầu cải thiện dịch vụ)' },
      { word: 'Instrumentarian', ipa: '/ˌɪn.strə.menˈteə.ri.ən/', meaning: 'Quyền lực công cụ hóa hành vi con người' },
      { word: 'Contagion', ipa: '/kənˈteɪ.dʒən/', meaning: 'Sự lây lan tâm lý, cảm xúc trên diện rộng' },
      { word: 'Interiority', ipa: '/ɪnˌtɪə.riˈɒr.ə.ti/', meaning: 'Thế giới nội tâm, đời sống tinh thần bất khả xâm phạm' }
    ],
    questions: [
      {
        id: 'rq_c2_3_1',
        type: 'main_idea',
        question: 'What is the central thesis of the essay regarding surveillance capitalism?',
        options: [
          'Social media platforms improve democratic voter turnout by providing free digital news updates',
          'Surveillance capitalism extracts private human experience as behavioral surplus to trade in predictive futures markets, ultimately mutating human agency and undermining democratic self-governance',
          'Jeremy Bentham\'s 18th-century prison architecture remains the most efficient model for modern public schools',
          'Computer cybersecurity software can completely protect individual citizens from commercial data collection'
        ],
        correctIndex: 1,
        explanation: 'Luận điểm trung tâm: Chủ nghĩa tư bản giám sát biến trải nghiệm cá nhân thành thặng dư hành vi để buôn bán tương lai hành vi, từ đó biến đổi quyền tự quyết của con người và hủy hoại nền dân chủ tự do.'
      },
      {
        id: 'rq_c2_3_2',
        type: 'detail',
        question: 'According to paragraph 2, what constitutes "behavioral surplus" in the operation of digital platforms?',
        options: [
          'Unsold physical hardware computers stored in company warehouses',
          'The vast telemetry of raw user experience—such as search history, dwell times, facial micromovements, and geolocation—harvested beyond what is needed for direct service improvements',
          'The financial bonuses distributed to software engineers at the end of fiscal quarters',
          'The excess electrical power generated by data center cooling fans'
        ],
        correctIndex: 1,
        explanation: 'Đoạn 2 nêu rõ: "behavioral surplus" là dòng dữ liệu hành vi khổng lồ (tọa độ, thời gian dừng, vi cử chỉ khuôn mặt, âm thanh xung quanh) được khai thác triệt để vượt xa nhu cầu cải tiến tính năng thuần túy.'
      },
      {
        id: 'rq_c2_3_3',
        type: 'inference',
        question: 'How does Zuboff\'s concept of "instrumentarian power" diverge from the classical Foucauldian panoptic discipline described in paragraph 1?',
        options: [
          'Foucauldian discipline relies on physical violence, whereas instrumentarian power uses physical confinement cells',
          'Foucauldian panopticism enforces internalized obedience through feared surveillance, whereas instrumentarian power uses automated digital nudging to tune and modify behavior without physical coercion',
          'Instrumentarian power is exclusively employed by ancient monarchies rather than corporate entities',
          'Foucault believed that surveillance was beneficial for spiritual enlightenment'
        ],
        correctIndex: 1,
        explanation: 'Đoạn 1 & 3 chỉ ra: Kỷ luật toàn thị cổ điển dựa vào nỗi sợ bị quan sát để nội tâm hóa sự tuân phục, trong khi quyền lực công cụ hóa (instrumentarian) dùng thuật toán vi điều chỉnh, gài bẫy hành vi mà người dùng không hề hay biết.'
      },
      {
        id: 'rq_c2_3_4',
        type: 'vocab_context',
        question: 'In paragraph 2, the term "behavioral futures markets" refers to:',
        options: [
          'Stock trading exchanges that invest exclusively in robotics manufacturing startups',
          'Lucrative commercial and political markets that trade in algorithmic predictions and guarantees of future human behavior',
          'Psychology clinics that treat compulsive gambling addictions in adolescents',
          'Agricultural futures contracts for grain harvested using automated combine tractors'
        ],
        correctIndex: 1,
        explanation: '"Behavioral futures markets" là các sàn giao dịch tương lai hành vi, nơi các tác nhân chính trị và thương mại mua bán các cam kết xác suất về hành vi tương lai của con người.'
      },
      {
        id: 'rq_c2_3_5',
        type: 'inference',
        question: 'Why does the author characterize terms-of-service agreements in paragraph 5 as a "fraudulent contractual illusion of consent"?',
        options: [
          'Because user agreement texts are written in ancient classical Latin',
          'Because they present systemic, non-negotiable data extraction as a voluntary consumer choice while concealing reality behind dense legal obfuscation',
          'Because software companies refuse to allow users to sign agreements with physical fountain pens',
          'Because national postal services fail to deliver printed copies to consumers\' mailboxes'
        ],
        correctIndex: 1,
        explanation: 'Đoạn 5 nêu: Các điều khoản sử dụng là ảo tưởng gian dối về sự đồng thuận vì chúng ngụy trang việc khai thác mang tính áp đặt hệ thống dưới vỏ bọc lựa chọn tiêu dùng tự nguyện bằng ngôn từ pháp lý rắc rối.'
      },
      {
        id: 'rq_c2_3_6',
        type: 'detail',
        question: 'How does algorithmic surveillance threaten the core foundation of democratic society according to paragraph 3?',
        options: [
          'By raising the cost of paper ballots during national elections',
          'By choreographing epistemic horizons and micro-targeting voters, which dismantles the autonomous, reflective capacity required for genuine democratic self-governance',
          'By preventing political candidates from purchasing broadcast television commercials',
          'By replacing judicial supreme courts with automated calculator machines'
        ],
        correctIndex: 1,
        explanation: 'Đoạn 3 phân tích: Khi thuật toán thao túng chân trời nhận thức và điều hướng hành vi cử tri, năng lực tự chủ và suy ngẫm độc lập của công dân - nền tảng của tự trị dân chủ - bị triệt tiêu.'
      },
      {
        id: 'rq_c2_3_7',
        type: 'vocab_context',
        question: 'In the final paragraph, the phrase "sanctuary for human interiority" suggests that:',
        options: [
          'Modern architects must construct soundproof meditation rooms inside corporate high-rises',
          'The innermost thoughts, emotions, and consciousness of human beings must be granted absolute legal and constitutional protection from digital surveillance and manipulation',
          'Citizens should physically relocate from cities to isolated monastery compounds',
          'Smartphones should be permanently manufactured with wooden casing materials'
        ],
        correctIndex: 1,
        explanation: '"Sanctuary for human interiority" ngụ ý thế giới nội tâm, tâm tư và ý thức con người phải được hiến định như một thánh địa bất khả xâm phạm trước sự giám sát và thao túng kỹ thuật số.'
      }
    ]
  },
  {
    id: 'read_c2_4',
    title: 'The Hermeneutics of Suspicion: Narrative Indeterminacy in Modernist Literature',
    category: 'Education',
    level: 'C2',
    readTime: '7.0 phút',
    wordCount: 613,
    summary: 'Khám phá "Thuật giải thông học về sự ngờ vực" của Paul Ricœur qua các bậc thầy Marx, Nietzsche, Freud và cách chủ nghĩa hiện đại phá vỡ tính thẩm quyền của người kể chuyện.',
    content: [
      'In his seminal 1965 philosophical inquiry into interpretation, French hermeneutic philosopher Paul Ricœur coined the enduring formulation "the hermeneutics of suspicion" to designate a radical epistemological posture that systematically repudiates the transparent, prima facie veracity of cultural texts. Grouping Karl Marx, Friedrich Nietzsche, and Sigmund Freud as the three primordial "masters of suspicion," Ricœur demonstrated that despite their profound ideological divergences, all three thinkers shared a transformative diagnostic methodology: conscious assertions, moral orthodoxies, and cultural symbols do not reveal authentic truth; rather, they serve as ideological mystifications that mask subterranean economic class antagonisms, unacknowledged wills to power, or repressed psychosexual pathology. In this hermeneutic paradigm, the primary role of the critical philosopher shifts from constructive system-building to relentless diagnostic demystification, peering behind sanctified aesthetic and ethical veneers to lay bare the unacknowledged psychological or socio-economic interests at play.',
      'This philosophical suspicion exercised a seismic, convulsive impact on early twentieth-century literary architecture. The nineteenth-century realist novel—typified by the confident social panoramas of Balzac, Tolstoy, and George Eliot—had rested upon the comforting epistemological premise of an omniscient, morally coherent narrator whose objective vantage point mirrored a rationally ordered universe. Modernist prose architects, confronted by the catastrophic mechanized trauma of World War I and the collapse of metaphysical certitudes, violently demolished this narratorial scaffolding. In the groundbreaking masterworks of James Joyce, Virginia Woolf, William Faulkner, and Franz Kafka, narratorial omniscience was decisively supplanted by fragmented multiperspectivalism, associative stream of consciousness, and famously compromised, unreliable narrators. Rather than providing the reader with a comforting, transparent lens onto an orderly universe, the modernist text functions as an epistemological labyrinth where every assertion is colored by subjective distortion and historical contingency.',
      'Through these deliberate formal dislocations, narrative indeterminacy ceased to be an accidental structural defect and emerged as a rigorous ontological thesis: human subjective experience is inherently ambiguous, fragmented, and recalcitrant to dogmatic totalization. In Kafka\'s parabolic allegories, characters navigate absurd bureaucratic mazes stripped of identifiable transgressions or sovereign adjudicators. In Woolf\'s impressionistic cadences, the objective solidity of external physical reality dissolves into shimmering, transient perceptions of interior time. By refusing to deliver tidy didactic conclusions or omniscient moral adjudications, modernist literature forces the reader into an exhausting, active hermeneutic entanglement, demanding that meaning be forged through interpretive struggle rather than passively absorbed as moral dogma.',
      'This dialectical tension between deconstructive suspicion and meaningful recovery speaks directly to Theodor Adorno\'s celebrated warning regarding the totalizing perils of instrumental reason. When literary criticism degenerates into an automated ritual of ideological unmasking, it paradoxically mirrors the very bureaucratic, instrumental logic it purports to resist: reducing the sublime polyphony of art to a sterile forensic catalog of socio-historical symptoms. Modernist narrative indeterminacy reminds us that literature\'s ultimate ethical potency resides precisely in its refusal of total conceptual capture. By holding open spaces of aesthetic irresolution, enigma, and imaginative hospitality, the great works of literary modernism teach readers to dwell comfortably within uncertainty—cultivating an empathetic negative capability that resists simplistic dogmatic fundamentalisms in an increasingly polarized world.',
      'However, this persistent critical unmasking carries acute cultural and educational dilemmas. In contemporary pedagogical discourse, radical deconstruction risks ossifying into a nihilistic solipsism where literary interpretation terminates exclusively in cynical exposure, reducing every nuanced literary achievement to an index of political subjugation or ideological bad faith. In response, Ricœur himself insisted that suspicion was not an ultimate terminus, but an indispensable dialectical purgation: a necessary threshold designed to shatter naive dogmatism and clear the ground for a subsequent "hermeneutics of retrieval" or a "second naiveté." True critical literacy, therefore, does not culminate in cynical detachment; rather, it moves through the fires of suspicion to recover authentic, critically audited wonder, renewed poetic resonance, and deep existential solidarity.'
    ],
    keyVocab: [
      { word: 'Hermeneutics', ipa: '/ˌhɜː.məˈnjuː.tɪks/', meaning: 'Thông giải học, khoa học và nghệ thuật diễn giải văn bản' },
      { word: 'Prima facie', ipa: '/ˌpraɪ.mə ˈfeɪ.ʃi/', meaning: 'Thoạt nhìn, ấn tượng ban đầu trước khi thẩm tra sâu' },
      { word: 'Omniscient', ipa: '/ɒmˈnɪs.i.ənt/', meaning: 'Toàn tri, biết hết mọi diễn biến và suy nghĩ của nhân vật' },
      { word: 'Indeterminacy', ipa: '/ˌɪn.dɪˈtɜː.mɪ.nə.si/', meaning: 'Tính bất định, tính không thể quy định dứt khoát' },
      { word: 'Solipsism', ipa: '/ˈsɒl.ɪp.sɪ.zəm/', meaning: 'Thuyết duy ngã (tin rằng chỉ có tâm trí của chính mình tồn tại)' }
    ],
    questions: [
      {
        id: 'rq_c2_4_1',
        type: 'main_idea',
        question: 'Which statement most accurately expresses the overarching thesis of the passage?',
        options: [
          'Modernist novels are inferior to 19th-century realist literature because they lack clear moral endings',
          'The hermeneutics of suspicion revolutionized literature by replacing omniscient narrators with narrative indeterminacy, a critical posture that must balance deconstructive skepticism with the recovery of profound meaning',
          'Karl Marx and Sigmund Freud wrote multiple successful modernist fiction novels in early twentieth-century Paris',
          'Literary theory has proven that human language cannot communicate any coherent thoughts between individuals'
        ],
        correctIndex: 1,
        explanation: 'Luận điểm trung tâm: Thông giải học ngờ vực làm thay đổi cấu trúc văn học bằng cách thay thế người kể chuyện toàn tri bằng tính bất định trần thuật, và thái độ phê phán này cần cân bằng giữa bóc trần hoài nghi và thu hồi ý nghĩa sâu sắc.'
      },
      {
        id: 'rq_c2_4_2',
        type: 'detail',
        question: 'According to paragraph 1, who are the three figures identified by Paul Ricœur as the "masters of suspicion"?',
        options: [
          'James Joyce, Virginia Woolf, and Franz Kafka',
          'Karl Marx, Friedrich Nietzsche, and Sigmund Freud',
          'Honoré de Balzac, Leo Tolstoy, and George Eliot',
          'Aristotle, Plato, and Socrates'
        ],
        correctIndex: 1,
        explanation: 'Đoạn 1 nêu rõ: Ba bậc thầy của sự ngờ vực do Ricœur chỉ định là Karl Marx, Friedrich Nietzsche, và Sigmund Freud.'
      },
      {
        id: 'rq_c2_4_3',
        type: 'inference',
        question: 'Why did modernist writers abandon the omniscient narrator typical of nineteenth-century realist novels according to paragraph 2?',
        options: [
          'Because printing presses lacked the typographical fonts needed for third-person pronouns',
          'Because the trauma of World War I and the collapse of metaphysical certitudes made the concept of a single, all-knowing objective vantage point intellectually unviable',
          'Because national governments censored all books containing omniscient narrators',
          'Because 19th-century novels were too short to satisfy commercial publishing requirements'
        ],
        correctIndex: 1,
        explanation: 'Đoạn 2 giải thích: Chấn thương cơ giới hóa của Thế chiến I và sự sụp đổ của các xác tín siêu hình học khiến điểm nhìn toàn tri khách quan không còn giá trị chân thực.'
      },
      {
        id: 'rq_c2_4_4',
        type: 'vocab_context',
        question: 'In paragraph 2, the phrase "stream of consciousness" refers to a literary technique that:',
        options: [
          'Describes the physical flow of river water through agricultural irrigation channels',
          'Mimics the continuous, associative, and non-linear flow of internal thoughts, memories, and sensory impressions within a character\'s mind',
          'Transcribes political speeches delivered in parliamentary assemblies word for word',
          'Translates foreign languages mechanically without evaluating context'
        ],
        correctIndex: 1,
        explanation: '"Stream of consciousness" (dòng ý thức) là kỹ thuật văn học mô phỏng dòng chảy liên tưởng, phi tuyến tính của suy nghĩ, ký ức và cảm giác bên trong nội tâm nhân vật.'
      },
      {
        id: 'rq_c2_4_5',
        type: 'inference',
        question: 'According to paragraph 3, how does narrative indeterminacy transform the role of the reader in modernist texts?',
        options: [
          'It allows readers to skip reading chapters without losing basic plot understanding',
          'It forces the reader into an active hermeneutic struggle, requiring them to participate in forging meaning rather than passively absorbing moral dogma',
          'It turns reading into an entertaining recreational game that requires zero intellectual exertion',
          'It discourages readers from discussing literature in academic classroom seminars'
        ],
        correctIndex: 1,
        explanation: 'Đoạn 3 nêu: Tính bất định trần thuật buộc người đọc tham gia vào cuộc vật lộn thông giải học chủ động, đòi hỏi kiến tạo ý nghĩa thay vì tiếp nhận thụ động tín điều đạo đức.'
      },
      {
        id: 'rq_c2_4_6',
        type: 'detail',
        question: 'What dangerous tendency does the author identify in paragraph 5 regarding unconstrained literary deconstruction in education?',
        options: [
          'It causes students to fail arithmetic examinations',
          'It risks degenerating into a nihilistic solipsism where interpretation terminates purely in cynical exposure and ideological unmasking',
          'It leads to excessive romantic idealization of historical royal dynasties',
          'It forces universities to eliminate science departments'
        ],
        correctIndex: 1,
        explanation: 'Đoạn 5 cảnh báo nguy cơ giải cấu trúc cực đoan bị xơ cứng thành chủ nghĩa duy ngã hư vô ("nihilistic solipsism"), nơi việc đọc hiểu chỉ dừng lại ở sự bóc trần hoài nghi yếm thế.'
      },
      {
        id: 'rq_c2_4_7',
        type: 'vocab_context',
        question: 'In the final paragraph, Paul Ricœur\'s concept of a "second naiveté" (or "hermeneutics of retrieval") signifies:',
        options: [
          'A return to childlike ignorance that refuses to study grammar',
          'A critically audited restoration of genuine wonder and existential meaning that emerges after passing through rigorous deconstructive suspicion',
          'An academic policy that allows university students to retake failed examinations twice',
          'A psychological condition characterized by persistent short-term memory loss'
        ],
        correctIndex: 1,
        explanation: '"Second naiveté" (sự ngây thơ thứ hai / thông giải học thu hồi) là trạng thái phục hồi niềm kinh ngạc và ý nghĩa hiện sinh chân thực sau khi đã thanh lọc qua ngọn lửa hoài nghi giải cấu trúc.'
      }
    ]
  }
];
