import React, { useState, useCallback, useMemo } from 'react';
import { usePlotSuggestions } from '@/features/shared';

interface Props {
    currentText: string;
}

export const BrainstormingPanel: React.FC<Props> = ({ currentText }) => {
  const { suggestions, isLoading, error, generate } = usePlotSuggestions(currentText);
  const [suggestionQuery, setSuggestionQuery] = useState('');
  const [suggestionType, setSuggestionType] = useState('General');
  const suggestionTypes = useMemo(
    () => ['General', 'Plot Twist', 'Character Arc', 'Conflict', 'Theme', 'World Building'],
    []
  );

  const handleGenerateIdeas = useCallback(() => {
      const trimmedQuery = suggestionQuery.trim();
      if (!trimmedQuery) return;
      generate(trimmedQuery, suggestionType);
  }, [generate, suggestionQuery, suggestionType]);

  return (
    <div className="pt-6 border-t border-gray-200">

    <h3 className="text-lg font-serif font-bold text-indigo-900 mb-4 flex items-center gap-2">
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-5 h-5 text-indigo-500">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 18v-5.25m0 0a6.01 6.01 0 0 0 1.5-.189m-1.5.189a6.01 6.01 0 0 1-1.5-.189m3.75 2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
        </svg>
        Creative Brainstorming
    </h3>
    
    <div className="bg-gray-50 rounded-lg p-5 mb-6 border border-gray-200">
         <label className="block text-xs font-bold text-gray-500 uppercase mb-3">Generate specific plot ideas</label>
         
         {/* Suggestion Type Selectors */}
         <div className="flex flex-wrap gap-2 mb-3">
            {suggestionTypes.map(type => (
                <button
                    key={type}
                    type="button"
                    onClick={() => setSuggestionType(type)}
                    className={`px-3 py-1 text-xs rounded-full border transition-all ${suggestionType === type ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm' : 'bg-white text-gray-600 border-gray-200 hover:border-indigo-300 hover:text-indigo-600'}`}
                >
                    {type}
                </button>
            ))}
         </div>

         <div className="flex gap-3 h-10">
             <input 
                 type="text" 
                 className="flex-1 text-sm border border-gray-300 rounded-lg px-4 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 focus:outline-none transition-shadow"
                 placeholder={`e.g., 'A shocking revelation about the protagonist'`}
                 value={suggestionQuery}
                 onChange={(e) => setSuggestionQuery(e.target.value)}
                 onKeyDown={(e) => e.key === 'Enter' && handleGenerateIdeas()}
             />
             <button 
                type="button"
                onClick={handleGenerateIdeas}
                disabled={isLoading || !suggestionQuery.trim()}
                className="bg-indigo-600 text-white px-6 rounded-lg text-sm font-semibold hover:bg-indigo-700 disabled:opacity-70 disabled:cursor-not-allowed flex items-center gap-2 whitespace-nowrap transition-colors shadow-sm"
            >
                 {isLoading ? (
                     <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        Thinking...
                     </>
                 ) : (
                     "Generate"
                 )}
             </button>
         </div>
         {error && <div className="text-red-500 text-xs mt-2">{error}</div>}
    </div>

    {suggestions.length > 0 && (
        <div className="space-y-4 animate-fadeIn">
            {suggestions.map((idea, idx) => (
                <div key={idx} className="bg-white border border-indigo-100 rounded-lg p-5 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-start mb-2">
                        <h4 className="font-bold text-indigo-700">{idea.title}</h4>
                    </div>
                    <p className="text-gray-700 text-sm mb-3">{idea.description}</p>
                    <div className="text-xs text-gray-500 bg-gray-50 p-2.5 rounded border border-gray-100">
                        <span className="font-bold text-gray-600">Why this works: </span>{idea.reasoning}
                    </div>
                </div>
            ))}
        </div>
    )}
</div>
  );
};