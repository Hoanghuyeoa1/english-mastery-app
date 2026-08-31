import { ChatFeedback, RoleplayScenario } from '../types';

export interface GenerateChatResponseResult {
  reply: string;
  feedback?: ChatFeedback;
}

// 5 Kịch bản nhập vai thực tế chất lượng cao theo đúng yêu cầu
export const ROLEPLAY_SCENARIOS: RoleplayScenario[] = [
  {
    id: 'tech_interview',
    title: 'Phỏng Vấn Lập Trình Viên (Tech Mock Interview)',
    role: 'Candidate (Ứng viên Developer)',
    aiRole: 'Senior Tech Lead / Interviewer',
    icon: '💼',
    badge: 'Tech Career',
    description: 'Thử thách phỏng vấn kỹ thuật bằng tiếng Anh: giới thiệu bản thân, phân tích kiến trúc Microservices, xử lý bài toán hiệu năng & Scalability.',
    initialMessage: "Hi there! Welcome to our technical interview. Could you please introduce yourself briefly and describe a challenging backend or fullstack project you've worked on recently?",
    systemPrompt: 'You are an experienced Senior Tech Lead interviewing a software engineering candidate. Maintain an encouraging but rigorous conversational tone, ask follow-up questions regarding architecture (microservices, concurrency, caching, databases, scaling), and evaluate their communication clarity.',
    steps: [
      'Bước 1: Giới thiệu bản thân và kinh nghiệm dự án (Background & Project intro)',
      'Bước 2: Giải thích kiến trúc kỹ thuật & các công nghệ đã dùng (Architecture & Tech stack)',
      'Bước 3: Xử lý bài toán tối ưu hiệu năng và điểm nghẽn (Handling bottlenecks & Scalability)',
      'Bước 4: Thảo luận về quy trình CI/CD và định hướng phát triển (CI/CD & Career goals)'
    ],
    suggestedPrompts: [
      "I have 3 years of experience specializing in Node.js microservices and React frontend architectures.",
      "In my previous project, we refactored our monolith into containerized services to handle 50,000 concurrent users.",
      "To resolve latency bottlenecks, we integrated Redis caching and optimized our database indexing strategies."
    ]
  },
  {
    id: 'daily_standup',
    title: 'Cuộc Họp Daily Standup & Báo Cáo Task',
    role: 'Software Developer',
    aiRole: 'Scrum Master / Agile Team Lead',
    icon: '☕',
    badge: 'Workplace & Agile',
    description: 'Báo cáo tiến độ công việc trong buổi họp Daily Standup sáng: cập nhật việc đã làm hôm qua, kế hoạch hôm nay và các vấn đề Blocker.',
    initialMessage: "Good morning team! Let's kick off our Daily Standup. What did you accomplish yesterday, what's on your agenda for today, and are there any blockers impeding your progress?",
    systemPrompt: 'You are an energetic Scrum Master running a daily standup meeting in an international tech company. Respond positively, clarify task estimates, ask about blockers or dependencies, and use natural Agile/Scrum vocabulary.',
    steps: [
      'Bước 1: Báo cáo kết quả công việc hôm qua (Yesterday updates)',
      'Bước 2: Trình bày kế hoạch và mục tiêu hôm nay (Today agenda)',
      'Bước 3: Nêu rõ khó khăn, phụ thuộc hoặc blocker nếu có (Blockers & Dependencies)',
      'Bước 4: Thống nhất kế hoạch review mã nguồn và gộp PR (Code review & PR merge)'
    ],
    suggestedPrompts: [
      "Yesterday, I completed the unit tests for the auth service and submitted a pull request.",
      "Today, I'm focusing on fixing the latency issue in the search query endpoint.",
      "I have a blocker waiting for the third-party API documentation from the vendor team."
    ]
  },
  {
    id: 'travel_airport',
    title: 'Tiếng Anh Du Lịch & Giao Tiếp Đời Sống',
    role: 'International Traveler',
    aiRole: 'Customs Officer & Travel Concierge',
    icon: '✈️',
    badge: 'Travel & Daily Life',
    description: 'Thực hành các tình huống giao tiếp thực tế khi đi du lịch: làm thủ tục check-in tại sân bay, qua cửa hải quan và hỏi đường tham quan.',
    initialMessage: "Good day! Welcome to London Heathrow Airport. May I please see your passport, landing card, and return flight itinerary?",
    systemPrompt: 'You are a professional customs and airport officer. Speak clearly and politely, ask standard immigration questions (purpose of visit, duration of stay, accommodation), and transition to helping them with travel inquiries.',
    steps: [
      'Bước 1: Xuất trình giấy tờ và nêu mục đích chuyến đi (Passport & Purpose of travel)',
      'Bước 2: Trả lời về thời gian lưu trú và nơi ở (Duration & Accommodation details)',
      'Bước 3: Xử lý hành lý hoặc thủ tục transit chuyển tiếp (Baggage claim & Transit)',
      'Bước 4: Hỏi thông tin về phương tiện công cộng và điểm du lịch (Public transport & Sightseeing)'
    ],
    suggestedPrompts: [
      "Here is my passport. I'm visiting for a two-week vacation to explore historic landmarks.",
      "I will be staying at the Hilton Central Hotel near King's Cross station.",
      "Could you please tell me the most convenient way to take the train into central London?"
    ]
  },
  {
    id: 'business_negotiation',
    title: 'Đàm Phán & Thuyết Trình Doanh Nghiệp',
    role: 'Project Manager / Sales Lead',
    aiRole: 'Client Representative / Partner Director',
    icon: '🤝',
    badge: 'Business C1/C2',
    description: 'Thương thảo hợp đồng dự án, giải trình ngân sách, thời hạn bàn giao và xử lý các phản hồi từ phía khách hàng doanh nghiệp.',
    initialMessage: "Good morning! Thank you for scheduling this meeting. We've reviewed your project proposal, but we have some concerns regarding the implementation timeline and overall budget. Could you walk us through the breakdown?",
    systemPrompt: 'You are a discerning Corporate Client Director reviewing an enterprise software proposal. Engage diplomatically, negotiate on scope, timeline, and SLA commitments using advanced business English.',
    steps: [
      'Bước 1: Trình bày tổng quan giá trị dự án (Value proposition & Project scope)',
      'Bước 2: Giải trình lộ trình và thời hạn bàn giao (Timeline & Milestone breakdown)',
      'Bước 3: Thảo luận về chi phí và cam kết bảo hành (Budget & SLA guarantees)',
      'Bước 4: Chốt thỏa thuận và các bước triển khai tiếp theo (Next steps & Agreement)'
    ],
    suggestedPrompts: [
      "Our proposed timeline is structured into three distinct milestones to ensure risk mitigation and continuous delivery.",
      "The investment includes comprehensive 24/7 post-deployment support and rigorous security audits.",
      "We can offer a flexible phased rollout to align seamlessly with your quarterly budget constraints."
    ]
  },
  {
    id: 'ielts_speaking',
    title: 'Luyện Thi IELTS Speaking Master (Part 1-3)',
    role: 'IELTS Candidate',
    aiRole: 'Cambridge IELTS Examiner',
    icon: '🎯',
    badge: 'IELTS Band 8.0+',
    description: 'Mô phỏng kỳ thi IELTS Speaking chuẩn quốc tế với 3 phần thi toàn diện, đánh giá Lexical Resource, Fluency, Grammar & Pronunciation.',
    initialMessage: "Good afternoon. Welcome to the IELTS Speaking assessment. In this first part, I'd like to ask you some questions about your hobbies and daily life. What do you enjoy doing in your free time?",
    systemPrompt: 'You are an official Cambridge IELTS Examiner. Ask structured IELTS questions across Part 1, 2, and 3. Provide academic C1/C2 vocabulary alternatives and idiomatic expressions in the feedback JSON.',
    steps: [
      'Part 1: Câu hỏi khởi động về sở thích và thói quen thường nhật (Hobbies & Daily Routine)',
      'Part 2: Thuyết trình 2 phút theo chủ đề cụ thể (Cue Card 2-minute topic)',
      'Part 3: Thảo luận chuyên sâu các vấn đề trừu tượng xã hội (Abstract discussion & Analysis)',
      'Đánh giá: Tổng kết điểm mạnh và từ vựng band 8.0+ gợi ý (Band score feedback)'
    ],
    suggestedPrompts: [
      "In my leisure time, I am particularly keen on reading non-fiction books because they broaden my horizons.",
      "Personally, I believe technological advancements have revolutionized the way people communicate in modern society.",
      "From my perspective, sustainable lifestyle practices are imperative to combat environmental degradation."
    ]
  }
];

