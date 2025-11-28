import React, { useState, useMemo } from 'react';

interface Props {
    pacing: {
        score: number;
        analysis: string;
        slowSections: string[];
        fastSections: string[];
    };
    currentText: string;
}

export const PacingSection: React.FC<Props> = ({ pacing, currentText }) => {
  const [pacingFilter, setPacingFilter] = useState<'all' | 'slow' | 'fast'>('all');

  const timelineSegments = useMemo(() => {
    if (!pacing || !currentText) return [];
    
    const slow = pacing.slowSections.map(s => ({ text: s, type: 'slow' as const }));
    const fast = pacing.fastSections.map(s => ({ text: s, type: 'fast' as const }));
    
    const all = [...slow, ...fast];
    
    return all.map(item => {
        let index = currentText.indexOf(item.text);
        if (index === -1 && item.text.length > 20) {
             const snippet = item.text.substring(0, Math.min(item.text.length, 50));
             index = currentText.indexOf(snippet);
        }
        
        if (index === -1) return null;
        
        return {
            start: index,
            length: item.text.length,
            end: index + item.text.length,
            type: item.type,
            preview: item.text.substring(0, 100)
        };
    }).filter((x): x is NonNullable<typeof x> => x !== null)
      .sort((a, b) => a.start - b.start);
      
  }, [pacing, currentText]);

  const filteredSegments = useMemo(() => timelineSegments.filter(s => {
      if (pacingFilter === 'all') return true;
      return s.type === pacingFilter;
  }), [timelineSegments, pacingFilter]);

  const totalLength = currentText.length || 1;

  return (
    <div>
    <div className="flex items-center justify-between border-b border-gray-100 pb-2 mb-4">
        <h3 className="text-lg font-serif font-bold text-gray-800">Pacing & Flow</h3>
        <div className="flex bg-gray-100 rounded-lg p-0.5">
            <button 
              onClick={() => setPacingFilter('all')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${pacingFilter === 'all' ? 'bg-white shadow-sm text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}
            >
              All
            </button>
            <button 
              onClick={() => setPacingFilter('slow')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${pacingFilter === 'slow' ? 'bg-white shadow-sm text-red-600' : 'text-gray-500 hover:text-gray-700'}`}
            >
              Slow
            </button>
            <button 
              onClick={() => setPacingFilter('fast')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${pacingFilter === 'fast' ? 'bg-white shadow-sm text-orange-600' : 'text-gray-500 hover:text-gray-700'}`}
            >
              Fast
            </button>
        </div>
    </div>

    <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
        <div className="flex items-center gap-4 mb-4">
            <span className="text-sm font-semibold text-gray-500 uppercase">Pacing Score</span>
            <div className="flex-1 h-3 bg-gray-200 rounded-full overflow-hidden">
            <div 
                className={`h-full rounded-full ${pacing.score >= 7 ? 'bg-green-500' : pacing.score >= 5 ? 'bg-yellow-500' : 'bg-red-500'}`}
                style={{ width: `${(pacing.score / 10) * 100}%` }}
            ></div>
            </div>
            <span className="font-bold text-gray-900 text-lg">{pacing.score}/10</span>
        </div>
        <p className="text-sm text-gray-700 mb-6">{pacing.analysis}</p>

        {/* Visual Heatmap Timeline */}
        <div className="mb-6">
             <h4 className="text-xs font-bold text-gray-500 uppercase mb-2">Narrative Flow Timeline</h4>
             <div className="relative h-8 bg-gray-100 rounded border border-gray-200 overflow-hidden w-full flex items-center group">
                {/* Background tick marks */}
                <div className="absolute inset-0 flex justify-between px-1 pointer-events-none opacity-20">
                    {[...Array(11)].map((_, i) => <div key={i} className="w-[1px] h-full bg-gray-400"></div>)}
                </div>
                
                {/* Segments */}
                {filteredSegments.map((seg, i) => (
                    <div 
                        key={i}
                        className={`absolute top-0 bottom-0 transition-opacity duration-200 ${seg.type === 'slow' ? 'bg-red-400/80 hover:bg-red-500' : 'bg-orange-400/80 hover:bg-orange-500'}`}
                        style={{
                            left: `${(seg.start / totalLength) * 100}%`,
                            width: `${Math.max(1, (seg.length / totalLength) * 100)}%` // Ensure visible width
                        }}
                        title={`${seg.type === 'slow' ? 'Slow' : 'Fast'}: ${seg.preview}...`}
                    >
                    </div>
                ))}
                
                {filteredSegments.length === 0 && (
                    <div className="w-full text-center text-[10px] text-gray-400">No issues detected in selected filter.</div>
                )}
             </div>
             <div className="flex justify-between text-[10px] text-gray-400 mt-1 px-1 font-mono">
                <span>Start</span>
                <span>50%</span>
                <span>End</span>
             </div>
        </div>
        
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {(pacingFilter === 'all' || pacingFilter === 'slow') && (
                <div className={pacingFilter === 'slow' ? 'col-span-2' : ''}>
                    <h4 className="text-xs font-bold text-red-600 uppercase mb-2 flex items-center gap-2">
                       <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                       Dragging Sections (Too Slow)
                    </h4>
                    {pacing.slowSections.length > 0 ? (
                        <ul className="bg-red-50 rounded-md p-3 list-disc list-inside text-xs text-gray-700 space-y-2 border border-red-100 max-h-40 overflow-y-auto">
                            {pacing.slowSections.map((s, i) => <li key={i}>{s}</li>)}
                        </ul>
                    ) : <span className="text-xs text-gray-400 italic">None detected.</span>}
                </div>
            )}
            {(pacingFilter === 'all' || pacingFilter === 'fast') && (
                <div className={pacingFilter === 'fast' ? 'col-span-2' : ''}>
                    <h4 className="text-xs font-bold text-orange-600 uppercase mb-2 flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                        Rushed Sections (Too Fast)
                    </h4>
                    {pacing.fastSections.length > 0 ? (
                        <ul className="bg-orange-50 rounded-md p-3 list-disc list-inside text-xs text-gray-700 space-y-2 border border-orange-100 max-h-40 overflow-y-auto">
                            {pacing.fastSections.map((s, i) => <li key={i}>{s}</li>)}
                        </ul>
                    ) : <span className="text-xs text-gray-400 italic">None detected.</span>}
                </div>
            )}
        </div>
    </div>
  </div>
  );
};