import { ChatFeedback, RoleplayScenario } from '../types';

export interface GenerateChatResponseResult {
  reply: string;
  feedback?: ChatFeedback;
}

// 5 Kịch bản nhập vai thực tế chất lượng cao
export const ROLEPLAY_SCENARIOS: RoleplayScenario[] = [
  {
    id: 'tech_interview',
    title: 'Phỏng Vấn Software Engineer',
    role: 'Candidate (Ứng viên)',
    aiRole: 'Senior Tech Lead / Interviewer',
    icon: '💼',
    badge: 'Tech Career',
    description: 'Thử thách phỏng vấn kỹ thuật bằng tiếng Anh: giới thiệu bản thân, giải thích kiến trúc hệ thống và xử lý tình huống thực tế.',
    initialMessage: "Hi there! Welcome to our technical interview. Could you please introduce yourself and tell me about a challenging project you've worked on recently?",
    systemPrompt: 'You are a friendly but professional Senior Tech Lead interviewing a software engineering candidate. Maintain a natural conversational tone, ask follow-up technical questions based on their answers, and evaluate both their technical clarity and English communication skills.',
  },
  {
    id: 'daily_standup',
    title: 'Họp Sprint & Thảo Luận Kỹ Thuật',
    role: 'Developer',
    aiRole: 'Scrum Master / Team Lead',
    icon: '🏢',
    badge: 'Workplace',
    description: 'Tham gia buổi họp Daily Standup: cập nhật tiến độ công việc, báo cáo blocker và thảo luận giải pháp cùng Team Lead.',
    initialMessage: "Good morning team! Let's kick off our Daily Standup. What did you work on yesterday, what are you working on today, and do you have any blockers?",
    systemPrompt: 'You are an energetic Scrum Master running a daily standup meeting in an international tech company. Respond positively, ask clarifying questions on deadlines and blockers, and use common Agile/Scrum vocabulary.',
  },
  {
    id: 'networking_coffee',
    title: 'Giao Tiếp Công Sở & Small Talk',
    role: 'Colleague',
    aiRole: 'Coworker from London',
    icon: '☕',
    badge: 'Social & Daily',
    description: 'Trò chuyện thân mật giờ nghỉ giải lao: thảo luận về sở thích, kế hoạch cuối tuần và kết nối quan hệ đồng nghiệp.',
    initialMessage: "Hey! Taking a coffee break too? How has your week been going so far? Any fun plans for the upcoming weekend?",
    systemPrompt: 'You are a friendly coworker from London having a casual coffee break conversation. Use natural British/international idioms, friendly tone, and engage in warm small talk.',
  },
  {
    id: 'travel_airport',
    title: 'Sân Bay & Du Lịch Quốc Tế',
    role: 'Traveler',
    aiRole: 'Customs / Airline Agent',
    icon: '🛫',
    badge: 'Travel',
    description: 'Thực hành giao tiếp khi làm thủ tục check-in, qua cổng hải quan và xử lý các tình huống tại sân bay quốc tế.',
    initialMessage: "Good day, sir/madam. May I please see your passport, boarding pass, and destination arrival card?",
    systemPrompt: 'You are an airport check-in and customs officer. Speak clearly and politely, ask standard immigration and travel questions, and verify travel purposes.',
  },
  {
    id: 'ielts_speaking',
    title: 'Luyện Thi IELTS Speaking (Part 1-3)',
    role: 'IELTS Candidate',
    aiRole: 'IELTS Examiner',
    icon: '🎯',
    badge: 'IELTS Band 7.5+',
    description: 'Mô phỏng phòng thi IELTS Speaking chuẩn Cambridge: câu hỏi gợi mở, mở rộng ý và nhận xét tiêu chí Lexical Resource & Fluency.',
    initialMessage: "Good afternoon. Welcome to the IELTS Speaking test. In this first part, I'd like to ask you some questions about your hometown and daily routines.",
    systemPrompt: 'You are an official IELTS Speaking Examiner. Ask structured IELTS questions across Part 1, 2, and 3. In the feedback JSON, provide high-band lexical suggestions and idiomatic expressions.',
  },
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
You are an expert English Tutor and roleplay partner in the following scenario:
Scenario: "${scenario.title}"
AI Persona: "${scenario.aiRole}"
User Persona: "${scenario.role}"
Base System Prompt: ${scenario.systemPrompt}

CRITICAL REQUIREMENT:
You must respond strictly with a valid JSON object without any Markdown fences or backticks (or wrapped in standard JSON format).
The JSON object must have this exact structure:
{
  "reply": "Your in-character reply to the user in natural English",
  "feedback": {
    "original": "The exact sentence or phrase spoken by user that can be improved",
    "correction": "The grammatically correct and natural version",
    "explanation": "Short helpful explanation in Vietnamese about why this is better or what grammar/vocabulary error was fixed",
    "betterPhrasing": "An advanced native speaker way of expressing the same thought",
    "vocabularyTips": ["1-2 useful idioms, collocations or power words relevant to this context"]
  }
}

If the user's sentence is already 100% grammatically correct, you should still provide "betterPhrasing" and "vocabularyTips" to help them speak like a native (C1/C2 level) and keep "explanation" as "Câu nói của bạn rất chuẩn xác! Dưới đây là cách diễn đạt nâng cao hơn."
`;

      const body = {
        contents: [
          ...historyFormatted,
          {
            role: 'user',
            parts: [{ text: `${systemInstruction}\n\nUser Message: "${userMessage}"` }],
          },
        ],
        generationConfig: {
          temperature: 0.7,
          topP: 0.9,
          maxOutputTokens: 800,
        },
      };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        throw new Error(`Gemini API Error: ${res.statusText}`);
      }

      const data = await res.json();
      const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

      // Parse JSON from output
      const cleaned = rawText.replace(/```json/gi, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleaned);

      if (parsed.reply) {
        return {
          reply: parsed.reply,
          feedback: parsed.feedback,
        };
      }
    } catch (err) {
      console.warn('Gemini API call failed, using intelligent mock fallback:', err);
    }
  }

  // 2. Intelligent Mock Engine (Fallback khi chưa nhập API key hoặc lỗi mạng)
  await new Promise((resolve) => setTimeout(resolve, 800)); // Giả lập độ trễ mạng thực tế

  return generateMockScenarioResponse(scenario, userMessage);
}

