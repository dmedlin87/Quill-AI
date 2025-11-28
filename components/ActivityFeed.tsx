import React from 'react';
import { HistoryItem } from '../types';

interface ActivityFeedProps {
  history: HistoryItem[];
  onRestore: (id: string) => void;
}

export const ActivityFeed: React.FC<ActivityFeedProps> = ({ history, onRestore }) => {
  return (
    <div className="h-full bg-white flex flex-col">
       <div className="p-4 border-b border-gray-100">
           <h3 className="font-serif font-bold text-gray-800">Edit History</h3>
           <p className="text-xs text-gray-500">Track changes and restore versions.</p>
       </div>
       
       <div className="flex-1 overflow-y-auto p-4 space-y-6">
           {history.length === 0 && (
               <div className="text-center text-gray-400 py-10 text-sm">
                   No changes recorded yet.
               </div>
           )}

           {[...history].reverse().map((item, index) => (
               <div key={item.id} className="relative pl-6 group">
                   {/* Timeline Line */}
                   <div className="absolute left-2 top-2 bottom-[-24px] w-px bg-gray-200 group-last:bottom-0"></div>
                   
                   {/* Dot */}
                   <div className={`absolute left-0 top-1.5 w-4 h-4 rounded-full border-2 border-white shadow-sm flex items-center justify-center ${item.author === 'Agent' ? 'bg-indigo-500' : 'bg-gray-400'}`}>
                       {item.author === 'Agent' && <div className="w-1.5 h-1.5 bg-white rounded-full"></div>}
                   </div>

                   <div className="bg-white border border-gray-100 rounded-lg p-3 shadow-sm hover:shadow-md transition-shadow">
                       <div className="flex justify-between items-start mb-1">
                           <span className={`text-xs font-bold uppercase tracking-wide ${item.author === 'Agent' ? 'text-indigo-600' : 'text-gray-600'}`}>
                               {item.author}
                           </span>
                           <span className="text-[10px] text-gray-400">
                               {new Date(item.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                           </span>
                       </div>
                       
                       <p className="text-sm text-gray-800 font-medium mb-2">{item.description}</p>
                       
                       <button 
                         onClick={() => onRestore(item.id)}
                         className="text-xs flex items-center gap-1 text-gray-400 hover:text-red-500 transition-colors"
                       >
                           <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-3 h-3">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M9 15 3 9m0 0 6-6M3 9h12a6 6 0 0 1 0 12h-3" />
                           </svg>
                           Revert to this state
                       </button>
                   </div>
               </div>
           ))}
       </div>
    </div>
  );
};
