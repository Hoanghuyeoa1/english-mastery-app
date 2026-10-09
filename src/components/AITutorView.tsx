import React, { useState, useEffect, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Bot, 
  Send, 
  Mic, 
  MicOff, 
  Volume2, 
  Sparkles, 
  Lightbulb, 
  RotateCcw, 
  ChevronDown, 
  ChevronUp, 
  User, 
  CheckCircle2, 
  ListOrdered, 
  MessageSquareQuote,
  ArrowRight,
  X
} from 'lucide-react';
import { useAppStore } from '../store/useAppStore';
import { speakWord, createSpeechRecognizer } from '../services/speechService';
import { 
  ROLEPLAY_SCENARIOS, 
  generateAIResponse 
} from '../services/geminiService';
import { deriveTutorLearningContext } from '../services/tutorLearningContext';
import { derivePersonalizedInsights } from '../services/personalizedInsightService';
import { 
  createInitialSessionMemory, 
  recordSessionTurn, 
  deriveSessionFocusItems 
} from '../services/tutorSessionManager';
import { ingestTutorFeedback } from '../services/tutorFeedbackBridge';
import { ChatMessage, RoleplayScenario, TutorSessionMemory } from '../types';
import { TutorResumableActivity } from '../types/learningContinuity';
import { isActivityStale } from '../services/learningContinuityService';
import { saveTutorSession, loadTutorSession, clearTutorSession } from '../services/tutorSessionStorage';
import { AIStatusBadge } from './AIStatusBadge';
import { GeminiKeyModal } from './GeminiKeyModal';
import { SessionProgressHeader, NextActionPanel } from './session';
import { deriveTutorSessionModel } from '../services/sessionExperienceAdapter';
import type { SessionProgressMetric } from '../types/sessionExperience';

