import React, { useState, useMemo } from 'react';
import { useProjectStore } from '../store/useProjectStore';
import { AccessibleTooltip } from '@/features/shared/components/AccessibleTooltip';

interface Props {
  collapsed: boolean;
  toggleCollapsed: () => void;
}

export const ProjectSidebar: React.FC<Props> = ({ collapsed, toggleCollapsed }) => {
  const { 
    chapters, 
    activeChapterId, 
    selectChapter, 
    createChapter, 
    reorderChapters,
    currentProject
  } = useProjectStore();

  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === dropIndex) return;

    const newChapters = [...chapters];
    const [draggedItem] = newChapters.splice(draggedIndex, 1);
    newChapters.splice(dropIndex, 0, draggedItem);
    
    reorderChapters(newChapters);
    setDraggedIndex(null);
  };

  return (
    <aside className="w-64 bg-[var(--parchment-100)] border-r border-[var(--ink-100)] flex flex-col h-full shrink-0">
      {/* Header */}
      <div className="p-5 border-b border-[var(--ink-100)]">
        <h3 className="font-serif font-bold text-[var(--text-lg)] text-[var(--ink-800)] truncate" title={currentProject?.title}>
           {currentProject?.title || 'Untitled'}
        </h3>
        <p className="mt-1 text-[var(--text-xs)] text-[var(--ink-400)] uppercase tracking-wider font-medium">
           Manuscript
        </p>
      </div>

      {/* Chapter List */}
      <div className="flex-1 overflow-y-auto p-2">
         {chapters.map((chapter, index) => {
           // Calculate word count (simple calculation, no hook needed)
           const wordCount = chapter.content.trim().split(/\s+/).filter(Boolean).length;
           
           // Format word count
           const formattedWordCount = wordCount >= 1000 
             ? `${(wordCount / 1000).toFixed(1)}k` 
             : wordCount.toString();

           return (
             <div
               key={chapter.id}
               draggable
               onDragStart={(e) => handleDragStart(e, index)}
               onDragOver={(e) => handleDragOver(e, index)}
               onDrop={(e) => handleDrop(e, index)}
               onClick={() => selectChapter(chapter.id)}
               className={`w-full text-left p-3 mb-1 rounded-lg flex items-center gap-2 transition-all duration-200 group cursor-pointer ${
                 chapter.id === activeChapterId 
                   ? 'bg-[var(--parchment-50)] shadow-sm border border-[var(--ink-100)]' 
                   : 'border border-transparent hover:bg-[var(--parchment-50)]'
               } ${draggedIndex === index ? 'opacity-50' : ''}`}
             >
               {/* Drag Handle */}
               <div 
                 className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing text-[var(--ink-300)] hover:text-[var(--ink-500)]"
                 title="Drag to reorder"
               >
                 <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                   <circle cx="9" cy="6" r="2" />
                   <circle cx="15" cy="6" r="2" />
                   <circle cx="9" cy="12" r="2" />
                   <circle cx="15" cy="12" r="2" />
                   <circle cx="9" cy="18" r="2" />
                   <circle cx="15" cy="18" r="2" />
                 </svg>
               </div>

               {/* Chapter Number */}
               <span className={`w-5 h-5 rounded flex items-center justify-center text-[var(--text-xs)] font-bold shrink-0 ${
                 chapter.id === activeChapterId
                   ? 'bg-[var(--magic-100)] text-[var(--magic-500)]'
                   : 'bg-[var(--parchment-200)] text-[var(--ink-400)]'
               }`}>
                 {index + 1}
               </span>
               
               {/* Title and Metadata */}
               <div className="flex-1 min-w-0">
                 <span className={`block text-[var(--text-sm)] truncate ${
                   chapter.id === activeChapterId ? 'text-[var(--ink-800)] font-medium' : 'text-[var(--ink-600)]'
                 }`}>
                   {chapter.title}
                 </span>
                 <div className="flex items-center gap-2 mt-0.5">
                   <span className="text-[10px] text-[var(--ink-400)]">
                     {formattedWordCount} words
                   </span>
                   {chapter.updatedAt && (
                     <span className="text-[10px] text-[var(--ink-300)]">
                       · {new Date(chapter.updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                     </span>
                   )}
                 </div>
               </div>
               
               {/* Analysis Status Indicator */}
               {chapter.lastAnalysis && (
                 <AccessibleTooltip 
                   content={`Score: ${chapter.lastAnalysis.pacing?.score ?? 'N/A'}/10`}
                   position="left"
                 >
                   <div 
                     className={`w-2 h-2 rounded-full shrink-0 ${
                       (chapter.lastAnalysis.pacing?.score ?? 0) >= 7 ? 'bg-[var(--success-500)]' : 'bg-[var(--warning-500)]'
                     }`} 
                   />
                 </AccessibleTooltip>
               )}
             </div>
           );
         })}
      </div>

      {/* Footer */}
      <div className="p-3 border-t border-[var(--ink-100)]">
         <button 
           onClick={() => createChapter()}
           className="w-full py-3 bg-[var(--parchment-50)] border border-dashed border-[var(--ink-200)] rounded-lg text-[var(--ink-500)] text-[var(--text-sm)] font-medium hover:bg-[var(--magic-100)] hover:border-[var(--magic-300)] hover:text-[var(--magic-500)] transition-all flex items-center justify-center gap-2"
         >
            <span className="text-lg leading-none">+</span> New Chapter
         </button>
      </div>
    </aside>
  );
};