function generateMockScenarioResponse(
  scenario: RoleplayScenario,
  userMessage: string
): GenerateChatResponseResult {
  const lower = userMessage.toLowerCase();

  if (scenario.id === 'tech_interview') {
    if (lower.includes('hi') || lower.includes('hello') || lower.includes('my name') || lower.includes('experience')) {
      return {
        reply: "That's great to hear! It sounds like you have solid hands-on experience. Could you dive deeper into how you handled state management and optimized application performance in that project?",
        feedback: {
          original: userMessage,
          correction: userMessage.charAt(0).toUpperCase() + userMessage.slice(1),
          explanation: 'Cấu trúc câu tự nhiên. Trong phỏng vấn, bạn nên áp dụng mô hình STAR (Situation, Task, Action, Result) để câu trả lời thêm phần thuyết phục.',
          betterPhrasing: `I have accumulated extensive experience in designing scalable architectures, with a strong focus on high-availability systems.`,
          vocabularyTips: ['Scalable architecture (Kiến trúc mở rộng)', 'State management (Quản lý trạng thái)', 'Bottleneck mitigation (Giải quyết điểm nghẽn)'],
        },
      };
    }

    return {
      reply: "Interesting approach! How did you ensure test coverage and continuous deployment while maintaining system reliability during peak traffic?",
      feedback: {
        original: userMessage,
        correction: userMessage,
        explanation: 'Cách trả lời tốt. Hãy nhấn mạnh thêm các chỉ số định lượng (ví dụ: reduced latency by 30%, improved throughput).',
        betterPhrasing: `We successfully streamlined our CI/CD pipeline, which bolstered deployment velocity and overall system resilience.`,
        vocabularyTips: ['Continuous deployment (Triển khai liên tục)', 'System resilience (Khả năng chịu lỗi của hệ thống)'],
      },
    };
  }

  if (scenario.id === 'daily_standup') {
    return {
      reply: "Thanks for the update! Let's make sure that pull request is reviewed before noon. Do you need any assistance from the DevOps team regarding the staging deployment?",
      feedback: {
        original: userMessage,
        correction: userMessage,
        explanation: 'Câu nói ngắn gọn, đúng phong cách Daily Standup. Có thể dùng thêm các cụm từ chuyên môn Agile.',
        betterPhrasing: `Yesterday, I tackled the core API endpoints, and today my top priority is finalizing the unit tests before requesting a code review.`,
        vocabularyTips: ['Blocker (Vấn đề gây tắc nghẽn)', 'Pull request (Yêu cầu gộp mã)', 'Staging environment (Môi trường thử nghiệm)'],
      },
    };
  }

  // Default Fallback
  return {
    reply: `That makes a lot of sense! I really appreciate your perspective on this. Could you elaborate a bit more on what specific steps you would take next?`,
    feedback: {
      original: userMessage,
      correction: userMessage,
      explanation: 'Ý tứ rõ ràng. Để tăng tính tự nhiên chuẩn bản xứ, bạn có thể sử dụng thêm các từ nối như "Furthermore", "In terms of...", "From my perspective...".',
      betterPhrasing: `To elaborate further, I believe the most effective course of action involves a comprehensive evaluation of the core parameters.`,
      vocabularyTips: ['From my perspective (Theo góc nhìn của tôi)', 'Comprehensive evaluation (Đánh giá toàn diện)'],
    },
  };
}
