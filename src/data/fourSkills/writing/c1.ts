import { WritingPrompt } from '../types';

export const c1WritingLessons: WritingPrompt[] = [
  {
    id: 'wp_5',
    title: 'Architecture Evaluation Essay: Monolith versus Microservices in Early-Stage Startups',
    type: 'Opinion Essay',
    category: 'Academic / IELTS',
    level: 'C1',
    minWords: 250,
    maxWords: 350,
    wordRange: '250–350 words',
    prompt: 'Viết bài luận nghị luận kỹ thuật chuyên sâu (250–350 từ): Phân tích và đánh giá quan điểm "Các công ty khởi nghiệp công nghệ giai đoạn đầu nên bắt đầu với kiến trúc Monolith mô-đun hóa thay vì vội vã triển khai Microservices". Đánh giá chi phí vận hành (distributed tax), tính nhất quán dữ liệu giao dịch ACID, định luật Conway và các tiêu chí cụ thể chứng minh khi nào việc tách rời hệ thống thực sự mang lại giá trị.',
    guidelines: [
      'Mở bài: Đưa ra luận điểm rõ ràng về tối ưu hóa sớm (premature optimization) và sự mơ hồ của sản phẩm giai đoạn đầu',
      'Thân bài 1: Phân tích ưu thế kỹ thuật vượt trội của modular monolith (ACID transactions, localized debugging, frictionless refactoring)',
      'Thân bài 2: Mổ xẻ chi phí tiềm ẩn của microservices (distributed tracing, network latency, cognitive load, Conway\'s Law)',
      'Kết luận: Đưa ra khuyến nghị dựa trên quy mô nhân sự và ngưỡng va chạm triển khai của các nhóm độc lập'
    ],
    recommendedVocab: [
      { word: 'Premature optimization', meaning: 'Tối ưu hóa quá sớm gây lãng phí tài nguyên' },
      { word: 'Operational overhead', meaning: 'Chi phí vận hành và quản lý hạ tầng' },
      { word: 'Conway\'s Law', meaning: 'Định luật Conway về mối quan hệ giữa cấu trúc tổ chức và phần mềm' },
      { word: 'Transactional consistency', meaning: 'Tính nhất quán giao dịch dữ liệu' },
      { word: 'Distributed tracing', meaning: 'Truy vết phân tán trong hệ thống vi dịch vụ' },
      { word: 'Cognitive load', meaning: 'Gánh nặng nhận thức của đội ngũ kỹ sư' }
    ],
    modelAnswer: `For early-stage technology startups, embarking directly on a distributed microservices architecture is frequently a costly exercise in premature optimization. In the nascent phases of product engineering, organizations grapple with profound market ambiguity, demanding frictionless refactoring, rapid exploratory prototyping, and immediate customer feedback loops. Adopting distributed architectures prematurely introduces formidable operational frictions that divert engineering bandwidth from core product innovation.

A well-architected modular monolith offers decisive structural advantages for lean teams. By consolidating application logic within a unified repository and runtime memory space, developers leverage compiler-enforced interfaces, localized debugging, and straightforward ACID database transactions. Crucially, engineering workflows bypass the formidable complexities of remote procedure calls, network latency serialization, circuit breakers, and eventual consistency dilemmas. Teams can ship features in hours rather than coordinating cross-service API schema contracts and multi-pipeline deployment synchronizations.

Conversely, the microservices paradigm imposes a massive distributed tax. Managing dozens of isolated services necessitates sophisticated container orchestration via Kubernetes, distributed tracing clusters, centralized log aggregation, and dedicated Site Reliability Engineering personnel. For a startup with fewer than twenty developers, this administrative overhead imposes unsustainable cognitive load. Conway's Law dictates that software architectures reflect organizational communication structures; decomposing a system before establishing autonomous, decoupled business domains inevitably results in a "distributed monolith"—incorporating the performance bottlenecks of networks without the autonomy of genuine decoupling.

In conclusion, engineering leadership must treat architectural decomposition not as a default status symbol, but as an organizational scaling remedy. Startups should maintain a disciplined, modular monolithic architecture with clean boundary abstractions. Only when independent organizational units experience severe deployment collisions, or when distinct sub-domains exhibit radically divergent scaling requirements, does decomposing into microservices yield justifiable dividends.`
  },
  {
    id: 'wp_c1_1',
    title: 'Strategic Policy Proposal: Enterprise Governance Framework for Generative AI Adoption',
    type: 'Executive Summary',
    category: 'Tech / Workplace',
    level: 'C1',
    minWords: 250,
    maxWords: 350,
    wordRange: '250–350 words',
    prompt: 'Với tư cách là Giám đốc An toàn Thông tin (CISO), hãy viết bản đề xuất chính sách chiến lược gửi Hội đồng Quản trị (250–350 từ): Phân tích cơ hội tăng tốc năng suất từ Generative AI đối chiếu với các rủi ro bảo mật dữ liệu khách hàng, rủi ro ảo giác thuật toán (hallucinations) và nghĩa vụ tuân thủ pháp lý (GDPR, EU AI Act). Đề xuất mô hình quản trị 3 trụ cột (cổng API cách ly, kiểm duyệt human-in-the-loop, red-teaming định kỳ) và dự toán phân bổ ngân sách.',
    guidelines: [
      'Tóm tắt mục tiêu chiến lược và các vectơ hiểm họa từ việc sử dụng AI phi chính thức (shadow AI)',
      'Phân tích rủi ro rò rỉ tài sản trí tuệ và nghĩa vụ tuân thủ quy định bảo vệ dữ liệu',
      'Đề xuất khung quản trị 3 trụ cột (zero-retention gateway, human-in-the-loop, adversarial auditing)',
      'Kết luận và đề xuất phê duyệt ngân sách triển khai theo từng giai đoạn'
    ],
    recommendedVocab: [
      { word: 'Algorithmic governance', meaning: 'Quản trị và kiểm soát thuật toán' },
      { word: 'Data exfiltration', meaning: 'Sự rò rỉ, đánh cắp dữ liệu trái phép' },
      { word: 'Hallucination mitigation', meaning: 'Giảm thiểu hiện tượng bịa đặt thông tin của AI' },
      { word: 'Human-in-the-loop', meaning: 'Quy trình giám sát bắt buộc có sự tham gia của con người' },
      { word: 'Compliance mandate', meaning: 'Mệnh lệnh tuân thủ pháp lý' },
      { word: 'Enterprise air-gapping', meaning: 'Biện pháp cách ly mạng cấp doanh nghiệp bảo mật' }
    ],
    modelAnswer: `Executive Proposal: Comprehensive Governance Framework for Enterprise Generative AI Integration

Strategic Objective:
The accelerated emergence of generative artificial intelligence presents unparalleled opportunities to elevate organizational productivity, automated customer resolution, and software development velocity. However, unmanaged "shadow AI" adoption poses existential hazards, including proprietary source code leaks, client data exfiltration, regulatory penalties, and reputational damage resulting from unchecked algorithmic hallucinations. This proposal outlines a proactive, robust governance framework to harness AI capabilities safely while ensuring rigorous compliance with international data privacy mandates.

Risk Analysis and Vulnerability Vectors:
Unrestricted employee interaction with public commercial foundation models exposes enterprise intellectual property to unauthorized model training ingestion. Furthermore, because large language models inherently generate probabilistic outputs rather than deterministic truths, relying on unverified synthetic code or financial analysis creates systemic operational vulnerabilities. From a regulatory perspective, deploying customer-facing automated systems without transparent algorithmic provenance breaches emerging compliance frameworks, specifically the EU AI Act and GDPR Article 22 regarding automated decision-making.

The Three-Pillar Governance Blueprint:
1. Zero-Retention Enterprise API Gateway: Terminate all direct access to public consumer AI interfaces. Route all corporate queries through an air-gapped, enterprise-managed proxy that programmatically sanitizes personally identifiable information (PII) and guarantees zero data retention by third-party model vendors.
2. Mandatory Human-in-the-Loop Protocol: Enforce strict operational guidelines stipulating that AI-generated artifacts—whether technical pull requests, legal briefs, or financial projections—must undergo manual inspection and sign-off by credentialed professionals.
3. Continuous Adversarial Auditing: Institute quarterly red-teaming assessments to detect algorithmic bias, prompt-injection vulnerabilities, and output drift across internal fine-tuned deployments.

Conclusion and Resource Authorization:
Embracing artificial intelligence is an imperative for maintaining market competitiveness, yet innovation must not compromise enterprise integrity. I recommend authorizing an initial budget of three hundred thousand dollars to implement our enterprise gateway and roll out comprehensive staff literacy training over the forthcoming fiscal quarter.`
  },
  {
    id: 'wp_c1_2',
    title: 'Critical Analysis: Algorithmic Recommendation Systems and the Commodification of Human Attention',
    type: 'Analytical Report',
    category: 'Culture & Society',
    level: 'C1',
    minWords: 250,
    maxWords: 350,
    wordRange: '250–350 words',
    prompt: 'Viết bài luận phân tích phê phán (250–350 từ) cho một tạp chí xã hội học văn hóa: Khám phá cách các thuật toán gợi ý nội dung tối ưu hóa thời gian giữ chân người dùng (dwell time) dưới chủ nghĩa tư bản giám sát, tác động tiêu cực đến dung lượng nhận thức sâu (cognitive bandwidth), sự phân cực cảm xúc trong đối thoại công dân (affective polarization) và đề xuất các giải pháp cải tổ cấu trúc nền tảng.',
    guidelines: [
      'Phân tích cơ chế kinh tế đằng sau việc tối ưu hóa thời gian tiếp xúc màn hình và khai thác thặng dư hành vi',
      'Đánh giá hệ quả thần kinh học: sự phân mảnh khả năng tập trung sâu và xu hướng tiếp nhận thông tin nông cạn',
      'Mổ xẻ tác động chính trị xã hội: sự hình thành các buồng vang thông tin (echo chambers) và phân cực xã hội',
      'Đề xuất giải pháp kiểm toán thuật toán mang tính hệ thống thay vì chỉ kêu gọi cai nghiện kỹ thuật số cá nhân'
    ],
    recommendedVocab: [
      { word: 'Surveillance capitalism', meaning: 'Chủ nghĩa tư bản giám sát' },
      { word: 'Epistemic fragmentation', meaning: 'Sự phân mảnh nhận thức luận và niềm tin chung' },
      { word: 'Cognitive bandwidth', meaning: 'Dung lượng xử lý nhận thức của não bộ' },
      { word: 'Affective polarization', meaning: 'Sự phân cực cảm xúc sâu sắc giữa các nhóm' },
      { word: 'Algorithmic feedback loop', meaning: 'Vòng lặp phản hồi củng cố của thuật toán' },
      { word: 'Deep architectural reform', meaning: 'Cải tổ kiến trúc hạ tầng mang tính căn cơ' }
    ],
    modelAnswer: `The contemporary media landscape is increasingly governed by algorithmic recommendation engines designed with a singular, ruthless imperative: the maximization of user dwell time. Operating under the commercial logic of surveillance capitalism, contemporary social platforms extract behavioral surplus by engineering habit-forming dopamine loops. While platform architectures are marketed as neutral democratizing conduits for global communication, their systemic optimization for affective arousal has exacted an unprecedented toll on cognitive bandwidth and civic discourse.

At the neuro-cognitive level, continuous exposure to personalized micro-content fragments sustained concentration, eroding our societal capacity for deep, contemplative inquiry. The rapid transition from long-form investigative analysis to modular, sensationalized video snippets conditions the human mind to crave instant gratification. Consequently, deep reading and complex philosophical deliberation are increasingly perceived as cognitively exhausting anomalies. When cognitive bandwidth becomes hyper-fragmented, individuals become acutely vulnerable to superficial rhetoric and populist oversimplifications.

More pernicious still is the sociopolitical fallout of algorithmic sorting. Because automated recommendation systems favor inflammatory content that elicits high emotional reactivity, algorithmic feeds systematically construct self-reinforcing echo chambers. This dynamic fuels affective polarization, wherein dissenting perspectives are not merely contested through reasoned argumentation, but pathologized as existential threats. The resulting epistemic fragmentation dissolves the shared evidentiary baseline essential for deliberative democracy, rendering legislative consensus nearly impossible.

Addressing this crisis necessitates moving beyond moralizing individual "digital detox" narratives. Voluntary self-restraint is fundamentally outmatched by thousands of machine-learning engineers optimizing neurological capture. Systemic remedies must involve structural regulatory interventions: enforcing algorithmic transparency audits, prohibiting exploitative infinite-scroll mechanics, and mandating interoperable middleware that empowers citizens to choose their own curation algorithms. Reclaiming human agency requires treating digital attention not as a monetizable commodity, but as a protected public commons.`
  },
  {
    id: 'wp_c1_3',
    title: 'Formal Investigation Report: Post-Incident Cloud Security Breach and Remediation Strategy',
    type: 'Technical Report',
    category: 'Career Development',
    level: 'C1',
    minWords: 250,
    maxWords: 350,
    wordRange: '250–350 words',
    prompt: 'Với tư cách là Kiến trúc sư Trưởng An ninh mạng, hãy viết một báo cáo điều tra kỹ thuật chính thức sau sự cố an ninh (250–350 từ) gửi Ban Giám đốc và các bên liên quan: Tóm tắt tiến trình sự cố tấn công credential-stuffing, điều tra nguyên nhân gốc rễ (vi phạm nguyên tắc đặc quyền tối thiểu trong IAM role), đánh giá phạm vi ảnh hưởng dữ liệu, báo cáo tuân thủ GDPR Điều 33 và lộ trình củng cố kiến trúc Zero-Trust.',
    guidelines: [
      'Nêu tiến trình phát hiện sự cố qua hệ thống SIEM và thời gian cô lập (containment chronology)',
      'Điều tra giám định nguyên nhân gốc rễ (service account cấu hình wildcard permissions bên ngoài VPC)',
      'Xác nhận mức độ rò rỉ dữ liệu và hoàn thành nghĩa vụ thông báo theo luật định trong 72 giờ',
      'Đề xuất 4 biện pháp kiểm soát bù trừ rủi ro (FIDO2 MFA, federated OIDC, secret scanning, pentest độc lập)'
    ],
    recommendedVocab: [
      { word: 'Forensic investigation', meaning: 'Điều tra giám định an ninh mạng chuyên sâu' },
      { word: 'Zero-trust architecture', meaning: 'Kiến trúc bảo mật không tin cậy bất kỳ ai' },
      { word: 'Least-privilege principle', meaning: 'Nguyên tắc đặc quyền tối thiểu trong phân quyền' },
      { word: 'Exfiltration mitigation', meaning: 'Biện pháp giảm thiểu và ngăn chặn thất thoát dữ liệu' },
      { word: 'Identity provider federation', meaning: 'Liên kết định danh người dùng phân tán' },
      { word: 'Compensating control', meaning: 'Biện pháp kiểm soát bù trừ rủi ro an ninh' }
    ],
    modelAnswer: `Incident Retrospective: Comprehensive Post-Breach Forensic Audit and Cloud Hardening Roadmap

Incident Chronology and Executive Overview:
On October 12, at 03:14 UTC, our automated Security Information and Event Management (SIEM) telemetry triggered a severity-one alert indicating anomalous authentication surges against our primary Identity Provider (IdP) cluster. An unauthorized adversary executed a distributed credential-stuffing assault utilizing compromised third-party credential dumps. Within forty-two minutes, the incident response team initiated automated IP rate-limiting, quarantined compromised access tokens, and severed affected network bridges, achieving full containment by 04:22 UTC.

Forensic Root-Cause Analysis:
Forensic analysis established that the attackers exploited an over-permissive Identity and Access Management (IAM) role associated with an obsolete staging microservice deployed outside our Virtual Private Cloud (VPC). Although production database clusters remained encrypted with customer-managed KMS keys, the exposed service account token permitted read-only enumeration of non-sensitive customer metadata. Crucially, the root vulnerability stemmed from a violation of the least-privilege principle: the service account possessed broad wildcard permissions rather than scoped, task-specific authorizations.

Impact Assessment:
Cryptographic verification confirmed that zero financial records, hashed passwords, or primary customer databases were exfiltrated. However, approximately twelve thousand user email addresses and public account creation timestamps were accessed. In compliance with statutory obligations under GDPR Article 33 and California consumer privacy statutes, formal regulatory disclosures and customer advisories were dispatched within the mandated seventy-two-hour reporting threshold.

Strategic Remediation and Zero-Trust Hardening:
To decisively eliminate lateral exploit pathways, engineering has executed the following compensating controls:
1. Deprecated all legacy IAM service accounts in favor of short-lived, OpenID Connect (OIDC) federated credentials with a maximum sixty-minute lifespan.
2. Enforced hardware-backed FIDO2 Multi-Factor Authentication (MFA) across all administrative consoles.
3. Implemented automated Git secret-scanning pre-commit hooks to prevent credential leakage.
4. Commissioned an independent third-party penetration testing audit prior to the upcoming quarter.`
  }
];
