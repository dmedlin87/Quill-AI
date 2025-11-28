import React, { useState } from 'react';

interface MagicBarProps {
  isLoading: boolean;
  variations: string[];
  helpResult?: string;
  helpType?: 'Explain' | 'Thesaurus' | null;
  onRewrite: (mode: string, tone?: string) => void;
  onHelp: (type: 'Explain' | 'Thesaurus') => void;
  onApply: (text: string) => void;
  onClose: () => void;
  position: { top: number; left: number };
}

const CopyButton = ({ text }: { text: string }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={handleCopy}
      className="shrink-0 p-1.5 text-gray-400 hover:text-indigo-600 rounded bg-white border border-gray-200 hover:border-indigo-300 opacity-0 group-hover:opacity-100 transition-all shadow-sm"
      title={copied ? "Copied!" : "Copy text"}
    >
      {copied ? (
         <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4 text-green-500">
           <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
         </svg>
      ) : (
         <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
           <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 0 1-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 0 1 1.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 0 0-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 0 1-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 0 0-3.375-3.375h-1.5a1.125 1.125 0 0 1-1.125-1.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H9.75" />
         </svg>
      )}
    </button>
  );
};

export const MagicBar: React.FC<MagicBarProps> = ({ 
  isLoading, 
  variations, 
  helpResult,
  helpType,
  onRewrite, 
  onHelp,
  onApply, 
  onClose,
  position 
}) => {
  const [activeView, setActiveView] = useState<'menu' | 'tone' | 'results' | 'help'>('menu');

  // Using fixed positioning to ensure it floats above everything correctly based on viewport coordinates
  const style: React.CSSProperties = {
    position: 'fixed',
    top: `${position.top}px`,
    left: `${position.left}px`,
    zIndex: 100,
    transform: 'translate(-50%, -100%)',
    marginTop: '-12px' // Gap above selection
  };

  if (isLoading) {
    return (
      <div style={style} className="animate-in fade-in zoom-in-95 duration-200">
        <div className="bg-gray-900/90 backdrop-blur-md text-white px-4 py-2 rounded-lg shadow-xl flex items-center gap-3 border border-gray-700">
           <div className="w-3 h-3 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin"></div>
           <span className="font-medium text-xs">DraftSmith is thinking...</span>
        </div>
        <div className="w-3 h-3 bg-gray-900/90 absolute left-1/2 -bottom-1.5 -translate-x-1/2 rotate-45 border-r border-b border-gray-700"></div>
      </div>
    );
  }

  // Display Help Results (Definition/Thesaurus)
  if (helpResult) {
    const isThesaurus = helpType === 'Thesaurus';
    return (
        <div style={style} className="w-72 animate-in fade-in zoom-in-95 duration-200">
            <div className="bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden ring-1 ring-black/5">
                <div className="bg-gradient-to-r from-indigo-50 to-white px-4 py-3 border-b border-indigo-100 flex justify-between items-center">
                    <h3 className="font-bold text-xs text-indigo-900 uppercase tracking-wide flex items-center gap-2">
                      <span className="text-base">{isThesaurus ? '📚' : '💡'}</span> {isThesaurus ? 'Synonyms' : 'Context'}
                    </h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                      </svg>
                    </button>
                </div>
                <div className="p-4 bg-white/80">
                    {isThesaurus ? (
                        <div className="flex flex-wrap gap-2">
                            {helpResult.split(',').map(s => s.trim()).filter(s => s.length > 0).map((word, i) => (
                                 <button key={i} onClick={() => onApply(word)} className="px-2 py-1 bg-indigo-50 border border-indigo-200 rounded-md text-sm text-indigo-700 hover:bg-indigo-100 hover:border-indigo-300 transition-all shadow-sm">
                                    {word}
                                 </button>
                            ))}
                        </div>
                    ) : (
                        <p className="text-sm text-gray-700 leading-relaxed font-serif">{helpResult}</p>
                    )}
                </div>
                {isThesaurus && <div className="px-4 py-2 bg-gray-50 text-[10px] text-gray-400 text-center border-t border-gray-100">Click to replace text</div>}
            </div>
            <div className="w-3 h-3 bg-white absolute left-1/2 -bottom-1.5 -translate-x-1/2 rotate-45 border-r border-b border-gray-200 shadow-sm"></div>
        </div>
    );
  }

  // Display Rewrite Variations
  if (variations.length > 0) {
    return (
      <div style={style} className="w-96 animate-in fade-in zoom-in-95 duration-200">
        <div className="bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden ring-1 ring-black/5">
          <div className="bg-gradient-to-r from-gray-50 to-white px-4 py-3 border-b border-gray-100 flex justify-between items-center">
            <h3 className="font-serif font-bold text-gray-700 flex items-center gap-2 text-sm">
              <span className="text-lg">✨</span> Pick a Variation
            </h3>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="p-2 grid gap-2 max-h-[40vh] overflow-y-auto bg-gray-50/30">
            {variations.map((v, i) => (
              <div
                key={i}
                className="relative flex items-start gap-2 p-3 rounded-lg border border-gray-200 bg-white hover:border-indigo-300 hover:bg-indigo-50 hover:shadow-sm transition-all group"
              >
                 <button
                    onClick={() => onApply(v)}
                    className="flex-1 text-left outline-none focus:outline-none"
                  >
                    <p className="text-gray-800 text-sm leading-relaxed font-serif">{v}</p>
                 </button>
                 <CopyButton text={v} />
              </div>
            ))}
          </div>
        </div>
        <div className="w-3 h-3 bg-white absolute left-1/2 -bottom-1.5 -translate-x-1/2 rotate-45 border-r border-b border-gray-200 shadow-sm"></div>
      </div>
    );
  }

  // Tone Selection View
  if (activeView === 'tone') {
     return (
        <div style={style} className="animate-in fade-in zoom-in-95 duration-200">
          <div className="bg-gray-900/95 backdrop-blur-md p-1.5 rounded-xl shadow-2xl border border-gray-700 flex items-center gap-1">
             <button onClick={() => setActiveView('menu')} className="p-1.5 text-gray-400 hover:text-white rounded-lg transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                </svg>
             </button>
             <div className="w-px h-5 bg-gray-700 mx-1"></div>
             {['Darker', 'Lighter', 'More Formal', 'Emotional', 'Period Accurate'].map((tone) => (
                <button
                    key={tone}
                    onClick={() => onRewrite('Tone Tuner', tone)}
                    className="px-3 py-1.5 text-xs font-medium text-gray-200 hover:bg-gray-700 hover:text-white rounded-lg transition-colors whitespace-nowrap"
                >
                    {tone}
                </button>
             ))}
          </div>
          <div className="w-3 h-3 bg-gray-900/95 absolute left-1/2 -bottom-1.5 -translate-x-1/2 rotate-45 border-r border-b border-gray-700"></div>
        </div>
     );
  }

  // Main Context Menu
  return (
    <div style={style} className="animate-in fade-in zoom-in-95 duration-200">
      <div className="bg-gray-900/95 backdrop-blur-md p-1.5 rounded-xl shadow-2xl border border-gray-700 flex items-center gap-1">
        
        {/* Help Actions */}
        <button 
            onClick={() => onHelp('Explain')}
            className="px-3 py-1.5 text-xs font-medium text-gray-300 hover:text-white hover:bg-gray-700 rounded-lg transition-all flex items-center gap-1.5"
            title="Get definition or context"
        >
            <span className="text-gray-400 text-sm">?</span> Explain
        </button>
        <button 
            onClick={() => onHelp('Thesaurus')}
            className="px-3 py-1.5 text-xs font-medium text-gray-300 hover:text-white hover:bg-gray-700 rounded-lg transition-all flex items-center gap-1.5"
            title="Get period-accurate synonyms"
        >
            <span className="text-gray-400 text-sm">Aa</span> Thesaurus
        </button>

        <div className="w-px h-5 bg-gray-700 mx-1"></div>

        {/* Edit Actions */}
        <button 
            onClick={() => onRewrite('Show, Don\'t Tell')}
            className="px-3 py-1.5 text-xs font-medium text-indigo-300 hover:text-indigo-100 hover:bg-indigo-900/50 rounded-lg transition-all flex items-center gap-1.5 whitespace-nowrap"
        >
            <span className="text-sm">👁️</span> Show
        </button>

        <button 
            onClick={() => onRewrite('Dialogue Doctor')}
            className="px-3 py-1.5 text-xs font-medium text-indigo-300 hover:text-indigo-100 hover:bg-indigo-900/50 rounded-lg transition-all flex items-center gap-1.5 whitespace-nowrap"
        >
             <span className="text-sm">💬</span> Dialogue
        </button>

        <button 
            onClick={() => setActiveView('tone')}
            className="px-3 py-1.5 text-xs font-medium text-indigo-300 hover:text-indigo-100 hover:bg-indigo-900/50 rounded-lg transition-all flex items-center gap-1.5 whitespace-nowrap"
        >
             <span className="text-sm">🎭</span> Tone
        </button>

        <div className="w-px h-5 bg-gray-700 mx-1"></div>

        <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-red-400 rounded-lg transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
        </button>
      </div>
      <div className="w-3 h-3 bg-gray-900/95 absolute left-1/2 -bottom-1.5 -translate-x-1/2 rotate-45 border-r border-b border-gray-700"></div>
    </div>
  );
};