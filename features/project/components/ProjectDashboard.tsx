import React, { useState, useRef, useMemo } from 'react';
import { useProjectStore } from '../store/useProjectStore';
import { parseManuscript, ParsedChapter } from '@/services/manuscriptParser';
import { ImportWizard } from './ImportWizard';
import { Project } from '@/types/schema';

/**
 * Generate a deterministic gradient from a string (project title)
 * Returns CSS gradient string
 */
function generateBookGradient(title: string): { gradient: string; textColor: string } {
  // Simple hash function
  let hash = 0;
  for (let i = 0; i < title.length; i++) {
    hash = title.charCodeAt(i) + ((hash << 5) - hash);
    hash = hash & hash;
  }

  // Generate hue from hash (0-360)
  const hue1 = Math.abs(hash % 360);
  const hue2 = (hue1 + 30 + (hash % 40)) % 360; // Complementary shift
  
  // Saturation and lightness for rich book cover colors
  const sat = 55 + (Math.abs(hash >> 8) % 25); // 55-80%
  const light1 = 25 + (Math.abs(hash >> 4) % 15); // 25-40% (darker)
  const light2 = 35 + (Math.abs(hash >> 6) % 15); // 35-50%

  const gradient = `linear-gradient(135deg, hsl(${hue1}, ${sat}%, ${light1}%) 0%, hsl(${hue2}, ${sat}%, ${light2}%) 100%)`;
  
  return { gradient, textColor: 'white' };
}

/**
 * Book Cover Card Component
 */
