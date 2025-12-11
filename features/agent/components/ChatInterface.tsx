import React, { useState, useEffect, useRef, useCallback } from 'react';

import { motion, AnimatePresence } from 'framer-motion';

import { ChatMessage, EditorContext, AnalysisResult, CharacterProfile } from '@/types';

import { getMemoriesForContext, getActiveGoals, formatMemoriesForPrompt, formatGoalsForPrompt } from '@/services/memory';
import { clearSessionMemories, shouldRefreshContext, getSessionMemorySummary } from '@/services/memory/sessionTracker';
import { ApiDefaults } from '@/config/api';



// Message animation variants

const messageVariants = {

  hidden: { opacity: 0, y: 20, scale: 0.95 },

  visible: { 

    opacity: 1, 

    y: 0, 

    scale: 1,

    transition: { type: 'spring' as const, stiffness: 400, damping: 30 }

  },

  exit: { opacity: 0, scale: 0.95, transition: { duration: 0.15 } }

};

import { QuillAgent } from '@/services/gemini/agent';
import { RateLimitError, AIError } from '@/services/gemini/errors';

import { Lore, Chapter } from '@/types/schema';

import { Persona, DEFAULT_PERSONAS } from '@/types/personas';
import { VoiceFingerprint } from '@/types/intelligence';

import { PersonaSelector } from './PersonaSelector';

import { CritiqueIntensitySelector, ExperienceSelector, useSettingsStore } from '@/features/settings';
import { RelevanceTuning } from '@/features/settings/components/RelevanceTuning';
import { Button } from '@/features/shared/components/ui/Button';
import { Input } from '@/features/shared/components/ui/Input';



interface ChatInterfaceProps {

  editorContext: EditorContext;

  fullText: string;

  onAgentAction: (action: string, params: any) => Promise<string>; // callback to App.tsx

  lore?: Lore;

  chapters?: Chapter[];

  analysis?: AnalysisResult | null;

  initialMessage?: string;

  onInitialMessageProcessed?: () => void;

  initialPersona?: Persona;

  interviewTarget?: CharacterProfile | null;

  onExitInterview?: () => void;

  /** Project ID for memory context - enables persistent memory */
  projectId?: string | null;

  /** Optional precomputed voice fingerprint from intelligence layer */
  voiceFingerprint?: VoiceFingerprint;

  /** Maximum number of messages to keep in history */
  maxMessages?: number;
}

const DEFAULT_MAX_MESSAGES = 200;
const MAX_FULL_MANUSCRIPT_CHARS = ApiDefaults.maxAnalysisLength;

