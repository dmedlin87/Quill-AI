import React, { useState, useEffect, useRef } from 'react';
import { ChatMessage, EditorContext } from '../types';
import { createAgentSession } from '../services/geminiService';
import { Chat } from "@google/genai";
import { Lore } from '../types/schema';
import { DiffViewer } from './DiffViewer';

interface ChatInterfaceProps {
  editorContext: EditorContext;
  fullText: string;
  onAgentAction: (action: string, params: any) => Promise<string>; // callback to App.tsx
  lore?: Lore;
}

interface PendingEdit {
  id: string; // tool call id
  searchText: string;
  replacementText: string;
  description: string;
  resolve: (result: string) => void;
  reject: (reason: string) => void;
}

export const ChatInterface: React.FC<ChatInterfaceProps> = ({ editorContext, fullText, onAgentAction, lore }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [agentState, setAgentState] = useState<'idle' | 'thinking' | 'writing' | 'waiting_approval'>('idle');
  const [pendingEdit, setPendingEdit] = useState<PendingEdit | null>(null);
  
  const chatRef = useRef<Chat | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Initialize Chat Session
  useEffect(() => {
    if (!chatRef.current) {
      chatRef.current = createAgentSession(lore);
      // Initialize with instructions but no visible message
      const init = async () => {
         await chatRef.current?.sendMessage({ 
             message: `I have loaded the manuscript. Length: ${fullText.length} characters. I am ready to help.` 
         });
      };
      init();
    }
  }, [lore]);

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, agentState, pendingEdit]);

  const sendMessage = async () => {
    if (!input.trim() || !chatRef.current) return;

    const userMsg: ChatMessage = { role: 'user', text: input, timestamp: new Date() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);
    setAgentState('thinking');

    try {
      // 1. Construct Context-Aware Prompt
      const contextPrompt = `
      [USER CONTEXT]
      Cursor Index: ${editorContext.cursorPosition}
      Selection: ${editorContext.selection ? `"${editorContext.selection.text}"` : "None"}
      Total Text Length: ${editorContext.totalLength}
      
      [USER REQUEST]
      ${input}
      `;

      // 2. Send to Gemini
      let result = await chatRef.current.sendMessage({ message: contextPrompt });
      
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
             if (call.name === 'update_manuscript') {
                // Intercept update_manuscript for Diff Review
                setAgentState('waiting_approval');
                
                // Create a promise that waits for user interaction in the UI
                const approvalResult = await new Promise<string>((resolve, reject) => {
                    setPendingEdit({
                        id: call.id,
                        searchText: call.args.search_text,
                        replacementText: call.args.replacement_text,
                        description: call.args.description || 'Suggested Edit',
                        resolve,
                        reject
                    });
                });

                // User Accepted -> Execute Action
                setAgentState('writing');
                const actionResult = await onAgentAction(call.name, call.args);
                
                functionResponses.push({
                   id: call.id,
                   name: call.name,
                   response: { result: actionResult } 
                });

                // Add success message
                setMessages(prev => [...prev, {
                    role: 'model',
                    text: `✅ Edit accepted and applied.`,
                    timestamp: new Date()
                }]);

             } else {
                 // Other tools (e.g. undo, append) run immediately for now
                 const actionResult = await onAgentAction(call.name, call.args);
                 functionResponses.push({
                   id: call.id,
                   name: call.name,
                   response: { result: actionResult } 
                 });
             }

           } catch (err: any) {
             // Handle Rejection or Errors
             const errorMsg = err === 'User rejected' ? "User rejected the edit." : err.message || "Unknown error";
             
             if (err === 'User rejected') {
                setMessages(prev => [...prev, {
                    role: 'model',
                    text: `❌ Edit rejected.`,
                    timestamp: new Date()
                }]);
             }

             functionResponses.push({
               id: call.id,
               name: call.name,
               response: { result: errorMsg } // Returning result as error message string so model knows what happened
             });
           } finally {
             setPendingEdit(null);
           }
        }

        // Send tool results back to model
        setAgentState('thinking');
        result = await chatRef.current.sendMessage({
           message: functionResponses.map(resp => ({ functionResponse: resp }))
        });
      }

      // 4. Final Text Response
      const responseText = result.text;
      setMessages(prev => [...prev, {
        role: 'model',
        text: responseText || "Done.",
        timestamp: new Date()
      }]);

    } catch (e) {
      console.error(e);
      setMessages(prev => [...prev, {
        role: 'model',
        text: "Sorry, I encountered an error connecting to the Agent.",
        timestamp: new Date()
      }]);
    } finally {
      setIsLoading(false);
      setAgentState('idle');
      setPendingEdit(null); // Ensure cleanup
    }
  };

  return (
    <div className="flex flex-col h-full bg-white relative">
      {/* Agent Header - Context Indicator */}
      <div className="bg-gray-50 border-b border-gray-100 px-4 py-2 flex items-center justify-between text-xs text-gray-500">
         <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${editorContext.selection ? 'bg-indigo-50' : 'bg-gray-300'}`}></div>
            <span>{editorContext.selection ? 'Selection Active' : 'Cursor Active'}</span>
         </div>
         <div className="flex gap-4">
             {lore && <span title="Lore Bible Active" className="text-indigo-600 font-bold">📖 Lore Active</span>}
             <div className="font-mono">
                Ln {Math.floor(editorContext.cursorPosition / 80) + 1} : Col {editorContext.cursorPosition % 80}
             </div>
         </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg, idx) => (
          <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[90%] rounded-2xl px-4 py-3 text-sm shadow-sm ${
              msg.text.startsWith('🛠️') 
                ? 'bg-gray-50 text-gray-500 border border-gray-100 font-mono text-xs py-2 w-full max-w-none text-center' 
                : msg.text.startsWith('✅') || msg.text.startsWith('❌')
                  ? 'bg-gray-50 text-gray-600 text-xs py-2 w-full max-w-none text-center italic'
                  : msg.role === 'user' 
                    ? 'bg-indigo-600 text-white rounded-br-none' 
                    : 'bg-white border border-gray-200 text-gray-800 rounded-bl-none'
            }`}>
              {msg.text}
            </div>
          </div>
        ))}
        
        {/* Pending Edit Diff Viewer */}
        {pendingEdit && (
            <div className="mx-2">
                <DiffViewer 
                    oldText={pendingEdit.searchText}
                    newText={pendingEdit.replacementText}
                    description={pendingEdit.description}
                    onAccept={() => pendingEdit.resolve('User accepted')}
                    onReject={() => pendingEdit.reject('User rejected')}
                />
            </div>
        )}

        {/* Loading / State Indicators */}
        {agentState !== 'idle' && agentState !== 'waiting_approval' && (
          <div className="flex justify-start">
            <div className="bg-gray-50 border border-gray-100 rounded-2xl px-4 py-3 rounded-bl-none flex items-center gap-3">
               <div className="flex space-x-1">
                 <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce"></div>
                 <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce delay-75"></div>
                 <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce delay-150"></div>
               </div>
               <span className="text-xs text-indigo-500 font-medium animate-pulse">
                  {agentState === 'thinking' ? 'Reasoning...' : 'Editing Manuscript...'}
               </span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="p-4 border-t border-gray-100 bg-white">
        <div className="flex gap-2">
          <input
            type="text"
            className="flex-1 border border-gray-300 rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-shadow disabled:bg-gray-100 disabled:text-gray-400"
            placeholder={pendingEdit ? "Review proposed changes above..." : "Type / to use tools or ask Agent to edit..."}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !pendingEdit && sendMessage()}
            disabled={isLoading || pendingEdit !== null}
          />
          <button 
            onClick={sendMessage}
            disabled={!input.trim() || isLoading || pendingEdit !== null}
            className="bg-indigo-600 text-white rounded-lg p-3 hover:bg-indigo-700 disabled:opacity-50 transition-colors shadow-sm"
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
              <path d="M3.478 2.404a.75.75 0 0 0-.926.941l2.432 7.905H13.5a.75.75 0 0 1 0 1.5H4.984l-2.432 7.905a.75.75 0 0 0 .926.94 60.519 60.519 0 0 0 18.445-8.986.75.75 0 0 0 0-1.218A60.517 60.517 0 0 0 3.478 2.404Z" />
            </svg>
          </button>
        </div>
        <div className="text-[10px] text-gray-400 mt-2 text-center">
            Agent can read your selection and edit text directly.
        </div>
      </div>
    </div>
  );
};