const BookCoverCard: React.FC<{
  project: Project;
  onClick: () => void;
}> = ({ project, onClick }) => {
  const { gradient, textColor } = useMemo(
    () => generateBookGradient(project.title),
    [project.title]
  );

  return (
    <button
      onClick={onClick}
      className="group relative flex flex-col h-64 rounded-lg overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-300 hover:-translate-y-1 hover:scale-[1.02]"
      style={{ perspective: '1000px' }}
    >
      {/* Book Spine Effect (left edge) */}
      <div 
        className="absolute left-0 top-0 bottom-0 w-4 z-10"
        style={{ 
          background: 'linear-gradient(to right, rgba(0,0,0,0.3), rgba(0,0,0,0.1), transparent)',
        }}
      />
      
      {/* Book Cover */}
      <div 
        className="flex-1 flex flex-col p-5 pt-6 relative"
        style={{ background: gradient }}
      >
        {/* Decorative top border */}
        <div className="absolute top-0 left-4 right-0 h-2 bg-gradient-to-r from-white/20 to-transparent" />
        
        {/* Subtle texture overlay */}
        <div 
          className="absolute inset-0 opacity-10 pointer-events-none"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='3'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`
          }}
        />

        {/* Title Area */}
        <div className="relative z-10 flex-1 flex flex-col">
          <h3 
            className="font-serif font-bold text-xl leading-tight mb-2 line-clamp-3"
            style={{ color: textColor, textShadow: '0 2px 4px rgba(0,0,0,0.3)' }}
          >
            {project.title}
          </h3>
          <p 
            className="text-sm opacity-80 font-light italic"
            style={{ color: textColor }}
          >
            by {project.author}
          </p>
          
          {/* Setting Badge */}
          {project.setting && (
            <div className="mt-3">
              <span 
                className="inline-block text-xs px-2 py-1 rounded bg-black/20 backdrop-blur-sm"
                style={{ color: textColor }}
              >
                {project.setting.timePeriod} • {project.setting.location}
              </span>
            </div>
          )}
        </div>

        {/* Decorative element */}
        <div className="absolute bottom-12 right-4 opacity-20">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="currentColor" style={{ color: textColor }}>
            <path d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/>
          </svg>
        </div>
      </div>

      {/* Spine Footer (metadata) */}
      <div 
        className="px-4 py-2.5 bg-gradient-to-r from-gray-900 to-gray-800 flex items-center justify-center"
      >
        <span className="text-xs text-gray-500 flex items-center gap-1">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10"/>
            <polyline points="12 6 12 12 16 14"/>
          </svg>
          {new Date(project.updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
        </span>
      </div>

      {/* Hover glow effect */}
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none rounded-lg"
        style={{ boxShadow: 'inset 0 0 30px rgba(255,255,255,0.1)' }}
      />
    </button>
  );
};

export const ProjectDashboard: React.FC = () => {
  const { projects, loadProject, createProject, importProject } = useProjectStore();
  
  // Modal State for Metadata
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [importedContent, setImportedContent] = useState<string | null>(null);
  
  // Wizard State
  const [parsedChapters, setParsedChapters] = useState<ParsedChapter[] | null>(null);
  
  // Form State
  const [newTitle, setNewTitle] = useState('');
  const [authorName, setAuthorName] = useState(() => {
    if (typeof localStorage !== 'undefined') {
      return localStorage.getItem('quill_author_name') || '';
    }
    return '';
  });
  const [newTime, setNewTime] = useState('');
  const [newLocation, setNewLocation] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetForm = () => {
      setNewTitle('');
      setNewTime('');
      setNewLocation('');
      setImportedContent(null);
      setParsedChapters(null);
      setIsModalOpen(false);
      setError(null);
      setIsProcessing(false);
  };

  const handleCreateOrNext = async () => {
    if (!newTitle.trim() || isProcessing) return;
    
    // If this is an Import workflow
    if (importedContent !== null) {
        // Run Parser
        const chapters = parseManuscript(importedContent);
        setParsedChapters(chapters);
        setIsModalOpen(false); // Close metadata modal, open wizard (handled by render)
        return;
    } 

    // Create New Project (No Import)
    const setting = (newTime || newLocation) ? {
        timePeriod: newTime || 'Contemporary',
        location: newLocation || 'General'
    } : undefined;

    const finalAuthor = authorName.trim() || 'Me';
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('quill_author_name', finalAuthor);
    }

    try {
      setIsProcessing(true);
      setError(null);
      await createProject(newTitle, finalAuthor, setting);
      resetForm();
    } catch (err) {
      setError('Unable to create project. Please try again.');
      setIsProcessing(false);
    }
  };

  const handleWizardConfirm = async (finalChapters: ParsedChapter[]) => {
      const setting = (newTime || newLocation) ? {
          timePeriod: newTime || 'Contemporary',
          location: newLocation || 'General'
      } : undefined;

      const finalAuthor = authorName.trim() || 'Me';
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem('quill_author_name', finalAuthor);
      }

      try {
        setIsProcessing(true);
        setError(null);
        await importProject(newTitle, finalChapters, finalAuthor, setting);
        resetForm();
      } catch (err) {
        setError('Unable to import draft. Please try again.');
        setIsProcessing(false);
      }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      try {
          const text = await file.text();
          const cleanName = file.name.replace(/\.[^/.]+$/, ""); // remove extension
          
          setImportedContent(text);
          setNewTitle(cleanName);
          setIsModalOpen(true); // Open modal to confirm details/settings
      } catch (err) {
          setError("Failed to read file.");
      }
      
      // Reset input value so same file can be selected again if needed
      if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // --- Render Import Wizard ---
  if (parsedChapters) {
      return (
          <ImportWizard 
             initialChapters={parsedChapters} 
             onConfirm={handleWizardConfirm}
             onCancel={resetForm}
          />
      );
  }

  // --- Render Dashboard ---
  return (
    <div className="flex-1 overflow-y-auto bg-gradient-to-br from-[#1a1a2e] via-[#16213e] to-[#0f0f1a] h-full relative">
      {/* Ambient glow effects */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-1/4 w-80 h-80 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
      {isModalOpen && (
          <div className="absolute inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
              <div className="bg-gradient-to-br from-gray-900 to-gray-800 border border-gray-700 rounded-2xl shadow-2xl p-8 max-w-md w-full animate-in fade-in zoom-in-95 duration-200">
                  <h3 className="text-2xl font-serif font-bold text-white mb-2">
                      {importedContent ? "Import Draft Settings" : "Start a New Novel"}
                  </h3>
                  <p className="text-sm text-gray-400 mb-6">
                      {importedContent ? "We'll attempt to detect chapters. You can review them in the next step." : "Tell us a bit about your new book."}
                  </p>
                  {error && (
                    <div className="mb-4 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                      {error}
                    </div>
                  )}
                  
                  <div className="space-y-4">
                      <div>
                          <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Book Title</label>
                          <input 
                            className="w-full bg-gray-800 border border-gray-600 text-white rounded-lg p-3 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none placeholder-gray-500"
                            placeholder="e.g. The Winds of Winter"
                            value={newTitle}
                            onChange={e => setNewTitle(e.target.value)}
                            autoFocus
                          />
                      </div>

                      <div>
                          <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Author Name</label>
                          <input
                            className="w-full bg-gray-800 border border-gray-600 text-white rounded-lg p-3 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none placeholder-gray-500"
                            placeholder="e.g. George R.R. Martin"
                            value={authorName}
                            onChange={e => setAuthorName(e.target.value)}
                          />
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Time Period</label>
                            <input 
                                className="w-full bg-gray-800 border border-gray-600 text-white rounded-lg p-3 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-sm placeholder-gray-500"
                                placeholder="e.g. 1890s, 2050"
                                value={newTime}
                                onChange={e => setNewTime(e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-400 uppercase mb-1">Location</label>
                            <input 
                                className="w-full bg-gray-800 border border-gray-600 text-white rounded-lg p-3 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none text-sm placeholder-gray-500"
                                placeholder="e.g. London, Mars"
                                value={newLocation}
                                onChange={e => setNewLocation(e.target.value)}
                            />
                        </div>
                      </div>
                      <p className="text-xs text-gray-500">Defining the setting helps the AI detect anachronisms and tone mismatches.</p>
                  </div>

                  <div className="flex justify-end gap-3 mt-8">
                      <button 
                        onClick={resetForm}
                        className="px-4 py-2 text-gray-400 hover:bg-gray-700 rounded-lg transition-colors"
                      >
                          Cancel
                      </button>
                      <button 
                        onClick={handleCreateOrNext}
                        disabled={!newTitle.trim() || isProcessing}
                        className="px-6 py-2 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-500 disabled:opacity-50 transition-colors"
                      >
                          {isProcessing ? "Working..." : importedContent ? "Next: Review Chapters" : "Create Project"}
                      </button>
                  </div>
              </div>
          </div>
      )}

      <div className="min-h-full flex items-center justify-center p-6 py-12 relative z-10">
        <div className="max-w-5xl w-full">
          {/* Header */}
          <div className="text-center mb-12">
            {projects.length === 0 ? (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-700">
                <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-indigo-500/10 mb-6 ring-1 ring-indigo-500/30">
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-indigo-400">
                    <path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z"/>
                    <path d="M12 7v5l3 3"/>
                  </svg>
                </div>
                <h1 className="text-5xl md:text-6xl font-serif font-bold text-transparent bg-clip-text bg-gradient-to-r from-indigo-200 via-white to-indigo-200 mb-4">
                  Welcome to Quill
                </h1>
                <p className="text-xl text-gray-400 font-light max-w-2xl mx-auto leading-relaxed">
                  Your intelligent creative partner awaits.<br/>
                  <span className="text-indigo-300">Start your first project</span> to begin the journey.
                </p>
              </div>
            ) : (
              <>
                <div className="inline-flex items-center gap-3 mb-4">
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-indigo-400">
                    <path d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/>
                  </svg>
                  <h1 className="text-4xl md:text-5xl font-serif font-bold text-white">
                    Quill AI Library
                  </h1>
                </div>
                <p className="text-lg text-gray-400 font-light">
                  Select a novel to continue writing or start a new masterpiece.
                </p>
              </>
            )}
          </div>

          {/* Book Shelf Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-5">
            {/* New Project Card (styled as empty book slot) */}
            <button 
              onClick={() => {
                  setImportedContent(null);
                  setIsModalOpen(true);
              }}
              className="group flex flex-col items-center justify-center h-64 rounded-lg border-2 border-dashed border-gray-600 hover:border-indigo-500 bg-gray-800/30 hover:bg-gray-800/50 transition-all"
            >
              <div className="w-14 h-14 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <path d="M12 4.5v15m7.5-7.5h-15" />
                </svg>
              </div>
              <span className="font-medium text-gray-400 group-hover:text-white transition-colors">New Novel</span>
            </button>

            {/* Import Card */}
            <div className="relative">
                <input 
                    type="file" 
                    accept=".txt,.md"
                    className="hidden"
                    ref={fileInputRef}
                    onChange={handleFileSelect}
                />
                <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="group w-full h-64 flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-600 hover:border-purple-500 bg-gray-800/30 hover:bg-gray-800/50 transition-all"
                >
                    <div className="w-14 h-14 rounded-full bg-purple-500/20 text-purple-400 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                            <path d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5" />
                        </svg>
                    </div>
                    <span className="font-medium text-gray-400 group-hover:text-white transition-colors">Import Draft</span>
                    <span className="text-xs text-gray-500 mt-1">.txt / .md</span>
                </button>
            </div>

            {/* Existing Projects as Book Covers */}
            {projects.map(project => (
              <BookCoverCard
                key={project.id}
                project={project}
                onClick={() => loadProject(project.id)}
              />
            ))}
          </div>

          {/* Shelf decoration */}
          <div className="mt-8 h-3 bg-gradient-to-r from-transparent via-gray-700/50 to-transparent rounded-full" />
        </div>
      </div>
    </div>
  );
};