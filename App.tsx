import React, { useState, useRef, useEffect } from 'react';
import { AppMode, SidebarTab, AnalysisResult, RecentFile, EditorContext } from './types';
import { FileUpload } from './components/FileUpload';
import { AnalysisPanel } from './components/AnalysisPanel';
import { ChatInterface } from './components/ChatInterface';
import { VoiceMode } from './components/VoiceMode';
import { MagicBar } from './components/MagicBar';
import { ActivityFeed } from './components/ActivityFeed';
import { analyzeDraft, rewriteText, getContextualHelp } from './services/geminiService';
import { useDocumentHistory } from './hooks/useDocumentHistory';
import { useTextSelection } from './hooks/useTextSelection';
import { useAutoResize } from './hooks/useAutoResize';

const App: React.FC = () => {
  const [mode, setMode] = useState<AppMode>(AppMode.UPLOAD);
  
  // Custom hooks for complex state
  const { text: currentText, updateText, commit, history, restore, hasUnsavedChanges, reset } = useDocumentHistory('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { selection: selectionRange, position: selectionPos, cursorPosition, handleSelectionChange, handleMouseUp, clearSelection } = useTextSelection(textareaRef);
  useAutoResize(textareaRef, currentText, mode);

  const [fileName, setFileName] = useState<string>('');
  const [activeTab, setActiveTab] = useState<SidebarTab>(SidebarTab.ANALYSIS);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [recentFiles, setRecentFiles] = useState<RecentFile[]>([]);

  // Magic Editor States
  const [magicVariations, setMagicVariations] = useState<string[]>([]);
  const [magicHelpResult, setMagicHelpResult] = useState<string | undefined>(undefined);
  const [magicHelpType, setMagicHelpType] = useState<'Explain' | 'Thesaurus' | null>(null);
  const [isMagicLoading, setIsMagicLoading] = useState(false);
  const magicAbortRef = useRef<AbortController | null>(null);

  // Load recent files on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem('draftsmith_recent_files');
      if (stored) {
        setRecentFiles(JSON.parse(stored));
      }
    } catch (e) {
      console.error("Failed to load recent files", e);
    }
  }, []);

  // Cleanup magic async on unmount
  useEffect(() => {
      return () => {
          if (magicAbortRef.current) magicAbortRef.current.abort();
      };
  }, []);

  const saveToRecents = (text: string, name: string) => {
    const newFile: RecentFile = { name, content: text, timestamp: Date.now() };
    setRecentFiles(prev => {
        const existing = prev.filter(f => f.name !== name);
        const updated = [newFile, ...existing].slice(0, 5); 
        try {
          localStorage.setItem('draftsmith_recent_files', JSON.stringify(updated));
        } catch(e) {
          console.error("Storage full or error", e);
        }
        return updated;
    });
  };

  const handleTextLoaded = (text: string, name: string) => {
    saveToRecents(text, name);
    setFileName(name);
    reset(text); // Reset history and text
    setMode(AppMode.EDITOR);
  };

  const handleExit = () => {
      if (hasUnsavedChanges) {
          if (!window.confirm("You have unsaved changes. Are you sure you want to exit?")) {
              return;
          }
      }
      setMode(AppMode.UPLOAD);
  };

  // --- ACTIONS ---

  const handleAgentAction = async (action: string, params: any): Promise<string> => {
    if (action === 'update_manuscript') {
        const { search_text, replacement_text, description } = params;
        
        // Safety check for occurrences
        const occurrences = currentText.split(search_text).length - 1;
        if (occurrences === 0) {
            throw new Error("Could not find the exact text to replace. Please be more specific.");
        }
        if (occurrences > 1) {
             throw new Error(`Found ${occurrences} matches for that text. Please provide more context or a longer snippet to identify the exact location.`);
        }

        const newText = currentText.replace(search_text, replacement_text);
        commit(newText, description || "Agent Edit", 'Agent');
        return "Success: Text updated.";
    } 
    
    if (action === 'append_to_manuscript') {
        const { text_to_add, description } = params;
        const newText = currentText + "\n" + text_to_add;
        commit(newText, description || "Agent Append", 'Agent');
        return "Success: Text appended.";
    }

    if (action === 'undo_last_change') {
         return "Use the interface undo button for now, or I can try.";
    }

    return "Unknown action.";
  };
  
  const handleEditorChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      updateText(e.target.value);
  };

  const runAnalysis = async () => {
    if (!currentText.trim()) return;
    setIsAnalyzing(true);
    setActiveTab(SidebarTab.ANALYSIS);
    try {
      const result = await analyzeDraft(currentText);
      setAnalysis(result);
    } catch (e) {
      console.error("Analysis failed", e);
      alert("Analysis failed. Please try again.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleRewrite = async (mode: string, tone?: string) => {
    if (!selectionRange) return;
    setIsMagicLoading(true);
    setMagicHelpResult(undefined); 
    setMagicHelpType(null);
    magicAbortRef.current = new AbortController();
    
    try {
        // rewriteText doesn't support abort signal yet in service, but we can ignore result
        const variations = await rewriteText(selectionRange.text, mode, tone);
        if (!magicAbortRef.current?.signal.aborted) {
             setMagicVariations(variations);
        }
    } catch (e) {
        console.error(e);
    } finally {
        if (!magicAbortRef.current?.signal.aborted) {
            setIsMagicLoading(false);
        }
    }
  };

  const handleHelp = async (type: 'Explain' | 'Thesaurus') => {
      if (!selectionRange) return;
      setIsMagicLoading(true);
      setMagicVariations([]);
      setMagicHelpResult(undefined);
      setMagicHelpType(type);
      magicAbortRef.current = new AbortController();
      
      try {
          const result = await getContextualHelp(selectionRange.text, type);
          if (!magicAbortRef.current?.signal.aborted) {
              setMagicHelpResult(result);
          }
      } catch (e) {
          console.error(e);
      } finally {
         if (!magicAbortRef.current?.signal.aborted) {
             setIsMagicLoading(false);
         }
      }
  };

  const applyVariation = (newText: string) => {
    if (!selectionRange) return;
    const before = currentText.substring(0, selectionRange.start);
    const after = currentText.substring(selectionRange.end);
    const updated = before + newText + after;
    
    commit(updated, `Magic Edit: ${magicVariations.length > 0 ? 'Variation Applied' : 'Context Replacement'}`, 'User');
    
    closeMagicBar();
  };

  const closeMagicBar = () => {
    if (magicAbortRef.current) magicAbortRef.current.abort();
    clearSelection();
    setMagicVariations([]);
    setMagicHelpResult(undefined);
    setMagicHelpType(null);
  };
  
  const editorContext: EditorContext = {
      cursorPosition,
      selection: selectionRange,
      totalLength: currentText.length
  };

  return (
    <div className="flex h-screen w-full bg-[#f3f4f6] text-gray-900 font-sans">
      {/* Sidebar Navigation */}
      {mode === AppMode.EDITOR && (
        <aside className="w-20 bg-white border-r border-gray-200 flex flex-col items-center py-6 space-y-8 z-30 shadow-[4px_0_24px_rgba(0,0,0,0.02)]">
          <div className="p-2 bg-indigo-600 rounded-xl shadow-lg shadow-indigo-200 transform hover:scale-105 transition-transform duration-200">
             <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6 text-white">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" />
            </svg>
          </div>

          <div className="flex flex-col space-y-6 w-full items-center">
            {[
                { tab: SidebarTab.ANALYSIS, icon: "M3.75 3v11.25A2.25 2.25 0 0 0 6 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0 1 18 16.5h-2.25m-7.5 0h7.5m-7.5 0-1 3m8.5-3 1 3m0 0 .5 1.5m-.5-1.5h-9.5m0 0-.5 1.5M9 11.25v1.5M12 9v3.75m3-6v6" },
                { tab: SidebarTab.CHAT, icon: "M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456ZM16.894 20.567 16.5 21.75l-.394-1.183a2.25 2.25 0 0 0-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 0 0 1.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 0 0 1.423 1.423l1.183.394-1.183.394a2.25 2.25 0 0 0-1.423 1.423Z" },
                { tab: SidebarTab.HISTORY, icon: "M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" },
                { tab: SidebarTab.VOICE, icon: "M12 18.75a6 6 0 0 0 6-6v-1.5m-6 7.5a6 6 0 0 1-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 0 1-3-3V4.5a3 3 0 1 1 6 0v8.25a3 3 0 0 1-3 3Z" }
            ].map(item => (
                <button 
                  key={item.tab}
                  onClick={() => setActiveTab(item.tab)}
                  className={`p-3 rounded-xl transition-all duration-200 group relative ${activeTab === item.tab ? 'bg-indigo-50 text-indigo-600' : 'text-gray-400 hover:bg-gray-50 hover:text-gray-600'}`}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                    <path strokeLinecap="round" strokeLinejoin="round" d={item.icon} />
                  </svg>
                  {activeTab === item.tab && <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-indigo-600 rounded-l-full"></div>}
                </button>
            ))}
          </div>

          <div className="mt-auto">
             <button onClick={handleExit} className="p-3 text-gray-400 hover:text-red-500 transition-colors" title="Exit">
               <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                 <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15M12 9l-3 3m0 0 3 3m-3-3h12.75" />
               </svg>
             </button>
          </div>
        </aside>
      )}

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col h-full overflow-hidden relative">
        {mode === AppMode.UPLOAD ? (
          <div className="flex-1 overflow-y-auto bg-gradient-to-br from-gray-50 to-white">
             <div className="min-h-full flex items-center justify-center p-6 py-12">
                <div className="max-w-6xl w-full grid grid-cols-1 md:grid-cols-2 gap-20 items-center">
                    <div className="order-2 md:order-1 space-y-8">
                      <div className="space-y-4">
                          <h1 className="text-5xl md:text-7xl font-serif font-bold text-gray-900 leading-tight tracking-tight">
                            Refine your <br/><span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-violet-600">Masterpiece.</span>
                          </h1>
                          <p className="text-xl text-gray-600 leading-relaxed max-w-lg font-light">
                            DraftSmith is your intelligent literary companion. From fixing plot holes to deep character analysis, elevate your manuscript with Gemini AI.
                          </p>
                      </div>
                      
                      <div className="flex gap-3 flex-wrap">
                          <div className="px-4 py-2 bg-white rounded-full border border-gray-200 shadow-sm flex items-center gap-2 text-sm font-medium text-gray-600">
                             <div className="w-2 h-2 rounded-full bg-indigo-500"></div> Agentic Editing
                          </div>
                          <div className="px-4 py-2 bg-white rounded-full border border-gray-200 shadow-sm flex items-center gap-2 text-sm font-medium text-gray-600">
                             <div className="w-2 h-2 rounded-full bg-violet-500"></div> Deep Thinking
                          </div>
                      </div>
                    </div>
                    <div className="w-full order-1 md:order-2">
                      <FileUpload onTextLoaded={handleTextLoaded} recentFiles={recentFiles} />
                    </div>
                </div>
             </div>
          </div>
        ) : (
          <div className="flex h-full">
            {/* Left: Text Viewer */}
            <div className="flex-1 flex flex-col border-r border-gray-200 bg-[#e5e7eb] relative">
              {/* Header */}
              <header className="h-16 border-b border-gray-200/50 flex items-center justify-between px-6 bg-white/80 backdrop-blur-sm sticky top-0 z-20 shadow-sm">
                 <div className="flex items-center gap-4">
                     <h2 className="font-semibold text-gray-800 truncate max-w-md font-serif text-lg">{fileName}</h2>
                     {hasUnsavedChanges && <span className="text-[10px] text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">Unsaved Changes</span>}
                 </div>
                 <div className="flex items-center gap-3">
                     <button 
                       onClick={runAnalysis} 
                       disabled={isAnalyzing}
                       className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 disabled:opacity-50 shadow-md shadow-indigo-200"
                     >
                       {isAnalyzing ? (
                         <>
                           <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                           Analyzing...
                         </>
                       ) : (
                         <>
                           <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                             <path fillRule="evenodd" d="M9 4.5a.75.75 0 0 1 .721.544l.813 2.846a3.75 3.75 0 0 0 2.576 2.576l2.846.813a.75.75 0 0 1 0 1.442l-2.846.813a3.75 3.75 0 0 0-2.576 2.576l-.813 2.846a.75.75 0 0 1-1.442 0l-.813-2.846a3.75 3.75 0 0 0-2.576-2.576l-2.846-.813a.75.75 0 0 1 0-1.442l2.846-.813a3.75 3.75 0 0 0 2.576-2.576l.813-2.846A.75.75 0 0 1 9 4.5ZM19.75 11.25a.75.75 0 0 0-1.5 0v2.25H16a.75.75 0 0 0 0 1.5h2.25v2.25a.75.75 0 0 0 1.5 0v-2.25H22a.75.75 0 0 0 0-1.5h-2.25v-2.25Z" clipRule="evenodd" />
                           </svg>
                           Deep Analysis
                         </>
                       )}
                     </button>
                 </div>
              </header>
              
              {/* Editor Body */}
              <div className="flex-1 overflow-y-auto bg-[#e5e7eb] px-4 py-8 md:px-8 relative">
                 <div className="max-w-4xl mx-auto bg-white min-h-[calc(100vh-8rem)] shadow-2xl rounded-sm border border-gray-200/50 paper-shadow relative">
                   <div className="p-12 md:p-16 lg:p-20">
                     <textarea 
                        ref={textareaRef}
                        className="w-full min-h-[60vh] resize-none outline-none border-none bg-transparent font-serif text-gray-800 text-xl leading-loose placeholder-gray-300 block overflow-hidden"
                        value={currentText}
                        onChange={handleEditorChange}
                        onSelect={handleSelectionChange}
                        onMouseUp={handleMouseUp}
                        onKeyUp={handleSelectionChange}
                        onClick={handleSelectionChange}
                        placeholder="Start typing your masterpiece..."
                        spellCheck={false}
                     />
                   </div>
                   
                   {/* Context Menu / Magic Bar */}
                   {selectionRange && selectionPos && (
                       <MagicBar 
                         isLoading={isMagicLoading} 
                         variations={magicVariations} 
                         helpResult={magicHelpResult}
                         helpType={magicHelpType}
                         onRewrite={handleRewrite}
                         onHelp={handleHelp}
                         onApply={applyVariation}
                         onClose={closeMagicBar}
                         position={selectionPos}
                       />
                   )}
                 </div>
                 <div className="h-8"></div> {/* Spacer */}
              </div>
            </div>

            {/* Right: Tools Panel */}
            <div className="w-[500px] bg-white flex flex-col shadow-2xl z-20 border-l border-gray-200">
               <div className="h-16 border-b border-gray-100 flex items-center px-6 bg-white shrink-0 justify-between">
                 <h3 className="font-semibold text-gray-700 flex items-center gap-2">
                   {activeTab === SidebarTab.ANALYSIS && "Analysis Report"}
                   {activeTab === SidebarTab.CHAT && "Editor Agent"}
                   {activeTab === SidebarTab.HISTORY && "Change History"}
                   {activeTab === SidebarTab.VOICE && "Live Session"}
                 </h3>
               </div>
               <div className="flex-1 overflow-hidden relative bg-gray-50/50">
                  {activeTab === SidebarTab.ANALYSIS && (
                    <AnalysisPanel analysis={analysis} isLoading={isAnalyzing} currentText={currentText} />
                  )}
                  {activeTab === SidebarTab.CHAT && (
                    <ChatInterface 
                        editorContext={editorContext} 
                        fullText={currentText} 
                        onAgentAction={handleAgentAction} 
                    />
                  )}
                   {activeTab === SidebarTab.HISTORY && (
                    <ActivityFeed history={history} onRestore={restore} />
                  )}
                  {activeTab === SidebarTab.VOICE && (
                    <VoiceMode />
                  )}
               </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;