export const ChatInterface: React.FC<ChatInterfaceProps> = ({ 

    editorContext, 

    fullText, 

    onAgentAction, 

    lore,

  chapters = [],

  analysis,

  initialMessage,

  onInitialMessageProcessed,

  initialPersona,

  interviewTarget = null,

  onExitInterview,

  projectId,

  voiceFingerprint,

  maxMessages = DEFAULT_MAX_MESSAGES,

}) => {

  const [messages, setMessages] = useState<ChatMessage[]>([]);

  const [input, setInput] = useState('');

  const [isLoading, setIsLoading] = useState(false);

  const [agentState, setAgentState] = useState<'idle' | 'thinking' | 'writing'>('idle');

  const [currentPersona, setCurrentPersona] = useState<Persona>(initialPersona || DEFAULT_PERSONAS[0]);

  const [isDeepMode, setIsDeepMode] = useState(false);
  const [showRelevanceSettings, setShowRelevanceSettings] = useState(false);
  const [showAgentSettings, setShowAgentSettings] = useState(false);

  const chatRef = useRef<QuillAgent | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const personaRef = useRef<Persona>(currentPersona);

  const isInterviewMode = Boolean(interviewTarget);

  const initGenRef = useRef(0);
  const initialMessageTimerRef = useRef<NodeJS.Timeout | null>(null);
  const initialMessageSentRef = useRef(false);

  const isMountedRef = useRef(true);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  /**
   * Build memory context string from stored memories and goals
   */
  const buildMemoryContext = useCallback(async (): Promise<string> => {
    if (!projectId) return '';
    
    try {
      const [memories, goals] = await Promise.all([
        getMemoriesForContext(projectId, { limit: 25 }),
        getActiveGoals(projectId),
      ]);

      let memorySection = '[AGENT MEMORY]\n';
      
      const formattedMemories = formatMemoriesForPrompt(memories, { maxLength: 3000 });
      if (formattedMemories) {
        memorySection += formattedMemories + '\n';
      } else {
        memorySection += '(No stored memories yet.)\n';
      }

      const formattedGoals = formatGoalsForPrompt(goals);
      if (formattedGoals) {
        memorySection += '\n' + formattedGoals + '\n';
      }

      return memorySection;
    } catch (error) {
      console.warn('[ChatInterface] Failed to fetch memory context:', error);
      return '';
    }
  }, [projectId]);

  // Initialize Chat Session

  const initializeSession = useCallback(async () => {
    // FIX: Clear session memory tracking when session reinitializes
    // This ensures stale session state doesn't carry over
    clearSessionMemories();

    const gen = ++initGenRef.current;

    // Construct a single string containing all chapters for context, capped to avoid huge payloads
    const chapterSeparator = '\n-------------------\n';
    let remainingBudget = MAX_FULL_MANUSCRIPT_CHARS;
    const manuscriptParts: string[] = [];

    for (const c of chapters) {
      // Check if this is the active chapter by comparing text content (simple heuristic) or ID if we had it here
      const isActive = c.content === fullText;

      const header = `[CHAPTER: ${c.title}]${isActive ? " (ACTIVE - You can edit this)" : " (READ ONLY - Request user to switch)"}\n`;

      const availableForContent = remainingBudget - header.length - chapterSeparator.length;
      if (availableForContent <= 0) {
        break;
      }

      const chapterContent =
        c.content.length > availableForContent
          ? c.content.slice(0, availableForContent)
          : c.content;

      manuscriptParts.push(header + chapterContent + '\n');

      remainingBudget -= header.length + chapterContent.length + chapterSeparator.length;

      if (remainingBudget <= 0) {
        break;
      }
    }

    const fullManuscript = manuscriptParts.join(chapterSeparator);

    // Fetch memory context (async)
    const memoryContext = await buildMemoryContext();

    const { critiqueIntensity, experienceLevel, autonomyMode } = useSettingsStore.getState();

    const personaForSession = isInterviewMode ? undefined : personaRef.current;

    const agent = new QuillAgent({
      lore,
      analysis: analysis || undefined,
      fullManuscriptContext: fullManuscript,
      persona: personaForSession,
      intensity: critiqueIntensity,
      experience: experienceLevel,
      autonomy: autonomyMode,
      interviewTarget: interviewTarget || undefined,
      memoryContext,
      voiceFingerprint,
      deepAnalysis: isDeepMode,
      telemetryContext: {
        source: 'ChatInterface.initializeSession',
        projectId,
        isDeepMode,
        isInterviewMode,
      },
    });

    await agent.initialize();
    if (gen !== initGenRef.current) return; // Stale init, abort

    chatRef.current = agent;

    // Initialize with instructions but no visible message
    const intro = isInterviewMode && interviewTarget
      ? `I have loaded the manuscript. Total Chapters: ${chapters.length}. Active Chapter Length: ${fullText.length} characters. I am ${interviewTarget.name}, speaking in interview mode. Ask me anything about my story or choices.`
      : `I have loaded the manuscript. Total Chapters: ${chapters.length}. Active Chapter Length: ${fullText.length} characters. I am ${personaRef.current.name}, ready to help with my ${personaRef.current.role} expertise.`;

    await agent.sendMessage({
      message: intro,
    } as any);

    if (
      initialMessage &&
      !initialMessageSentRef.current &&
      !isLoading
    ) {
      initialMessageSentRef.current = true;
      setInput(initialMessage);
      // Timer will be null here as we only enter this block once
      initialMessageTimerRef.current = setTimeout(() => {
        sendMessageWithText(initialMessage);
        onInitialMessageProcessed?.();
      }, 100);
    }

  }, [analysis, buildMemoryContext, chapters, fullText, interviewTarget, isDeepMode, isInterviewMode, lore, projectId, voiceFingerprint]);



  useEffect(() => {

    initializeSession().catch(console.error);

  }, [initializeSession]);



  // Handle persona change

  const handlePersonaChange = useCallback(async (persona: Persona) => {
    onExitInterview?.();
    setCurrentPersona(persona);
    personaRef.current = persona;
    chatRef.current = null; // Force reinitialization
    await initializeSession();

    setMessages(prev => [...prev, {

      role: 'model',
      text: `${persona.icon} Switching to ${persona.name} mode. ${persona.role}.`,
      timestamp: new Date()
    }]);
  }, [initializeSession, onExitInterview]);

  // Scroll to bottom
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, agentState]);

  // Cap message history length to avoid unbounded DOM and memory growth
  useEffect(() => {
    if (messages.length > maxMessages) {
      setMessages(prev => prev.slice(-maxMessages));
    }
  }, [messages, maxMessages]);

  useEffect(() => {
    return () => {
      if (initialMessageTimerRef.current) {
        clearTimeout(initialMessageTimerRef.current);
      }
    };
  }, []);

  const sendMessageWithText = async (messageText: string) => {
    if (!messageText.trim() || !chatRef.current || isLoading) return;

    const userMsg: ChatMessage = { role: 'user', text: messageText, timestamp: new Date() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);
    setAgentState('thinking');

    try {
      // 1. Construct Context-Aware Prompt
      const contextPrompt = `
      [DEEP MODE]: ${isDeepMode ? 'ON' : 'OFF'}
      [USER CONTEXT]
      Cursor Index: ${editorContext.cursorPosition}
      Selection: ${editorContext.selection ? `"${editorContext.selection.text}"` : "None"}
      Total Text Length: ${editorContext.totalLength}
      
      [USER REQUEST]
      ${messageText}
      `;

      // 2. Send to Gemini via QuillAgent
      let result = await chatRef.current.sendMessage({ message: contextPrompt } as any);
      
      // 3. Handle Tool Calls Loop
      while (result.functionCalls && result.functionCalls.length > 0) {
        setAgentState('writing');
        const functionResponses = [];

        for (const call of result.functionCalls) {
           // Display a "Tool Use" message in UI
           setMessages(prev => [...prev, {
             role: 'model',
             text: `🛠️ Suggesting Action: ${call.name}...`,
             timestamp: new Date()
           }]);

           try {
             // Execute Action (This now triggers the Global Review Modal if needed)
             const actionResult = await onAgentAction(call.name, call.args);
             
             functionResponses.push({
               id: call.id,
               name: call.name,
               response: { result: actionResult } 
             });

             // Add success/status message
             if (actionResult.includes('Waiting for user review')) {
                setMessages(prev => [...prev, {
                    role: 'model',
                    text: `📝 Reviewing proposed edit...`,
                    timestamp: new Date()
                }]);
             }

           } catch (err: any) {
             const errorMsg = err.message || "Unknown error";
             
             setMessages(prev => [...prev, {
                role: 'model',
                text: `❌ Error: ${errorMsg}`,
                timestamp: new Date()
            }]);

             functionResponses.push({
               id: call.id,
               name: call.name,
               response: { result: errorMsg } 
             });
           }
        }

        // Send tool results back to model
        setAgentState('thinking');
        result = await chatRef.current.sendMessage({
           message: functionResponses.map(resp => ({ functionResponse: resp })),
        } as any);
      }

      // 4. Final Text Response
      const responseText = result.text;
      if (isMountedRef.current) {
        setMessages(prev => [...prev, {
          role: 'model',
          text: responseText || "Done.",
          timestamp: new Date()
        }]);
      }

    } catch (e) {
      console.error(e);

      let friendlyMessage = 'Sorry, I encountered an error connecting to the Agent.';

      if (e instanceof RateLimitError) {
        friendlyMessage = "The AI is cooling down. Please wait a moment.";
      } else if (e instanceof AIError) {
        friendlyMessage = e.message || friendlyMessage;
      }

      if (isMountedRef.current) {
        setMessages(prev => [...prev, {
          role: 'model',
          text: friendlyMessage,
          timestamp: new Date()
        }]);
      }
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
        setAgentState('idle');
      }
    }
  };

  const sendMessage = () => {
    sendMessageWithText(input);
  };

  return (
    <div className="flex flex-col h-full bg-[var(--surface-primary)] relative">
      {/* Agent Header - Persona & Context */}
      <div className="bg-[var(--surface-secondary)] border-b border-[var(--border-secondary)] px-4 py-2 space-y-2">
        {/* Persona Selector Row */}
        <div className="flex items-center justify-between">
          {isInterviewMode && interviewTarget ? (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-3 px-3 py-2 bg-[var(--magic-50)] border border-[var(--magic-200)] rounded-lg">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[var(--magic-300)] to-[var(--magic-500)] text-white flex items-center justify-center font-semibold">
                  {interviewTarget.name.charAt(0).toUpperCase()}
                </div>
                <div className="leading-tight">
                  <div className="text-[10px] uppercase tracking-wide text-[var(--magic-700)] font-semibold">Roleplay Active</div>
                  <div className="text-sm font-semibold text-[var(--ink-800)]">{interviewTarget.name}</div>
                </div>
              </div>
              {onExitInterview && (
                <button
                  onClick={onExitInterview}
                  className="text-xs px-3 py-2 border border-[var(--magic-300)] text-[var(--magic-700)] rounded-md hover:bg-[var(--magic-50)] transition-colors"
                >
                  Exit Interview
                </button>
              )}
            </div>
          ) : (
            <PersonaSelector
              currentPersona={currentPersona}
              onSelectPersona={handlePersonaChange}
              compact
            />
          )}
          <div className="flex items-center gap-2">
            {/* Context indicators */}
            <div className="flex items-center gap-1.5">
              {lore && <span title="Lore Bible Active" className="text-[var(--interactive-accent)] text-sm">📖</span>}
              {analysis && <span title="Analysis Context Active" className="text-purple-600 text-sm">🧠</span>}
              {editorContext.selection && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-[var(--interactive-accent)]/10 text-[var(--interactive-accent)] text-[10px] font-medium">
                  <span className="w-1.5 h-1.5 rounded-full bg-current" />
                  Selection
                </span>
              )}
            </div>
            
            {/* Settings toggle */}
            <button
              onClick={() => setShowAgentSettings(!showAgentSettings)}
              className={`p-1.5 rounded-md transition-colors ${showAgentSettings ? 'bg-[var(--interactive-bg-active)] text-[var(--interactive-accent)]' : 'text-[var(--text-tertiary)] hover:bg-[var(--interactive-bg)] hover:text-[var(--text-secondary)]'}`}
              title="Agent Settings"
              aria-expanded={showAgentSettings}
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                <path fillRule="evenodd" d="M7.84 1.804A1 1 0 018.82 1h2.36a1 1 0 01.98.804l.331 1.652a6.993 6.993 0 011.929 1.115l1.598-.54a1 1 0 011.186.447l1.18 2.044a1 1 0 01-.205 1.251l-1.267 1.113a7.047 7.047 0 010 2.228l1.267 1.113a1 1 0 01.206 1.25l-1.18 2.045a1 1 0 01-1.187.447l-1.598-.54a6.993 6.993 0 01-1.929 1.115l-.33 1.652a1 1 0 01-.98.804H8.82a1 1 0 01-.98-.804l-.331-1.652a6.993 6.993 0 01-1.929-1.115l-1.598.54a1 1 0 01-1.186-.447l-1.18-2.044a1 1 0 01.205-1.251l1.267-1.114a7.05 7.05 0 010-2.227L1.821 7.773a1 1 0 01-.206-1.25l1.18-2.045a1 1 0 011.187-.447l1.598.54A6.993 6.993 0 017.51 3.456l.33-1.652zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
              </svg>
            </button>
          </div>
        </div>

        {/* Collapsible Agent Settings Panel */}
        <AnimatePresence>
          {showAgentSettings && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="pt-2 space-y-3">
                {/* Experience & Critique Row */}
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] uppercase tracking-wide text-[var(--text-muted)] font-medium">Experience</span>
                    <ExperienceSelector compact />
                  </div>
                  <div className="w-px h-4 bg-[var(--border-secondary)]" />
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] uppercase tracking-wide text-[var(--text-muted)] font-medium">Critique</span>
                    <CritiqueIntensitySelector compact />
                  </div>
                </div>
                
                {/* Relevance Tuning */}
                <div className="bg-[var(--surface-primary)] border border-[var(--border-secondary)] rounded-lg shadow-inner">
                  <button
                    onClick={() => setShowRelevanceSettings(!showRelevanceSettings)}
                    className="w-full flex items-center justify-between p-2 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
                  >
                    <span className="font-medium">Proactive Suggestions</span>
                    <svg 
                      xmlns="http://www.w3.org/2000/svg" 
                      viewBox="0 0 20 20" 
                      fill="currentColor" 
                      className={`w-4 h-4 transition-transform ${showRelevanceSettings ? 'rotate-180' : ''}`}
                    >
                      <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
                    </svg>
                  </button>
                  <AnimatePresence>
                    {showRelevanceSettings && (
                      <motion.div
                        initial={{ height: 0 }}
                        animate={{ height: 'auto' }}
                        exit={{ height: 0 }}
                        className="overflow-hidden border-t border-[var(--border-secondary)]"
                      >
                        <RelevanceTuning />
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <AnimatePresence mode="popLayout">
          {messages.map((msg, idx) => {
            const isUser = msg.role === 'user';
            const showCharacterAvatar = isInterviewMode && msg.role === 'model' && interviewTarget;

            return (
              <motion.div 
                key={`${idx}-${msg.role}`}
                variants={messageVariants}
                initial="hidden"
                animate="visible"
                exit="exit"
                layout
                className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
              >
                <motion.div className={`flex ${showCharacterAvatar ? 'gap-2' : ''} max-w-[90%]`}>
                  {showCharacterAvatar && (
                    <div className="flex flex-col items-center gap-1 shrink-0">
                      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[var(--magic-300)] to-[var(--magic-500)] text-white flex items-center justify-center font-semibold">
                        {interviewTarget?.name.charAt(0).toUpperCase()}
                      </div>
                      <span className="text-[10px] text-[var(--ink-400)] leading-none">{interviewTarget?.name}</span>
                    </div>
                  )}
                  <motion.div 
                    className={`rounded-2xl px-4 py-3 text-sm shadow-sm ${isUser ? 'bg-[var(--interactive-accent)] text-[var(--text-inverse)]' : 'bg-[var(--surface-elevated)] border border-[var(--border-subtle)] text-[var(--text-primary)]'}`}
                    whileHover={{ scale: 1.01 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  >
                    {msg.text}
                  </motion.div>
                </motion.div>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {/* Loading / State Indicators */}
        <AnimatePresence>
          {agentState !== 'idle' && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex justify-start"
            >
              <div className="bg-[var(--surface-secondary)] border border-[var(--border-primary)] rounded-2xl px-4 py-3 rounded-bl-none flex items-center gap-3">
                 <div className="flex space-x-1">
                   <motion.div 
                     className="w-2 h-2 bg-[var(--interactive-accent)] rounded-full"
                     animate={{ y: [0, -6, 0] }}
                     transition={{ duration: 0.6, repeat: Infinity, delay: 0 }}
                   />
                   <motion.div 
                     className="w-2 h-2 bg-[var(--interactive-accent)] rounded-full"
                     animate={{ y: [0, -6, 0] }}
                     transition={{ duration: 0.6, repeat: Infinity, delay: 0.1 }}
                   />
                   <motion.div 
                     className="w-2 h-2 bg-[var(--interactive-accent)] rounded-full"
                     animate={{ y: [0, -6, 0] }}
                     transition={{ duration: 0.6, repeat: Infinity, delay: 0.2 }}
                   />
                 </div>
                 <span className="text-xs text-[var(--interactive-accent)] font-medium">
                    {agentState === 'thinking' ? 'Reasoning...' : 'Editing Manuscript...'}
                 </span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        {messages.length > 0 && <div ref={messagesEndRef} />}
      </div>

      <div className="p-4 border-t border-[var(--border-secondary)] bg-[var(--surface-primary)]">
        <div className="flex gap-2 items-center">
          <div className="flex-1">
             <Input
                placeholder="Type / to use tools or ask Agent to edit..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
                disabled={isLoading}
                className="w-full"
                autoFocus
             />
          </div>
          
          {/* Deep Analysis Toggle - clearer UX */}
          <div className="relative group">
            <Button
              variant={isDeepMode ? 'primary' : 'ghost'}
              size="md"
              onClick={() => setIsDeepMode(prev => !prev)}
              aria-pressed={isDeepMode}
              className={`relative ${isDeepMode ? 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 border-transparent text-white shadow-md' : 'border-purple-200 hover:border-purple-400 hover:bg-purple-50'}`}
            >
              <span className="flex items-center gap-1.5">
                {isDeepMode ? (
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                    <path d="M10 1a.75.75 0 01.75.75v1.5a.75.75 0 01-1.5 0v-1.5A.75.75 0 0110 1zM5.05 3.05a.75.75 0 011.06 0l1.062 1.06A.75.75 0 116.11 5.173L5.05 4.11a.75.75 0 010-1.06zm9.9 0a.75.75 0 010 1.06l-1.06 1.062a.75.75 0 01-1.062-1.061l1.061-1.06a.75.75 0 011.06 0zM10 7a3 3 0 100 6 3 3 0 000-6zm-6.5 3a.75.75 0 01-.75.75h-1.5a.75.75 0 010-1.5h1.5a.75.75 0 01.75.75zm14.25-.75a.75.75 0 010 1.5h-1.5a.75.75 0 010-1.5h1.5zM5.172 13.89a.75.75 0 011.06 1.06l-1.06 1.061a.75.75 0 11-1.061-1.06l1.06-1.061zm8.718 1.06a.75.75 0 10-1.06 1.061l1.06 1.06a.75.75 0 001.06-1.06l-1.06-1.061zM10 15a.75.75 0 01.75.75v1.5a.75.75 0 01-1.5 0v-1.5A.75.75 0 0110 15z" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-purple-400">
                    <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clipRule="evenodd" />
                  </svg>
                )}
                <span className="text-sm font-medium">{isDeepMode ? 'Deep On' : 'Deep'}</span>
              </span>
            </Button>
            {/* Tooltip on hover */}
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-[var(--ink-900)] text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50 shadow-lg">
              <strong>Deep Analysis Mode</strong>
              <p className="text-[var(--text-muted)] mt-0.5">Enables voice fingerprint & style matching</p>
              <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-[var(--ink-900)]" />
            </div>
          </div>

          <Button 
            variant="primary"
            size="md"
            onClick={sendMessage}
            disabled={!input.trim() || isLoading}
            isLoading={isLoading && agentState === 'thinking'}
            rightIcon={!isLoading && (
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                <path d="M3.478 2.404a.75.75 0 0 0-.926.941l2.432 7.905H13.5a.75.75 0 0 1 0 1.5H4.984l-2.432 7.905a.75.75 0 0 0 .926.94 60.519 60.519 0 0 0 18.445-8.986.75.75 0 0 0 0-1.218A60.517 60.517 0 0 0 3.478 2.404Z" />
              </svg>
            )}
          >
            {isLoading ? 'Thinking' : 'Send'}
          </Button>
        </div>
        <div className="text-[10px] text-[var(--text-muted)] mt-2 text-center">
            Agent can read your selection and edit text directly.
        </div>
      </div>
    </div>
  );
};