export const AITutorView: React.FC = () => {
  const { 
    geminiApiKey, 
    audioVoice, 
    audioSpeed, 
    gainXP,
    mistakeBank,
    userCollocations,
    userCustomWords,
    fourSkillsScores,
    srsProgressMap,
    resumeActivities,
    upsertResumeActivity,
    removeResumeActivity,
    completeResumeActivity,
    navigateToTab,
  } = useAppStore();

  const [selectedScenario, setSelectedScenario] = useState<RoleplayScenario>(ROLEPLAY_SCENARIOS[0]);
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    const saved = loadTutorSession(ROLEPLAY_SCENARIOS[0].id);
    if (saved && saved.messages && saved.messages.length > 0) {
      return saved.messages;
    }
    return [
      {
        id: `ai_init_${ROLEPLAY_SCENARIOS[0].id}`,
        sender: 'ai',
        text: ROLEPLAY_SCENARIOS[0].initialMessage,
        timestamp: '09:00',
        isFallback: !useAppStore.getState().geminiApiKey,
      },
    ];
  });
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isKeyModalOpen, setIsKeyModalOpen] = useState(false);
  const [expandedFeedbackId, setExpandedFeedbackId] = useState<string | null>(null);
  const [showSummaryModal, setShowSummaryModal] = useState(false);

  const userTurns = useMemo(() => {
    return messages.filter((m) => m.sender === 'user').length;
  }, [messages]);

  const tutorMetric: SessionProgressMetric = useMemo(() => {
    const latestAi = [...messages].reverse().find((m) => m.sender === 'ai');
    return {
      kind: 'open_turns',
      turnCount: userTurns,
      lastInteractionSummary: latestAi?.text ? latestAi.text.slice(0, 60) : undefined,
    };
  }, [messages, userTurns]);

  // Memoized learning context to avoid expensive recalculations on keystrokes/re-renders
  const learningContext = useMemo(() => {
    return deriveTutorLearningContext({
      mistakeBank,
      userCollocations,
      userCustomWords,
      fourSkillsScores,
      srsProgressMap,
    });
  }, [mistakeBank, userCollocations, userCustomWords, fourSkillsScores, srsProgressMap]);

  // Derived 2-3 top session focus display items for Phase 4 UI
  const sessionFocusItems = useMemo(() => {
    return deriveSessionFocusItems(learningContext, 3);
  }, [learningContext]);

  // Derived top personalized insights to explain session focus (Phase 3 Integration)
  const tutorInsights = useMemo(() => {
    return derivePersonalizedInsights({
      mistakeBank,
      userCollocations,
      userCustomWords,
      fourSkillsScores,
      srsProgressMap,
      maxInsights: 2,
    });
  }, [mistakeBank, userCollocations, userCustomWords, fourSkillsScores, srsProgressMap]);

  // In-Memory Adaptive Session Memory (Restored from session layer if available)
  const [sessionMemory, setSessionMemory] = useState<TutorSessionMemory>(() => {
    const saved = loadTutorSession(ROLEPLAY_SCENARIOS[0].id);
    if (saved && saved.sessionMemory) {
      return saved.sessionMemory;
    }
    return createInitialSessionMemory(learningContext);
  });

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const handleSelectScenario = React.useCallback((scenario: RoleplayScenario) => {
    if (scenario.id === selectedScenario.id) return;
    setSelectedScenario(scenario);
    setExpandedFeedbackId(null);

    const saved = loadTutorSession(scenario.id);
    if (saved && saved.messages && saved.messages.length > 0) {
      setMessages(saved.messages);
      setSessionMemory(saved.sessionMemory || createInitialSessionMemory(learningContext));
    } else {
      setMessages([
        {
          id: `ai_init_${scenario.id}`,
          sender: 'ai',
          text: scenario.initialMessage,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          isFallback: !geminiApiKey,
        },
      ]);
      setSessionMemory(createInitialSessionMemory(learningContext));
    }
  }, [selectedScenario.id, geminiApiKey, learningContext]);

  // Active resumable tutor activity from global continuity store
  const activeTutorResume = useMemo(() => {
    return (
      Object.values(resumeActivities || {}).find(
        (a): a is TutorResumableActivity =>
          Boolean(a && a.type === 'tutor' && !a.completed && !isActivityStale(a))
      ) || null
    );
  }, [resumeActivities]);

  const handleResumeTutorActivity = (act: TutorResumableActivity) => {
    const matched = ROLEPLAY_SCENARIOS.find((s) => s.id === act.checkpoint.scenarioId);
    if (matched) {
      setSelectedScenario(matched);
      const saved = loadTutorSession(matched.id);
      if (saved && saved.messages && saved.messages.length > 0) {
        setMessages(saved.messages);
        setSessionMemory(saved.sessionMemory || createInitialSessionMemory(learningContext));
      }
    }
  };

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
        historyFormatted,
        {
          learningContext,
          sessionMemory,
        }
      );

      const aiMsgId = `ai_${Date.now()}`;
      // Gắn feedback & telemetry trực tiếp vào phản hồi của AI (bên trái)
      const aiMsg: ChatMessage = {
        id: aiMsgId,
        sender: 'ai',
        text: res.reply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        feedback: res.feedback,
        telemetry: res.telemetry,
        isFallback: res.isFallback,
      };

      const updatedMessages = [...messages, userMsg, aiMsg];
      setMessages(updatedMessages);
      gainXP(15);

      // Cập nhật bộ nhớ phiên học thích ứng
      const updatedMemory = recordSessionTurn(sessionMemory, {
        userMessage: text,
        telemetry: res.telemetry,
        feedback: res.feedback,
        context: learningContext,
      });
      setSessionMemory(updatedMemory);

      // Lưu trữ phiên học tại layer Tutor session (anti-double-ingestion)
      saveTutorSession(selectedScenario.id, updatedMessages, updatedMemory);

      // Upsert pointer-only resume activity vào global continuity store
      const userTurns = updatedMessages.filter((m) => m.sender === 'user').length;
      upsertResumeActivity({
        id: `tutor_${selectedScenario.id}`,
        type: 'tutor',
        title: `AI Tutor: ${selectedScenario.title}`,
        subtitle: `${userTurns} lượt hội thoại`,
        startedAt: Date.now(),
        lastActiveAt: Date.now(),
        completed: false,
        schemaVersion: 1,
        checkpoint: {
          sessionId: selectedScenario.id,
          scenarioId: selectedScenario.id,
          turnCount: userTurns,
          lastMessageSummary: text.slice(0, 80),
        },
      });

      // Phase 3: Đưa feedback đáng tin cậy vào hệ thống học tập (Mistake Bank, Collocations, SRS)
      if (res.telemetry?.isTrusted) {
        ingestTutorFeedback({
          telemetry: res.telemetry,
          userMessage: text,
          feedback: res.feedback,
          turnId: aiMsgId,
          sessionId: selectedScenario.id,
          currentTarget: sessionMemory.currentTarget,
          hasSpeechEvidence: false,
        });
      }
    } catch (err) {
      console.warn('[AITutorView] Lỗi sinh phản hồi AI (fallback an toàn):', err);
      // Resilience Fallback: Không bao giờ để hội thoại bị treo khi có lỗi bất ngờ
      const fallbackAiMsg: ChatMessage = {
        id: `ai_err_${Date.now()}`,
        sender: 'ai',
        text: `I'm having trouble connecting right now, but let's keep practicing! Could you tell me more about ${selectedScenario.title.toLowerCase()}?`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isFallback: true,
      };
      const updatedMessagesWithFallback = [...messages, userMsg, fallbackAiMsg];
      setMessages(updatedMessagesWithFallback);
      saveTutorSession(selectedScenario.id, updatedMessagesWithFallback, sessionMemory);
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

  const handleResetChat = () => {
    clearTutorSession(selectedScenario.id);
    removeResumeActivity(`tutor_${selectedScenario.id}`);
    setMessages([
      {
        id: `ai_init_${Date.now()}`,
        sender: 'ai',
        text: selectedScenario.initialMessage,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        isFallback: !geminiApiKey,
      },
    ]);
    setExpandedFeedbackId(null);
    setSessionMemory(createInitialSessionMemory(learningContext));
  };

  const latestAiMessage = [...messages].reverse().find((m) => m.sender === 'ai');
  const isFallbackActive = Boolean(!geminiApiKey || latestAiMessage?.isFallback);

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      {/* SESSION PROGRESS HEADER (PHASE 7 OPEN-ENDED CONVERSATION UX) */}
      <SessionProgressHeader
        title={`AI Tutor: ${selectedScenario.title}`}
        subtitle={`CEFR ${learningContext.overallCefr} • Vai: ${selectedScenario.role}`}
        badgeLabel={selectedScenario.badge}
        metric={tutorMetric}
        rightSlot={
          <button
            onClick={() => setShowSummaryModal(true)}
            className="px-3 py-1.5 bg-gradient-to-r from-cyan-500/20 to-blue-500/20 hover:from-cyan-500/30 hover:to-blue-500/30 border border-cyan-500/40 text-cyan-300 rounded-xl font-bold text-xs transition-all flex items-center gap-1.5 shadow-sm"
            title="Tổng kết phiên hội thoại này"
          >
            <span>🏁 Kết Thúc Phiên</span>
          </button>
        }
        onExit={() => navigateToTab('dashboard')}
      />
      
      {/* 1. Header & Scenario Selector Bar */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-4 border-b border-slate-800">
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2.5">
              <Bot className="w-6 h-6 text-cyan-400" />
              <span>AI Roleplay: Hội Thoại Nhập Vai Tình Huống</span>
            </h2>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">
              Phỏng vấn Tech • Họp Daily Standup • Tiếng Anh du lịch • Phản hồi & sửa lỗi C1/C2 thời gian thực
            </p>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            {/* AI Status Badge */}
            <AIStatusBadge
              onOpenModal={() => setIsKeyModalOpen(true)}
              isFallback={isFallbackActive}
            />

            {/* Reset Chat Button */}
            <button
              onClick={handleResetChat}
              title="Bắt đầu lại cuộc trò chuyện này"
              className="p-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white rounded-xl transition-all cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* 5 Scenario Pill Badges */}
        <div className="space-y-1.5">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block">
            Chọn Kịch Bản Nhập Vai (Scenario Selector):
          </span>
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
            {ROLEPLAY_SCENARIOS.map((sc) => {
              const isSelected = selectedScenario.id === sc.id;
              return (
                <button
                  key={sc.id}
                  onClick={() => handleSelectScenario(sc)}
                  className={`px-4 py-2.5 rounded-2xl text-xs font-bold whitespace-nowrap transition-all duration-150 flex items-center gap-2 border active:scale-[0.98] motion-reduce:transform-none motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 ${
                    isSelected
                      ? 'bg-cyan-500/15 border-cyan-400 text-cyan-300 shadow-md shadow-cyan-500/10 ring-1 ring-cyan-400/40'
                      : 'bg-slate-850/80 border-slate-800 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                  }`}
                >
                  <span className="text-base">{sc.icon}</span>
                  <span>{sc.title}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Scenario Roles & Guided Steps Checklist */}
        <div className="p-4 bg-slate-850 border border-slate-800 rounded-2xl space-y-3 text-xs">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2.5 py-0.5 bg-cyan-500/20 text-cyan-400 font-bold rounded-lg border border-cyan-500/30">
                {selectedScenario.badge}
              </span>
              <span className="text-slate-300">
                Bạn: <strong className="text-white">{selectedScenario.role}</strong> • AI: <strong className="text-cyan-400">{selectedScenario.aiRole}</strong>
              </span>
              {sessionMemory.currentTarget && (
                <span className="flex items-center gap-1 px-2 py-0.5 bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 rounded-lg text-[11px] font-medium">
                  <Sparkles className="w-3 h-3 text-indigo-400 shrink-0" />
                  <span>Trọng tâm: <strong className="text-white">{sessionMemory.currentTarget}</strong></span>
                </span>
              )}
            </div>
            <span className="text-slate-400 italic text-[11px]">
              {selectedScenario.description}
            </span>
          </div>

          {/* Guided Steps */}
          {selectedScenario.steps && (
            <div className="space-y-1.5">
              <span className="text-[11px] font-bold text-slate-400 flex items-center gap-1.5">
                <ListOrdered className="w-3.5 h-3.5 text-cyan-400" />
                <span>Lộ trình hội thoại định hướng theo bước (Scenario Flow):</span>
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-[11px] text-slate-300">
                {selectedScenario.steps.map((step, idx) => (
                  <div key={idx} className="flex items-start gap-1.5 p-1.5 bg-slate-900/60 rounded-lg border border-slate-800">
                    <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400 shrink-0 mt-0.5" />
                    <span>{step}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Today's Focus / Personalized For You (Phase 4) */}
          {learningContext.hasLearningHistory && sessionFocusItems.length > 0 && (
            <div className="pt-2.5 border-t border-slate-800/80 space-y-2">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="flex items-center gap-1.5 px-2.5 py-1 bg-gradient-to-r from-cyan-500/15 to-indigo-500/15 border border-cyan-500/30 text-cyan-300 rounded-xl text-xs font-bold shadow-sm">
                    <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                    <span>Cá nhân hóa cho bạn</span>
                    <span className="px-1.5 py-0.5 bg-cyan-500/25 text-cyan-200 text-[10px] font-extrabold rounded-md ml-0.5">
                      CEFR {learningContext.overallCefr}
                    </span>
                  </span>

                  <span className="text-slate-400 text-[11px] font-semibold">
                    Mục tiêu hôm nay:
                  </span>

                  <div className="flex items-center gap-1.5 flex-wrap">
                    {sessionFocusItems.map((focusItem, idx) => (
                      <span
                        key={idx}
                        className="px-2.5 py-0.5 bg-indigo-500/15 border border-indigo-500/30 text-indigo-200 rounded-lg text-[11px] font-medium"
                      >
                        {focusItem}
                      </span>
                    ))}
                  </div>
                </div>

                <span className="text-[10px] text-slate-500 italic">
                  * Tự động điều chỉnh theo lịch sử học của bạn
                </span>
              </div>

              {tutorInsights.length > 0 && (
                <div
                  className="text-[11px] text-slate-300 bg-slate-950/40 px-3 py-1.5 rounded-xl border border-slate-800/60 flex items-center gap-2"
                  data-testid="tutor-personalized-insight"
                >
                  <span className="text-cyan-400 font-bold shrink-0">💡 Gợi ý phản hồi:</span>
                  <span className="truncate">{tutorInsights[0].message}</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Module-level Continue Learning Banner */}
      {activeTutorResume && activeTutorResume.checkpoint.scenarioId !== selectedScenario.id && (
        <div
          data-testid="tutor-resume-banner"
          className="bg-indigo-950/70 border border-indigo-700/60 rounded-3xl p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-xl"
        >
          <div className="flex items-center gap-3.5">
            <div className="w-10 h-10 rounded-2xl bg-indigo-500/20 text-indigo-400 flex items-center justify-center shrink-0 border border-indigo-500/30">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm font-bold text-white flex items-center gap-2">
                <span>Bạn đang có phiên hội thoại dở:</span>
                <span className="text-indigo-300 font-extrabold">{activeTutorResume.title}</span>
              </div>
              <div className="text-xs text-slate-400 mt-0.5">
                {activeTutorResume.checkpoint.turnCount} lượt hội thoại • {activeTutorResume.checkpoint.lastMessageSummary || 'Đang trao đổi dở dang'}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
            <button
              data-testid="btn-dismiss-tutor"
              onClick={() => removeResumeActivity(activeTutorResume.id)}
              className="px-3.5 py-2 text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-850 rounded-xl transition-colors cursor-pointer border border-transparent hover:border-slate-750"
            >
              Bỏ qua
            </button>
            <button
              data-testid="btn-resume-tutor"
              onClick={() => handleResumeTutorActivity(activeTutorResume)}
              className="px-4 py-2 text-xs font-bold text-slate-950 bg-indigo-400 hover:bg-indigo-300 rounded-xl transition-all shadow-md shadow-indigo-950 cursor-pointer flex items-center gap-1.5"
            >
              <span>Tiếp tục phiên này</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* 2. Main Chat Message Container */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 sm:p-6 shadow-2xl space-y-4 min-h-[460px] max-h-[580px] overflow-y-auto flex flex-col justify-between">
        
        {/* Message Stream */}
        <div className="space-y-5">
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
                <div className={`flex items-start gap-2.5 max-w-[88%] sm:max-w-[82%] ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
                  
                  {/* Avatar Icon */}
                  {!isUser ? (
                    <div className="w-8 h-8 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 flex items-center justify-center shrink-0 mt-0.5 shadow-sm">
                      <Bot className="w-4 h-4" />
                    </div>
                  ) : (
                    <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5 shadow-sm">
                      <User className="w-4 h-4" />
                    </div>
                  )}

                  {/* Message Content Bubble */}
                  <div className="space-y-1">
                    <div
                      className={`p-4 rounded-3xl text-sm sm:text-base leading-relaxed ${
                        isUser
                          ? 'bg-gradient-to-r from-emerald-600 to-teal-500 text-white rounded-br-none shadow-lg shadow-emerald-600/15'
                          : 'bg-slate-800 text-slate-100 rounded-bl-none border border-slate-700/80 shadow-md'
                      }`}
                    >
                      <p>{msg.text}</p>
                    </div>

                    <div className={`flex items-center gap-2 text-[10px] text-slate-500 px-1.5 ${isUser ? 'justify-end' : 'justify-start'}`}>
                      <span>{msg.timestamp}</span>
                      {!isUser && (
                        <button
                          onClick={() => speakWord(msg.text, audioVoice, audioSpeed)}
                          title="Nghe phát âm AI"
                          className="hover:text-cyan-400 transition-colors flex items-center gap-0.5 font-medium"
                        >
                          <Volume2 className="w-3 h-3" />
                          <span>Nghe</span>
                        </button>
                      )}
                    </div>
                  </div>

                </div>

                {/* ========================================================================= */}
                {/* AI FEEDBACK ACCORDION: ALIGNED LEFT UNDER AI MESSAGE (MAX-W-[82%])        */}
                {/* ========================================================================= */}
                {!isUser && msg.feedback && (
                  <div className="w-full max-w-[88%] sm:max-w-[82%] pl-10 mt-2">
                    <div className="bg-slate-950/90 border border-amber-500/30 rounded-2xl p-3 space-y-2 shadow-lg">
                      <div 
                        onClick={() => setExpandedFeedbackId(isFeedbackExpanded ? null : msg.id)}
                        className="flex items-center justify-between cursor-pointer select-none text-xs font-bold text-amber-400 hover:text-amber-300 transition-colors"
                      >
                        <div className="flex items-center gap-1.5">
                          <Lightbulb className="w-4 h-4 text-amber-400 shrink-0" />
                          <span>💡 Xem nhận xét ngữ pháp & từ vựng gợi ý (C1/C2)</span>
                        </div>
                        {isFeedbackExpanded ? (
                          <ChevronUp className="w-4 h-4 text-amber-400" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-slate-400" />
                        )}
                      </div>

                      {/* Expanded Feedback Details */}
                      {isFeedbackExpanded && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          className="pt-2 border-t border-slate-800/80 space-y-2.5 text-xs text-slate-300"
                        >
                          {/* Correction */}
                          {msg.feedback.correction && (
                            <div>
                              <span className="text-[11px] font-semibold text-slate-400">Câu sửa chuẩn ngữ pháp:</span>
                              <p className="font-semibold text-emerald-400 bg-emerald-500/10 p-2 rounded-xl border border-emerald-500/20 mt-0.5">
                                {msg.feedback.correction}
                              </p>
                            </div>
                          )}

                          {/* Explanation */}
                          {msg.feedback.explanation && (
                            <div>
                              <span className="text-[11px] font-semibold text-slate-400">Giải thích chi tiết:</span>
                              <p className="text-slate-300 mt-0.5 italic leading-relaxed">
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

                          {/* Practiced Targets from Telemetry */}
                          {msg.telemetry?.practicedTargets && msg.telemetry.practicedTargets.length > 0 && (
                            <div>
                              <span className="text-[11px] font-semibold text-cyan-400">Trọng tâm thích ứng đã luyện:</span>
                              <div className="flex flex-wrap gap-1.5 mt-1">
                                {msg.telemetry.practicedTargets.map((target, idx) => (
                                  <span key={idx} className="px-2 py-0.5 bg-cyan-500/10 text-cyan-300 rounded-lg text-[11px] border border-cyan-500/20 font-mono">
                                    {target}
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

                {/* Fallback Notice Pill */}
                {!isUser && msg.isFallback && (
                  <div className="w-full max-w-[88%] sm:max-w-[82%] pl-10 mt-1.5">
                    <div className="flex items-center justify-between gap-2 px-3.5 py-2 bg-amber-500/10 border border-amber-500/25 text-amber-300 rounded-2xl text-[11px] leading-snug shadow-sm">
                      <div className="flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                        <span>Đang sử dụng kịch bản mẫu. Thêm Gemini API Key để phản hồi theo thời gian thực và mở rộng chủ đề tự do.</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsKeyModalOpen(true)}
                        className="font-bold underline hover:text-amber-200 shrink-0 ml-1 cursor-pointer"
                      >
                        Cài đặt
                      </button>
                    </div>
                  </div>
                )}

              </motion.div>
            );
          })}

          {isLoading && (
            <div className="flex items-center gap-2 text-xs text-cyan-400 p-2" aria-busy="true">
              <Sparkles className="w-4 h-4 animate-spin motion-reduce:animate-none" />
              <span>AI Tutor đang phân tích ngữ cảnh và chuẩn bị câu trả lời...</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* 3. Quick Suggested Prompts Chips */}
        {selectedScenario.suggestedPrompts && (
          <div className="pt-2">
            <span className="text-[11px] text-slate-500 block mb-1 font-semibold flex items-center gap-1">
              <MessageSquareQuote className="w-3 h-3 text-cyan-400" />
              <span>Gợi ý câu phản hồi nhanh:</span>
            </span>
            <div className="flex flex-wrap gap-1.5">
              {selectedScenario.suggestedPrompts.map((prompt, idx) => (
                <button
                  key={idx}
                  onClick={() => setInputText(prompt)}
                  className="px-2.5 py-1 bg-slate-850 hover:bg-slate-800 border border-slate-750 text-slate-300 hover:text-cyan-300 rounded-xl text-[11px] transition-all duration-150 text-left truncate max-w-full active:scale-[0.98] motion-reduce:transform-none motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400"
                >
                  "{prompt.slice(0, 60)}..."
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 4. Input & Voice Controls */}
        <div className="pt-3 border-t border-slate-800">
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
              className={`p-3.5 rounded-2xl border transition-all duration-150 active:scale-[0.98] motion-reduce:transform-none motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 ${
                isRecording
                  ? 'bg-red-500 text-white border-red-400 shadow-lg shadow-red-500/40 animate-pulse motion-reduce:animate-none'
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
              className="flex-1 bg-slate-950 border border-slate-750 focus:border-cyan-500 rounded-2xl px-5 py-3.5 text-sm text-white placeholder-slate-500 focus:outline-none transition-colors"
            />

            {/* Send button */}
            <button
              type="submit"
              data-testid="tutor-send-btn"
              aria-label="Gửi tin nhắn"
              aria-busy={isLoading}
              disabled={!inputText.trim() || isLoading}
              className="p-3.5 bg-cyan-500 hover:bg-cyan-400 disabled:opacity-40 text-slate-950 font-bold rounded-2xl shadow-lg shadow-cyan-500/20 transition-all duration-150 active:scale-[0.98] motion-reduce:transform-none motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 disabled:cursor-not-allowed"
            >
              <Send className="w-5 h-5" />
            </button>
          </form>
        </div>
      </div>

      {/* SUMMARY MODAL CHO AI TUTOR (PHASE 7 EXPLICIT COMPLETION) */}
      <AnimatePresence>
        {showSummaryModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-labelledby="tutor-summary-title"
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="bg-slate-900 border border-slate-750 rounded-3xl p-6 sm:p-8 max-w-lg w-full shadow-2xl space-y-6 text-center relative"
            >
              <button
                onClick={() => setShowSummaryModal(false)}
                className="absolute top-5 right-5 p-2 bg-slate-800 hover:bg-slate-750 text-slate-400 hover:text-white rounded-xl transition-all"
                title="Đóng bảng tổng kết"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="w-16 h-16 mx-auto rounded-3xl bg-cyan-500/20 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shadow-lg shadow-cyan-500/10">
                <Bot className="w-9 h-9" />
              </div>

              <div className="space-y-1.5">
                <h3 className="text-2xl font-black text-white tracking-tight">
                  Tổng Kết Phiên Gia Sư AI
                </h3>
                <p className="text-xs sm:text-sm text-slate-400">
                  {selectedScenario.title} • Bạn: {selectedScenario.role}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 text-center">
                <div className="p-3.5 bg-slate-850 border border-slate-750 rounded-2xl">
                  <span className="text-xs text-slate-400 font-bold block">Lượt Hội Thoại</span>
                  <span className="text-xl sm:text-2xl font-black text-cyan-300 font-mono">
                    {userTurns} lượt
                  </span>
                </div>
                <div className="p-3.5 bg-slate-850 border border-slate-750 rounded-2xl">
                  <span className="text-xs text-slate-400 font-bold block">Trình Độ CEFR</span>
                  <span className="text-xl sm:text-2xl font-black text-emerald-400 font-mono">
                    {learningContext.overallCefr}
                  </span>
                </div>
              </div>

              {sessionMemory.currentTarget && (
                <div className="p-3.5 bg-indigo-500/10 border border-indigo-500/30 rounded-2xl text-left text-xs">
                  <span className="text-slate-400 block font-semibold">Trọng tâm đã luyện:</span>
                  <span className="text-indigo-200 font-bold">{sessionMemory.currentTarget}</span>
                </div>
              )}

              <div className="pt-2">
                <NextActionPanel
                  actions={[
                    {
                      id: 'next-action-today-hub',
                      label: 'Về Kế Hoạch Hôm Nay',
                      isPrimary: true,
                      onClick: () => {
                        completeResumeActivity(`tutor_${selectedScenario.id}`);
                        setShowSummaryModal(false);
                        navigateToTab('dashboard');
                      },
                    },
                    {
                      id: 'restart-chat',
                      label: 'Hội Thoại Mới',
                      variant: 'secondary',
                      onClick: () => {
                        completeResumeActivity(`tutor_${selectedScenario.id}`);
                        handleResetChat();
                        setShowSummaryModal(false);
                      },
                    },
                    {
                      id: 'open-mistakes',
                      label: '📖 Sổ Tay Bẫy Lỗi',
                      variant: 'outline',
                      onClick: () => {
                        setShowSummaryModal(false);
                        navigateToTab('mistakes');
                      },
                    },
                  ]}
                />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 5. API Key Configuration Modal */}
      <GeminiKeyModal
        isOpen={isKeyModalOpen}
        onClose={() => setIsKeyModalOpen(false)}
      />

    </div>
  );
};
