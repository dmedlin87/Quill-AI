import React, { useState } from 'react';
import { useProjectStore } from '../store/useProjectStore';

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
         {chapters.map((chapter, index) => (
           <button
             key={chapter.id}
             draggable
             onDragStart={(e) => handleDragStart(e, index)}
             onDragOver={(e) => handleDragOver(e, index)}
             onDrop={(e) => handleDrop(e, index)}
             onClick={() => selectChapter(chapter.id)}
             className={`w-full text-left p-3 mb-1 rounded-lg flex items-center gap-3 transition-all duration-200 group ${
               chapter.id === activeChapterId 
                 ? 'bg-[var(--parchment-50)] shadow-sm border border-[var(--ink-100)]' 
                 : 'border border-transparent hover:bg-[var(--parchment-50)]'
             }`}
           >
             <span className={`w-5 h-5 rounded flex items-center justify-center text-[var(--text-xs)] font-bold shrink-0 ${
               chapter.id === activeChapterId
                 ? 'bg-[var(--magic-100)] text-[var(--magic-500)]'
                 : 'bg-[var(--parchment-200)] text-[var(--ink-400)]'
             }`}>
               {index + 1}
             </span>
             
             <span className={`flex-1 text-[var(--text-sm)] truncate ${
               chapter.id === activeChapterId ? 'text-[var(--ink-800)] font-medium' : 'text-[var(--ink-600)]'
             }`}>
               {chapter.title}
             </span>
             
             {chapter.lastAnalysis && (
                <div 
                  className={`w-1.5 h-1.5 rounded-full ${
                    chapter.lastAnalysis.pacing.score >= 7 ? 'bg-[var(--success-500)]' : 'bg-[var(--warning-500)]'
                  }`} 
                />
             )}
           </button>
         ))}
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