export async function generateAIResponse(
  apiKey: string,
  scenario: RoleplayScenario,
  userMessage: string,
  conversationHistory: Array<{ sender: 'user' | 'ai'; text: string }>
): Promise<GenerateChatResponseResult> {
  // 1. Nếu có API Key, gọi Google Gemini API
  if (apiKey && apiKey.trim().length > 10) {
    try {
      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey.trim()}`;

      const historyFormatted = conversationHistory.slice(-6).map((msg) => ({
        role: msg.sender === 'user' ? 'user' : 'model',
        parts: [{ text: msg.text }],
      }));

      const systemInstruction = `
You are an expert English Tutor and active roleplay partner in the following scenario:
Scenario: "${scenario.title}"
AI Persona: "${scenario.aiRole}"
User Persona: "${scenario.role}"
Base System Prompt: ${scenario.systemPrompt}

Scenario Key Steps:
${scenario.steps ? scenario.steps.join('\n') : ''}

CRITICAL REQUIREMENT:
Respond strictly with a valid JSON object without any Markdown code blocks or backticks.
The JSON object must have this exact structure:
{
  "reply": "Your in-character reply to the user in natural, fluent English (1-3 sentences)",
  "feedback": {
    "original": "The exact sentence or key phrase spoken by user",
    "correction": "The grammatically correct and natural version",
    "explanation": "Short helpful explanation in Vietnamese about why this phrasing is better or what grammar nuance was corrected",
    "betterPhrasing": "An advanced native speaker way of expressing the same idea (C1/C2 register)",
    "vocabularyTips": ["2-3 useful collocations, idioms, or power words relevant to this context"]
  }
}

If the user's sentence is already correct, provide 'betterPhrasing' (C1/C2 level) and keep 'explanation' encouraging in Vietnamese.
`;

      const body = {
        contents: [
          ...historyFormatted,
          {
            role: 'user',
            parts: [{ text: `${systemInstruction}\n\nUser Message:\n"${userMessage}"` }],
          },
        ],
        generationConfig: {
          temperature: 0.6,
          topP: 0.9,
          maxOutputTokens: 800,
        },
      };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        const data = await res.json();
        const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        const cleaned = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(cleaned);

        if (parsed.reply) {
          return {
            reply: parsed.reply,
            feedback: parsed.feedback,
          };
        }
      }
    } catch (err) {
      console.warn('Gemini API call failed, using intelligent mock fallback:', err);
    }
  }

  // 2. Intelligent Mock Engine Fallback (Khi chưa gắn API key hoặc lỗi mạng)
  await new Promise((resolve) => setTimeout(resolve, 600));
  return generateMockScenarioResponse(scenario, userMessage);
}

function generateMockScenarioResponse(
  scenario: RoleplayScenario,
  userMessage: string
): GenerateChatResponseResult {
  const lower = userMessage.toLowerCase();

  if (scenario.id === 'tech_interview') {
    if (lower.includes('experience') || lower.includes('project') || lower.includes('developer') || lower.includes('years') || lower.includes('backend') || lower.includes('frontend')) {
      return {
        reply: "That sounds like a very solid background! Could you dive deeper into how you designed your backend microservices, handled database indexing, and minimized latency under high traffic?",
        feedback: {
          original: userMessage,
          correction: userMessage.charAt(0).toUpperCase() + userMessage.slice(1),
          explanation: 'Cách trả lời rõ ràng. Trong phỏng vấn kỹ thuật, hãy áp dụng công thức STAR (Situation, Task, Action, Result) để nêu bật thành tích định lượng.',
          betterPhrasing: `I have accumulated hands-on experience in architecting resilient microservices and optimizing data pipelines for high-throughput environments.`,
          vocabularyTips: ['High-throughput environment (Môi trường lưu lượng cao)', 'Resilient microservices (Vi dịch vụ có tính chịu lỗi cao)', 'Database indexing (Đánh chỉ mục cơ sở dữ liệu)'],
        },
      };
    }

    if (lower.includes('latency') || lower.includes('redis') || lower.includes('cache') || lower.includes('optimize') || lower.includes('scale')) {
      return {
        reply: "Excellent approach to performance optimization. How do you manage continuous integration and deployment (CI/CD) workflows, and how do you ensure zero-downtime releases?",
        feedback: {
          original: userMessage,
          correction: userMessage,
          explanation: 'Bạn đã sử dụng thuật ngữ IT rất chuẩn xác. Thêm một số từ nối học thuật sẽ giúp câu nói tự nhiên hơn.',
          betterPhrasing: `By leveraging distributed caching and asynchronous message queues, we successfully mitigated latency bottlenecks and scaled seamlessly.`,
          vocabularyTips: ['Distributed caching (Bộ nhớ đệm phân tán)', 'Zero-downtime deployment (Triển khai không gián đoạn)', 'Bottleneck mitigation (Khắc phục điểm nghẽn)'],
        },
      };
    }

    return {
      reply: "Thank you for explaining that! What would you consider your greatest technical strength, and how do you stay updated with emerging software engineering technologies?",
      feedback: {
        original: userMessage,
        correction: userMessage,
        explanation: 'Ý tứ mạch lạc. Bạn có thể nhấn mạnh thêm tinh thần Continuous Learning (học hỏi liên tục) trong môi trường công nghệ.',
        betterPhrasing: `I take pride in my problem-solving acumen and proactive mindset toward adopting modern cloud-native architectures.`,
        vocabularyTips: ['Problem-solving acumen (Sự nhạy bén giải quyết vấn đề)', 'Cloud-native architecture (Kiến trúc chuẩn điện toán đám mây)'],
      },
    };
  }

  if (scenario.id === 'daily_standup') {
    if (lower.includes('yesterday') || lower.includes('today') || lower.includes('done') || lower.includes('working') || lower.includes('blocker')) {
      return {
        reply: "Thanks for the clear update! Do you need anyone from the team to assist with testing or reviewing your pull request before we deploy to the staging environment?",
        feedback: {
          original: userMessage,
          correction: userMessage,
          explanation: 'Báo cáo ngắn gọn, đúng chuẩn phong cách họp Daily Standup trong môi trường Agile.',
          betterPhrasing: `Yesterday I wrapped up the core API refactoring, and today my main focus is delivering the automated integration tests before opening a PR.`,
          vocabularyTips: ['Pull request (Yêu cầu gộp mã)', 'Staging environment (Môi trường thử nghiệm)', 'Automated integration test (Kiểm thử tích hợp tự động)'],
        },
      };
    }

    return {
      reply: "Great! Let's make sure we track those action items on Jira. If you run into any unexpected blockers, please post them on our Slack channel right away.",
      feedback: {
        original: userMessage,
        correction: userMessage,
        explanation: 'Giao tiếp nhanh gọn, chuyên nghiệp.',
        betterPhrasing: `I'm currently on track with the sprint deliverables, though I will promptly flag any dependencies should they arise.`,
        vocabularyTips: ['Sprint deliverables (Hạng mục cần bàn giao trong sprint)', 'Action items (Các đầu việc cần thực hiện)'],
      },
    };
  }

  if (scenario.id === 'travel_airport') {
    if (lower.includes('passport') || lower.includes('vacation') || lower.includes('stay') || lower.includes('hotel') || lower.includes('visit')) {
      return {
        reply: "Thank you. Everything looks in order with your documentation! How long do you plan to stay in the UK, and do you have your return ticket booked?",
        feedback: {
          original: userMessage,
          correction: userMessage,
          explanation: 'Câu trả lời tự nhiên và lịch sự khi giao tiếp với nhân viên hải quan.',
          betterPhrasing: `Here are my travel documents. I have booked a round-trip ticket for a two-week sightseeing holiday.`,
          vocabularyTips: ['Round-trip ticket (Vé khứ hồi)', 'Sightseeing holiday (Kỳ nghỉ tham quan)', 'Customs clearance (Thông quan hải quan)'],
        },
      };
    }

    return {
      reply: "Welcome to London! Once you collect your baggage from Carousel 4, you can take the Elizabeth Line train straight into central London in about 30 minutes. Have a wonderful trip!",
      feedback: {
        original: userMessage,
        correction: userMessage,
        explanation: 'Cách hỏi đường và giao tiếp đời sống rất lưu loát.',
        betterPhrasing: `Could you kindly direct me to the baggage reclaim area and the nearest public transit station?`,
        vocabularyTips: ['Baggage reclaim (Khu vực nhận lại hành lý)', 'Public transit (Phương tiện giao thông công cộng)'],
      },
    };
  }

  if (scenario.id === 'business_negotiation') {
    return {
      reply: "We appreciate the comprehensive explanation. If we agree to the phased payment schedule, could your team commit to delivering the MVP ahead of the Q3 release?",
      feedback: {
        original: userMessage,
        correction: userMessage,
        explanation: 'Phong thái đàm phán tự tin và chuẩn mực ngôn ngữ doanh nghiệp C1/C2.',
        betterPhrasing: `We are confident that aligning our milestones with your strategic objectives will maximize ROI and mitigate operational risks.`,
        vocabularyTips: ['Strategic objective (Mục tiêu chiến lược)', 'Mitigate operational risk (Giảm thiểu rủi ro vận hành)', 'Milestone delivery (Bàn giao theo từng giai đoạn)'],
      },
    };
  }

  // Fallback IELTS / General
  return {
    reply: "That is a compelling point. Could you elaborate further on how this trend has evolved over the past decade and what impact it might have on future generations?",
    feedback: {
      original: userMessage,
      correction: userMessage,
      explanation: 'Ý tưởng phong phú. Hãy sử dụng thêm các cấu trúc so sánh phức và từ nối học thuật như "Consequently", "On the other hand", "It is evident that...".',
      betterPhrasing: `To elaborate further, I would argue that this phenomenon plays an indispensable role in shaping contemporary societal dynamics.`,
      vocabularyTips: ['Indispensable role (Vai trò không thể thiếu)', 'Contemporary society (Xã hội đương đại)', 'Broaden one\'s horizon (Mở rộng tầm mắt)'],
    },
  };
}
