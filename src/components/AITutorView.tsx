import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Bot, 
  Send, 
  Mic, 
  MicOff, 
  Volume2, 
  Key, 
  Sparkles, 
  Lightbulb, 
  Check, 
  RotateCcw, 
  X, 
  Info,
  ChevronDown,
  ChevronUp,
  User,
  ShieldCheck
} from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { speakWord, createSpeechRecognizer } from '../services/speechService';
import { 
  ROLEPLAY_SCENARIOS, 
  generateAIResponse 
} from '../services/geminiService';
import { ChatMessage, RoleplayScenario } from '../types';

export const AITutorView: React.FC = () => {
  const { 
    geminiApiKey, 
    setGeminiApiKey, 
    audioVoice, 
    audioSpeed, 
    gainXP, 
    profile 
  } = useAppStore();

  const [selectedScenario, setSelectedScenario] = useState<RoleplayScenario>(ROLEPLAY_SCENARIOS[0]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isKeyModalOpen, setIsKeyModalOpen] = useState(false);
  const [tempApiKey, setTempApiKey] = useState(geminiApiKey || '');
  const [expandedFeedbackId, setExpandedFeedbackId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Khởi tạo tin nhắn chào hỏi của kịch bản
  useEffect(() => {
    setMessages([
      {
        id: `ai_init_${Date.now()}`,
        sender: 'ai',
        text: selectedScenario.initialMessage,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
    setExpandedFeedbackId(null);
  }, [selectedScenario]);

  // Tự động cuộn xuống cuối khi có tin nhắn mới
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend || inputText).trim();
    if (!text || isLoading) return;

    const userMsgId = `user_${Date.now()}`;
    const userMsg: ChatMessage = {
      id: userMsgId,
      sender: 'user',
      text,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputText('');
    setIsLoading(true);

    try {
      const historyFormatted = messages.map((m) => ({
        sender: m.sender,
        text: m.text,
      }));

      const res = await generateAIResponse(
        geminiApiKey,
        selectedScenario,
        text,
        historyFormatted
      );

      // Cập nhật feedback vào tin nhắn của user
      if (res.feedback) {
        setMessages((prev) =>
          prev.map((m) => (m.id === userMsgId ? { ...m, feedback: res.feedback } : m))
        );
        setExpandedFeedbackId(userMsgId);
      }

      // Thêm tin nhắn phản hồi của AI
      const aiMsg: ChatMessage = {
        id: `ai_${Date.now()}`,
        sender: 'ai',
        text: res.reply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, aiMsg]);
      gainXP(10);
    } catch (err) {
      console.error('Lỗi sinh phản hồi AI:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Thu âm bằng Micro qua Web Speech API
  const handleToggleVoiceRecord = () => {
    if (isRecording) {
      setIsRecording(false);
      return;
    }

    const recognizer = createSpeechRecognizer(
      (transcriptText, isFinal) => {
        setInputText(transcriptText);
        if (isFinal) {
          setIsRecording(false);
          if (transcriptText.trim().length > 0) {
            handleSendMessage(transcriptText);
          }
        }
      },
      (err) => {
        console.warn('Speech error:', err);
        setIsRecording(false);
      }
    );

    if (recognizer) {
      setIsRecording(true);
    }
  };

  const handleSaveApiKey = () => {
    setGeminiApiKey(tempApiKey.trim());
    setIsKeyModalOpen(false);
  };

  const handleResetChat = () => {
    setMessages([
      {
        id: `ai_init_${Date.now()}`,
        sender: 'ai',
        text: selectedScenario.initialMessage,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
    setExpandedFeedbackId(null);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      
      {/* 1. Header & Scenario Selector Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-slate-800">
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2.5">
              <Bot className="w-6 h-6 text-cyan-400" />
              <span>AI Tutor: Luyện Hội Thoại Nhập Vai</span>
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">
              Nhập vai tình huống thực tế, AI phản hồi tự nhiên & phân tích sửa lỗi ngữ pháp từng câu
            </p>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            {/* API Key Modal Button */}
            <button
              onClick={() => {
                setTempApiKey(geminiApiKey || '');
                setIsKeyModalOpen(true);
              }}
              className={`flex-1 sm:flex-initial flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-all border ${
                geminiApiKey
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20'
                  : 'bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-750'
              }`}
            >
              <Key className="w-3.5 h-3.5" />
              <span>{geminiApiKey ? 'Gemini API: Đã kết nối' : 'Cài đặt API Key'}</span>
            </button>

            {/* Reset Chat Button */}
            <button
              onClick={handleResetChat}
              title="Bắt đầu lại cuộc trò chuyện này"
              className="p-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white rounded-xl transition-all"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Scenario Pill Badges */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
          {ROLEPLAY_SCENARIOS.map((sc) => {
            const isSelected = selectedScenario.id === sc.id;
            return (
              <button
                key={sc.id}
                onClick={() => setSelectedScenario(sc)}
                className={`px-4 py-2.5 rounded-2xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-2 border ${
                  isSelected
                    ? 'bg-cyan-500/15 border-cyan-400 text-cyan-300 shadow-md shadow-cyan-500/10'
                    : 'bg-slate-850/80 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
              >
                <span className="text-base">{sc.icon}</span>
                <span>{sc.title}</span>
              </button>
            );
          })}
        </div>

        {/* Scenario Info Bar */}
        <div className="p-3.5 bg-slate-850/90 border border-slate-800 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-slate-300">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 bg-cyan-500/20 text-cyan-400 font-bold rounded-lg border border-cyan-500/30">
              {selectedScenario.badge}
            </span>
            <span>
              Bạn đóng vai: <strong className="text-white">{selectedScenario.role}</strong> • AI đóng vai: <strong className="text-cyan-400">{selectedScenario.aiRole}</strong>
            </span>
          </div>
          <span className="text-slate-400 italic text-[11px]">
            {selectedScenario.description}
          </span>
        </div>
      </div>

      {/* 2. Main Chat Message Container */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 sm:p-6 shadow-2xl space-y-4 min-h-[480px] max-h-[580px] overflow-y-auto flex flex-col justify-between">
        
        {/* Message Stream */}
        <div className="space-y-4">
          {messages.map((msg) => {
            const isUser = msg.sender === 'user';
            const isFeedbackExpanded = expandedFeedbackId === msg.id;

            return (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
              >
                {/* Bubble message */}
                <div className="flex items-start gap-2.5 max-w-[88%] sm:max-w-[80%]">
                  {!isUser && (
                    <div className="w-8 h-8 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 flex items-center justify-center shrink-0 mt-0.5">
                      <Bot className="w-4 h-4" />
                    </div>
                  )}

                  <div className="space-y-1">
                    <div
                      className={`p-4 rounded-3xl text-sm sm:text-base leading-relaxed ${
                        isUser
                          ? 'bg-gradient-to-r from-emerald-600 to-teal-500 text-white rounded-br-none shadow-lg'
                          : 'bg-slate-800 text-slate-100 rounded-bl-none border border-slate-700 shadow-md'
                      }`}
                    >
                      <p>{msg.text}</p>
                    </div>

                    <div className={`flex items-center gap-2 text-[10px] text-slate-500 px-1 ${isUser ? 'justify-end' : 'justify-start'}`}>
                      <span>{msg.timestamp}</span>
                      {!isUser && (
                        <button
                          onClick={() => speakWord(msg.text, audioVoice, audioSpeed)}
                          title="Nghe phát âm AI"
                          className="hover:text-cyan-400 transition-colors flex items-center gap-0.5"
                        >
                          <Volume2 className="w-3 h-3" />
                          <span>Nghe</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {isUser && (
                    <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                      <User className="w-4 h-4" />
                    </div>
                  )}
                </div>

                {/* Grammar & Vocabulary Feedback Box for User's message - Aligned neatly below user bubble */}
                {isUser && msg.feedback && (
                  <div className="w-full max-w-[88%] sm:max-w-[80%] mt-1.5 pr-10">
                    <div className="bg-slate-950/90 border border-amber-500/30 rounded-2xl p-3 space-y-2 shadow-lg">
                      <div 
                        onClick={() => setExpandedFeedbackId(isFeedbackExpanded ? null : msg.id)}
                        className="flex items-center justify-between cursor-pointer select-none text-xs font-bold text-amber-400 hover:text-amber-300 transition-colors"
                      >
                        <div className="flex items-center gap-1.5">
                          <Lightbulb className="w-4 h-4 text-amber-400 shrink-0" />
                          <span>💡 Góp ý sửa lỗi & cách dùng từ hay hơn</span>
                        </div>
                        {isFeedbackExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </div>

                      {isFeedbackExpanded && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          className="pt-2 border-t border-slate-800/80 space-y-2.5 text-xs text-slate-300"
                        >
                          {/* Correction */}
                          <div>
                            <span className="text-[11px] font-semibold text-slate-400">Câu sửa chuẩn ngữ pháp:</span>
                            <p className="font-semibold text-emerald-400 bg-emerald-500/10 p-2 rounded-xl border border-emerald-500/20 mt-0.5">
                              {msg.feedback.correction}
                            </p>
                          </div>

                          {/* Explanation */}
                          {msg.feedback.explanation && (
                            <div>
                              <span className="text-[11px] font-semibold text-slate-400">Giải thích:</span>
                              <p className="text-slate-300 mt-0.5 italic">
                                {msg.feedback.explanation}
                              </p>
                            </div>
                          )}

                          {/* Better Native Phrasing */}
                          {msg.feedback.betterPhrasing && (
                            <div>
                              <span className="text-[11px] font-semibold text-cyan-400">Cách diễn đạt nâng cao chuẩn bản xứ (C1/C2):</span>
                              <p className="text-cyan-200 bg-cyan-500/10 p-2 rounded-xl border border-cyan-500/20 mt-0.5 font-medium">
                                "{msg.feedback.betterPhrasing}"
                              </p>
                            </div>
                          )}

                          {/* Vocabulary Tips */}
                          {msg.feedback.vocabularyTips && msg.feedback.vocabularyTips.length > 0 && (
                            <div>
                              <span className="text-[11px] font-semibold text-amber-400">Từ vựng & Cụm từ nên dùng:</span>
                              <div className="flex flex-wrap gap-1.5 mt-1">
                                {msg.feedback.vocabularyTips.map((tip, idx) => (
                                  <span key={idx} className="px-2 py-0.5 bg-amber-500/10 text-amber-300 rounded-lg text-[11px] border border-amber-500/20 font-mono">
                                    {tip}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </motion.div>
                      )}
                    </div>
                  </div>
                )}
              </motion.div>
            );
          })}

          {isLoading && (
            <div className="flex items-center gap-2 text-xs text-cyan-400 p-2">
              <Sparkles className="w-4 h-4 animate-spin" />
              <span>AI Tutor đang suy nghĩ và phân tích phản hồi...</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* 3. Input & Voice Controls */}
        <div className="pt-4 border-t border-slate-800">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage();
            }}
            className="flex items-center gap-2"
          >
            {/* Mic voice button */}
            <button
              type="button"
              onClick={handleToggleVoiceRecord}
              title={isRecording ? 'Dừng thu âm' : 'Nói trực tiếp bằng giọng nói qua Mic'}
              className={`p-3.5 rounded-2xl border transition-all ${
                isRecording
                  ? 'bg-red-500 text-white border-red-400 shadow-lg shadow-red-500/40 animate-pulse'
                  : 'bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-cyan-400 border-slate-700'
              }`}
            >
              {isRecording ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            </button>

            {/* Text input */}
            <input
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder={isRecording ? '🎙️ Đang lắng nghe giọng nói của bạn...' : 'Gõ câu trả lời tiếng Anh hoặc bấm Mic...'}
              disabled={isLoading}
              className="flex-1 bg-slate-950 border border-slate-700 focus:border-cyan-500 rounded-2xl px-5 py-3.5 text-sm text-white placeholder-slate-500 focus:outline-none transition-colors"
            />

            {/* Send button */}
            <button
              type="submit"
              disabled={!inputText.trim() || isLoading}
              className="p-3.5 bg-cyan-500 hover:bg-cyan-400 disabled:opacity-40 text-slate-950 font-bold rounded-2xl shadow-lg shadow-cyan-500/20 transition-all hover:scale-105"
            >
              <Send className="w-5 h-5" />
            </button>
          </form>
        </div>

      </div>

      {/* 4. API Key Configuration Modal */}
      <AnimatePresence>
        {isKeyModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="relative w-full max-w-lg bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6"
            >
              <div className="flex items-center justify-between pb-4 border-b border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 flex items-center justify-center">
                    <Key className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-white">Cài Đặt Google Gemini API Key</h3>
                    <p className="text-xs text-slate-400">Kết nối AI thông minh thế hệ mới nhất để luyện hội thoại</p>
                  </div>
                </div>

                <button
                  onClick={() => setIsKeyModalOpen(false)}
                  className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-3.5 bg-slate-850 border border-slate-800 rounded-2xl space-y-2 text-xs text-slate-300">
                <div className="flex items-center gap-1.5 text-cyan-400 font-bold">
                  <ShieldCheck className="w-4 h-4" />
                  <span>Bảo Mật Tuyệt Đối</span>
                </div>
                <p>
                  API Key của bạn chỉ được lưu trữ an toàn trong <strong>LocalStorage</strong> trên trình duyệt của máy bạn và gọi trực tiếp tới Google AI. Không qua bất kỳ máy chủ trung gian nào.
                </p>
                <p>
                  👉 Bạn có thể lấy API Key hoàn toàn miễn phí tại:{' '}
                  <a
                    href="https://aistudio.google.com/app/apikey"
                    target="_blank"
                    rel="noreferrer"
                    className="text-cyan-400 underline font-semibold hover:text-cyan-300"
                  >
                    Google AI Studio (aistudio.google.com)
                  </a>
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-300">Nhập Gemini API Key:</label>
                <input
                  type="password"
                  value={tempApiKey}
                  onChange={(e) => setTempApiKey(e.target.value)}
                  placeholder="AIzaSy..."
                  className="w-full bg-slate-950 border border-slate-700 focus:border-cyan-500 rounded-2xl px-4 py-3 text-sm text-white placeholder-slate-600 focus:outline-none font-mono"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  onClick={() => setIsKeyModalOpen(false)}
                  className="px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold text-slate-400 hover:text-white transition-colors"
                >
                  Hủy
                </button>
                <button
                  onClick={handleSaveApiKey}
                  className="px-6 py-2.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-extrabold rounded-xl text-xs sm:text-sm shadow-lg shadow-cyan-500/20 transition-all"
                >
                  Lưu Khóa API
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
};
