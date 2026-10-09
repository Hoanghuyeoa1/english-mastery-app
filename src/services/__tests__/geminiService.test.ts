import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { 
  generateAIResponse, 
  testGeminiApiKey, 
  ROLEPLAY_SCENARIOS 
} from '../geminiService';
import { translateWithContext } from '../aiTranslationService';

describe('Gemini Service & AI Translation Resilience', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  describe('testGeminiApiKey', () => {
    it('should return failure for empty key', async () => {
      const res = await testGeminiApiKey('');
      expect(res.success).toBe(false);
      expect(res.message).toContain('không được để trống');
    });

    it('should return failure for key with length < 10', async () => {
      const res = await testGeminiApiKey('AIza123');
      expect(res.success).toBe(false);
      expect(res.message).toContain('quá ngắn');
    });

    it('should handle HTTP 400 (Invalid key format)', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
      } as Response);

      const res = await testGeminiApiKey('AIzaSyDummyKeyThatIsInvalid');
      expect(res.success).toBe(false);
      expect(res.status).toBe(400);
      expect(res.message).toContain('HTTP 400');
    });

    it('should handle HTTP 403 (Permission denied / blocked)', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
      } as Response);

      const res = await testGeminiApiKey('AIzaSyDummyKeyWithNoPermissions');
      expect(res.success).toBe(false);
      expect(res.status).toBe(403);
      expect(res.message).toContain('HTTP 403');
    });

    it('should handle HTTP 429 (Rate limit)', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
      } as Response);

      const res = await testGeminiApiKey('AIzaSyDummyKeyRateLimited');
      expect(res.success).toBe(false);
      expect(res.status).toBe(429);
      expect(res.message).toContain('HTTP 429');
    });

    it('should handle network error gracefully without throwing', async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new Error('Failed to fetch'));

      const res = await testGeminiApiKey('AIzaSyDummyKeyNetworkDown');
      expect(res.success).toBe(false);
      expect(res.message).toContain('kết nối');
    });

    it('should return success when response is OK', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ candidates: [{ content: { parts: [{ text: 'pong' }] } }] }),
      } as Response);

      const res = await testGeminiApiKey('AIzaSyValidDummyKey1234567890');
      expect(res.success).toBe(true);
      expect(res.message).toContain('thành công');
    });
  });

  describe('generateAIResponse', () => {
    const scenario = ROLEPLAY_SCENARIOS[0]; // tech_interview

    it('should return intelligent mock with isFallback: true when apiKey is empty', async () => {
      const result = await generateAIResponse('', scenario, 'I have experience in microservices', []);
      expect(result).toBeDefined();
      expect(result.isFallback).toBe(true);
      expect(typeof result.reply).toBe('string');
      expect(result.reply.length).toBeGreaterThan(0);
      expect(result.feedback).toBeDefined();
    });

    it('should return intelligent mock with isFallback: true when API returns error (e.g. 400)', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
      } as Response);

      const result = await generateAIResponse('AIzaSyInvalidKey12345', scenario, 'Hello', []);
      expect(result.isFallback).toBe(true);
      expect(typeof result.reply).toBe('string');
      expect(result.feedback).toBeDefined();
    });

    it('should return intelligent mock with isFallback: true when network fetch throws', async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new Error('Network offline'));

      const result = await generateAIResponse('AIzaSyValidFormatKey12345', scenario, 'How to reduce latency?', []);
      expect(result.isFallback).toBe(true);
      expect(result.reply).toContain('optimization');
    });

    it('should return live API response with isFallback: false when Gemini succeeds', async () => {
      const mockApiReply = {
        reply: 'Tell me about how you handled the database scaling.',
        feedback: {
          original: 'I scaled the db',
          correction: 'I scaled the database',
          explanation: 'Good description',
          betterPhrasing: 'I architected scalable database clusters.',
          vocabularyTips: ['Scalable clusters'],
        },
      };

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [{ text: JSON.stringify(mockApiReply) }],
              },
            },
          ],
        }),
      } as Response);

      const result = await generateAIResponse('AIzaSyValidFormatKey12345', scenario, 'I scaled the db', []);
      expect(result.isFallback).toBe(false);
      expect(result.reply).toBe(mockApiReply.reply);
      expect(result.feedback?.correction).toBe('I scaled the database');
    });
  });

  describe('translateWithContext', () => {
    it('should return empty result with isFallback: false when text is blank', async () => {
      const res = await translateWithContext('   ', 'en', 'vi', 'tech');
      expect(res.standard).toBe('');
      expect(res.isFallback).toBe(false);
      expect(res.isAiPowered).toBe(false);
    });

    it('should fallback gracefully to smart semantic offline engine when apiKey is missing', async () => {
      const res = await translateWithContext(
        'We need to optimize our backend microservices to minimize latency and improve scalability.',
        'en',
        'vi',
        'tech'
      );
      expect(res.isFallback).toBe(true);
      expect(res.isAiPowered).toBe(false);
      expect(res.standard).toContain('vi dịch vụ backend');
      expect(res.standard).toContain('độ trễ');
      expect(res.collocations.length).toBeGreaterThan(0);
    });

    it('should fallback gracefully to smart semantic offline engine when API returns error', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests',
      } as Response);

      const res = await translateWithContext(
        'We need to optimize our backend microservices to minimize latency and improve scalability.',
        'en',
        'vi',
        'tech',
        'AIzaSyInvalidKey12345'
      );
      expect(res.isFallback).toBe(true);
      expect(res.isAiPowered).toBe(false);
      expect(res.standard).toBeTruthy();
    });

    it('should return live AI translation with isFallback: false when Gemini succeeds', async () => {
      const mockResult = {
        standard: 'Chúng tôi cần tối ưu vi dịch vụ backend.',
        formal: 'Việc tối ưu hóa các vi dịch vụ backend là cần thiết.',
        casual: 'Tụi mình tối ưu backend nhé.',
        collocations: [{ phrase: 'backend microservices', meaning: 'vi dịch vụ', note: '' }],
        contextNote: 'Văn phong công nghệ',
      };

      globalThis.fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          candidates: [
            {
              content: {
                parts: [{ text: JSON.stringify(mockResult) }],
              },
            },
          ],
        }),
      } as Response);

      const res = await translateWithContext('We need to optimize backend', 'en', 'vi', 'tech', 'AIzaSyValidKey12345');
      expect(res.isFallback).toBe(false);
      expect(res.isAiPowered).toBe(true);
      expect(res.standard).toBe('Chúng tôi cần tối ưu vi dịch vụ backend.');
    });
  });
});
