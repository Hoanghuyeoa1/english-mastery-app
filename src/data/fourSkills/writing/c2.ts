import { WritingPrompt } from '../types';

export const c2WritingLessons: WritingPrompt[] = [
  {
    id: 'wp_c2_1',
    title: 'Discursive Philosophical Essay: Epistemic Agency and Moral Responsibility in the Age of Automated Cognition',
    type: 'Discursive Essay',
    category: 'Science & Environment',
    level: 'C2',
    minWords: 350,
    maxWords: 500,
    wordRange: '350–500 words',
    prompt: 'Viết một bài luận học thuật nghị luận triết học chuyên sâu (350–500 từ) cho một hội thảo quốc tế về đạo đức trí tuệ nhân tạo: Điều hòa hai hệ hình nhận thức luận đối lập—hệ hình tối ưu hóa thực chứng (instrumentalist optimization) ca ngợi AI giúp loại bỏ định kiến nhận thức của con người, đối chiếu với hệ hình nhân bản phê phán (critical humanism) cảnh báo sự thoái thác trách nhiệm đạo đức qua thuật toán (moral laundering) và sự mai một của trí tuệ thực hành (phronesis). Đưa ra giải pháp biện chứng về sự khiêm nhường trong nhận thức luận và ranh giới tự động hóa có trách nhiệm.',
    guidelines: [
      'Mở bài: Xác lập cuộc khủng hoảng nhận thức luận khi ủy thác phán đoán đạo đức cho các mô hình xác suất',
      'Thân bài 1: Phân tích lập luận của thuyết thực chứng về khả năng xử lý dữ liệu đa chiều và tính nhất quán khách quan',
      'Thân bài 2: Mổ xẻ phản biện nhân văn về tính mờ đục nhận thức luận (epistemic opacity), sự củng cố bất công lịch sử và hiện tượng moral laundering',
      'Thân bài 3: Cảnh báo sự thoái hóa của trí tuệ thực hành Aristotelian phronesis khi con người trở thành con dấu thụ động',
      'Kết luận: Đề xuất giải pháp biện chứng coi AI là công cụ hỗ trợ nhận thức chứ không thể thay thế lương tri con người'
    ],
    recommendedVocab: [
      { word: 'Epistemic opacity', meaning: 'Tính mờ đục trong nhận thức luận của mô hình phức tạp' },
      { word: 'Moral laundering', meaning: 'Sự tẩy rửa/thoái thác trách nhiệm đạo đức thông qua thuật toán' },
      { word: 'Aristotelian phronesis', meaning: 'Trí tuệ thực hành và năng lực phán đoán đạo đức theo triết học Aristotle' },
      { word: 'Cognitive offloading', meaning: 'Sự ủy thác hoặc giảm tải gánh nặng nhận thức sang máy móc' },
      { word: 'Probabilistic determinism', meaning: 'Thuyết tiền định mang tính xác suất của mô hình toán' },
      { word: 'Algorithmic triage', meaning: 'Sự phân loại và sàng lọc tự động bằng thuật toán' }
    ],
    modelAnswer: `The relentless integration of autonomous algorithmic systems into judicial sentencing, diagnostic medicine, and macroeconomic stewardship has propelled humanity into an unprecedented epistemic crisis. At the core of this transition lies a profound philosophical tension between instrumentalist optimization—which celebrates computational systems as impartial, high-throughput arbiters capable of eliminating human cognitive bias—and a critical humanist tradition that views the wholesale delegation of judgment as a perilous abdication of moral agency. Navigating this paradigm clash requires dissecting the foundational epistemic assumptions governing automated reasoning.

Proponents of computational decision-making argue compellingly from an instrumentalist perspective. Human deliberation is notoriously vulnerable to affective distortions, cognitive fatigue, and systemic heuristic shortcuts. By processing multidimensional datasets far beyond the biological processing bandwidth of individual specialists, deep predictive models deliver consistency and pattern discernment that appear objectively superior. In domains such as radiographic pathology or actuarial risk calibration, computational offloading does not merely augment human capacity; it redefines operational efficacy, ostensibly democratizing expertise and excising capricious idiosyncratic prejudice from high-stakes determinations.

Yet this technological enthusiasm rests on a fragile epistemological premise: the conflation of statistical correlation with normative judgment. Neural architectures, characterized by extreme parameterization and non-linear opacity, operate as epistemic "black boxes." When an automated system assigns recidivism scores or denies medical insurance claims, it executes probabilistic optimizations derived from historically conditioned datasets. Consequently, structural systemic inequities are not eliminated; rather, they are codified under an aura of mathematical inevitability. Furthermore, distributing decision-making across opaque software architectures engenders a phenomenon that philosophers term "moral laundering," wherein human institutions disclaim ethical culpability by attributing controversial outcomes to inscrutable algorithmic calculations.

More insidious still is the prospective atrophy of Aristotelian phronesis—practical moral wisdom honed through agonizing experiential judgment. If institutional decision-makers become mere rubber-stamps for automated directives, the human capacity for nuanced empathy, moral courage, and contextual exception-making inevitably degenerates. Algorithms excel at extrapolating normative patterns from retrospective distributions, but they are conceptually incapable of recognizing the transformative ethical moment that demands a departure from precedent.

Ultimately, resolving this epistemic tension demands rejecting both uncritical techno-utopianism and reactionary neo-Luddism. Algorithmic intelligence must be reconceptualized not as a surrogate conscience, but as an epistemic prosthetic. True institutional sophistication resides in establishing institutional boundaries that preserve human moral accountability: mandating explicability, guaranteeing meaningful human contestability, and reserving the ultimate exercise of life-altering judgment for fallible, but morally accountable, human beings.`
  },
  {
    id: 'wp_c2_2',
    title: 'Scholarly Macroeconomic Critique: The Degrowth Paradigm versus Green Industrial Policy in the Global South',
    type: 'Argumentative Essay',
    category: 'Culture & Society',
    level: 'C2',
    minWords: 350,
    maxWords: 500,
    wordRange: '350–500 words',
    prompt: 'Viết bài luận nghị luận kinh tế sinh thái và chính sách phát triển toàn cầu (350–500 từ): Tổng hợp và phê phán cuộc tranh luận gay gắt giữa luận thuyết "Giảm tăng trưởng" (Degrowth) của phương Tây và mệnh lệnh hiện đại hóa công nghiệp xóa đói giảm nghèo tại các quốc gia Nam Bán cầu (Global South). Đánh giá tính khả thi của sự tách rời tuyệt đối (absolute decoupling), vạch rõ các điểm mù mang tính tân thuộc địa của thuyết degrowth khi áp đặt lên các nước đang phát triển và đề xuất khuôn khổ công lý sinh thái toàn cầu phân biệt trách nhiệm.',
    guidelines: [
      'Đặt vấn đề: Mâu thuẫn giữa giới hạn nhiệt động lực học của hành tinh và nhu cầu tăng trưởng kinh tế',
      'Phân tích cơ sở khoa học của thuyết degrowth và hạn chế của sự tách rời tuyệt đối (absolute decoupling)',
      'Phê phán tính chất tân thuộc địa (green neocolonialism) khi áp đặt degrowth lên các nền kinh tế đang phát triển',
      'Đánh giá hạn chế của mô hình tăng trưởng xanh thuần túy thị trường',
      'Đề xuất giải pháp công lý chuyển đổi: phi vật chất hóa ở các nước giàu song hành với chuyển giao công nghệ sạch không điều kiện cho Nam Bán cầu'
    ],
    recommendedVocab: [
      { word: 'Thermodynamic limits', meaning: 'Các giới hạn nhiệt động lực học của sinh quyển' },
      { word: 'Absolute decoupling', meaning: 'Sự tách rời tuyệt đối giữa tăng trưởng GDP và suy thoái môi trường' },
      { word: 'Neocolonial asymmetry', meaning: 'Sự bất đối xứng mang tính tân thuộc địa trong quan hệ quốc tế' },
      { word: 'Structural transformation', meaning: 'Sự chuyển đổi cấu trúc kinh tế nền tảng' },
      { word: 'Dematerialization', meaning: 'Quá trình phi vật chất hóa nền kinh tế' },
      { word: 'Carbon budget sovereignty', meaning: 'Chủ quyền hạn ngạch phát thải carbon của các quốc gia' }
    ],
    modelAnswer: `As the biosphere breaches irreversible ecological tipping points, global macroeconomics confronts a foundational reckoning. Contemporary discourse is deeply fractured between two irreconcilable visions: the radical "degrowth" thesis, which insists that infinite compound GDP expansion on a finite planet violates basic thermodynamic reality, and the green industrial modernization paradigm, which contends that technological innovation can achieve absolute decoupling between economic prosperity and environmental degradation. Evaluating this dialectic requires moving beyond ideological posturing and scrutinizing the geopolitical asymmetries governing global resource allocation.

The theoretical foundation of the degrowth critique is scientifically formidable. Decades of empirical evidence suggest that while relative decoupling—generating more economic output per unit of resource input—is demonstrable, absolute decoupling at a global scale remains an elusive fantasy. As emerging clean technologies scale, their aggregate mineral extraction demands for lithium, cobalt, and rare-earth elements replicate identical extractivist dynamics. From an ecological accounting standpoint, perpetual growth within high-income nations functions as an ecological Ponzi scheme, drawing down planetary life-support systems to fuel consumerist obsolescence.

However, when degrowth advocates extrapolate their framework indiscriminately to the Global South, the thesis collapses into profound moral and structural contradictions. Across emerging economies, hundreds of millions remain deprived of baseline electrification, sanitary infrastructure, and modern healthcare. For developing states, economic expansion is not a discretionary luxury; it is the indispensable prerequisite for basic human emancipation. Demanding that developing countries abandon industrial modernization in the name of global ecological preservation represents an intolerable form of green neocolonialism, effectively freezing historical disparities caused by two centuries of Western carbon accumulation.

Conversely, relying exclusively on market-driven green growth presents severe limitations. Market mechanisms historically incentivize the displacement of ecological costs onto disenfranchised regions, maintaining extractivist supply chains while branding superficial consumer adaptations as structural transformation.

Resolving this macroeconomic impasse necessitates an asymmetric global settlement grounded in differentiated ecological responsibility. Developed nations, having largely exhausted planetary carbon budgets, must initiate planned economic dematerialization: shifting priorities from speculative capital accumulation toward decommodified public services, circular longevity, and reduced working hours. Concurrently, international intellectual property regimes and multilateral debt frameworks must be restructured to grant the Global South carbon budget sovereignty and transfer clean technologies unconditionally. Only through this differentiated synthesis—dematerialization in the affluent core paired with sovereign, sustainable industrialization in the developing periphery—can humanity construct a viable post-carbon international economic order.`
  },
  {
    id: 'wp_c2_3',
    title: 'Bioethical Treatises: Somatic Gene Editing, Cognitive Enhancement, and the Specter of Genetic Stratification',
    type: 'Analytical Report',
    category: 'Science & Environment',
    level: 'C2',
    minWords: 350,
    maxWords: 500,
    wordRange: '350–500 words',
    prompt: 'Viết một chuyên khảo phân tích đạo đức sinh học và pháp lý phân tử (350–500 từ) cho Ủy ban Đạo đức Sinh học Quốc tế (IBC): Khảo sát sự xói mòn ranh giới mong manh giữa liệu pháp gen tế bào soma điều trị bệnh và can thiệp dòng mầm/tối ưu hóa nhận thức qua CRISPR-Cas9, phân tích nguy cơ phân tầng giai cấp sinh học vĩnh viễn (genetic stratification), đánh giá lập luận tự do sinh sản của chủ nghĩa siêu nhân học (transhumanism) và xây dựng khung quản trị đa phương có tính ràng buộc pháp lý quốc tế.',
    guidelines: [
      'Xác lập ngưỡng bản thể học mới khi con người tự chỉnh sửa mã di truyền di truyền của giống loài',
      'Chỉ ra tính chất mong manh, xã hội hóa của ranh giới giữa chữa bệnh (therapy) và nâng cấp tăng cường (enhancement)',
      'Phân tích nguy cơ bất bình đẳng kinh tế chuyển hóa thành hệ thống đẳng cấp sinh học vĩnh cửu (biological caste system)',
      'Phản biện luận điểm tự do hóa sinh sản transhumanist và vi phạm sự đồng thuận giữa các thế hệ (intergenerational consent)',
      'Đề xuất thỏa thuận đình chỉ có tính ràng buộc quốc tế đối với thương mại hóa chỉnh sửa gen dòng mầm'
    ],
    recommendedVocab: [
      { word: 'Germline modification', meaning: 'Chỉnh sửa gen trên dòng tế bào mầm có khả năng di truyền qua các thế hệ' },
      { word: 'Genetic stratification', meaning: 'Sự phân tầng giai cấp xã hội dựa trên mã di truyền sinh học' },
      { word: 'Somatic intervention', meaning: 'Can thiệp tế bào soma chỉ ảnh hưởng cá thể, không di truyền' },
      { word: 'Intergenerational justice', meaning: 'Công lý và quyền tự quyết giữa các thế hệ nối tiếp' },
      { word: 'Eugenics by consumer choice', meaning: 'Chủ nghĩa ưu sinh nảy sinh từ lựa chọn tiêu dùng tư nhân' },
      { word: 'Transhumanist optimization', meaning: 'Sự tối ưu hóa sinh học theo chủ nghĩa siêu nhân học' }
    ],
    modelAnswer: `The advent of precision genomic editing through CRISPR-Cas9 and base-editing technologies represents an ontological threshold in human history. Humanity is no longer merely an observer or cultivator of evolutionary biology; it has acquired the capacity to author its own hereditary code. While molecular medicine celebrates the eradication of monogenic pathologies such as sickle-cell disease and Huntington’s chorea, the technological continuum linking somatic therapeutic restoration to elective germline enhancement creates immense bioethical dilemmas that threaten the egalitarian foundations of modern society.

The conceptual demarcation separating "disease prevention" from "performance enhancement" is inherently fragile and socially constructed. Pathologies are frequently defined against shifting statistical baselines; an intervention aimed at enhancing cognitive plasticity, memory retention, or immunological resilience can be framed either as a prophylactic health measure or as an elective upgrade. Transhumanist philosophers champion this continuum, arguing from a libertarian premise of procreative autonomy: if parents possess the ethical prerogative to cultivate their offspring's cognitive capacities through elite tutoring and nutrition, on what coherent moral basis should biological optimization be proscribed? In this view, restricting technological self-realization stifles the evolutionary potential of human intelligence.

This libertarian defense, however, ignores the profound socio-political realities of global economic inequality. Unlike educational advantages, which remain subject to individual effort and environmental contingency, heritable germline alterations permanently encode socioeconomic privilege into molecular architecture. If access to cognitive optimization and longevity gene enhancements is mediated through deregulated private markets, existing wealth stratifications will inevitably metastasize into permanent biological caste systems. The affluent will not merely possess more capital; their descendants will possess superior neurological processing velocity, disease immunity, and physiological vitality. Such biological apartheid would irrevocably demolish the bedrock liberal assumption of inherent human equality.

Furthermore, germline engineering introduces profound violations of intergenerational consent. Future generations, subjected to irreversible genomic modifications engineered to satisfy the competitive vanities of their forebears, are denied the moral autonomy to exist unencumbered by artificial biological design.

Faced with the specter of a consumer-driven eugenics, the international community must transcend fragmented national jurisdictions. Multilateral governance must establish a binding moratorium on commercial germline modification, rigorously segregating non-heritable somatic therapies—which warrant aggressive public research funding—from germline enhancements that commodify the human genome. Preserving human dignity requires recognizing that our shared genetic vulnerabilities are not market deficits to be optimized, but the shared biological substrate of mutual human solidarity.`
  },
  {
    id: 'wp_c2_4',
    title: 'Diplomatic Monograph: Cultural Sovereignty, Digital Imperialism, and the Preservation of Intangible Heritage',
    type: 'Discursive Essay',
    category: 'Social & Travel',
    level: 'C2',
    minWords: 350,
    maxWords: 500,
    wordRange: '350–500 words',
    prompt: 'Với tư cách là nhà nhân học văn hóa và đại biểu ngoại giao tại UNESCO, hãy viết một chuyên khảo đối ngoại chính sách (350–500 từ): Điều hòa lý tưởng thế giới đại đồng (cosmopolitanism) về tự do lưu chuyển thông tin với mệnh lệnh cấp bách bảo vệ chủ quyền văn hóa bản địa trước sự áp đảo của các tập đoàn công nghệ số toàn cầu. Phân tích hiện tượng đồng nhất hóa ngôn ngữ và hủy diệt tri thức bản địa (epistemicide), phản biện luận điểm về sự lai ghép văn hóa tự nhiên và đề xuất 3 trụ cột hiệp ước ngoại giao bảo vệ chủ quyền dữ liệu văn hóa phi vật thể.',
    guidelines: [
      'Phê phán ảo tưởng ngây thơ về một không gian internet bình đẳng, chỉ ra thực tế chủ nghĩa đế quốc số (digital imperialism)',
      'Mổ xẻ cơ chế xói mòn văn hóa phi vật thể khi các mô hình AI lớn được huấn luyện chủ yếu trên tiếng Anh chuẩn và hệ giá trị phương Tây',
      'Phản biện lập luận cho rằng văn hóa luôn tự biến đổi qua lai ghép hữu cơ bằng sự bất bình đẳng quyền lực hạ tầng nền tảng',
      'Đề xuất 3 trụ cột hiệp ước quốc tế: trao trả chủ quyền tri thức số, hạn ngạch thuật toán cho di sản bản địa và công nhận chủ quyền dữ liệu là nhân quyền'
    ],
    recommendedVocab: [
      { word: 'Digital imperialism', meaning: 'Chủ nghĩa đế quốc kỹ thuật số' },
      { word: 'Epistemicide', meaning: 'Sự hủy diệt hoặc làm biến mất các hệ thống tri thức bản địa' },
      { word: 'Cultural homogenization', meaning: 'Sự đồng nhất hóa văn hóa toàn cầu theo một khuôn mẫu' },
      { word: 'Intangible cultural heritage', meaning: 'Di sản văn hóa phi vật thể' },
      { word: 'Algorithmic monoculture', meaning: 'Đơn văn hóa được định hình bởi thuật toán nền tảng' },
      { word: 'Epistemic repatriation', meaning: 'Sự trao trả và khôi phục chủ quyền tri thức bản địa' }
    ],
    modelAnswer: `The utopian promise of the early digital era celebrated the internet as an egalitarian agora wherein cultural boundaries would dissolve into cosmopolitan understanding. Decades into the ubiquity of algorithmic communication, however, this cosmopolitan vision has yielded to a starker reality: the consolidation of a digital imperialism that threatens to assimilate the planet’s diverse intangible heritage into an Anglo-American consumerist monoculture. The frictionless exchange of digital information, celebrated by cosmopolitan globalists, operates through proprietary platforms that treat human cultures not as sacred living traditions, but as raw behavioral telemetry to be monetized.

The mechanisms of this cultural attrition are insidious because they are structural rather than overtly coercive. Global foundation models, social networks, and streaming distribution platforms are overwhelmingly trained on massive corpora dominated by standard global English and Western ontological assumptions. Indigenous languages, nuanced regional idioms, and oral folklore that resist algorithmic indexing are systematically marginalized. This linguistic and cultural flattening amounts to an ongoing epistemicide, wherein generations raised on algorithmic feeds absorb standardized sensibilities, gradually severing connection with ancestral mythologies, indigenous ecological stewardship methods, and vernacular linguistic cadence.

Cosmopolitan apologists frequently counter that culture is never static; traditions evolve through organic hybridization, and digital exposure democratizes access to global discourse. While cultural exchange has historically fueled creative revitalization, authentic cross-pollination presupposes parity and mutual respect among dialogue partners. When communication infrastructure is monopolized by a handful of multinational tech conglomerates whose monetization engines incentivize rapid sensationalism over contextual reverence, the outcome is not syncretic enrichment, but wholesale cultural displacement. Local folklore is stripped of its communal sacredness and repackaged as ephemeral content snippets stripped of historical gravity.

Confronting this existential homogenization demands establishing a new paradigm of digital cultural sovereignty. Nation-states and indigenous communities must possess the institutional and infrastructural authority to govern their own digital cultural commons. This entails three imperative diplomatic frameworks:
1. Digital Epistemic Repatriation: Mandating that global technology monopolies provide technical infrastructure and financial restitution to indigenous communities for digitizing, protecting, and autonomously controlling their oral histories and linguistic datasets.
2. Algorithmic Quotas for Vernacular Heritage: Enacting statutory obligations requiring regional streaming and search platforms to prominently amplify localized cultural productions and endangered language initiatives.
3. Recognition of Data Sovereignty as a Human Right: Acknowledging that communal intellectual property cannot be expropriated under universal fair-use doctrines.

True international solidarity does not demand erasing difference in the name of global market efficiency; it demands safeguarding the vibrant polyphony of human expression as the irreplaceable birthright of all humankind.`
  }
];
