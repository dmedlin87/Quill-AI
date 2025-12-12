import React, { useState } from 'react';
import { useProjectStore } from '@/features/project/store/useProjectStore';
import { generateExport } from '../utils/exportFormats';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ExportModal: React.FC<ExportModalProps> = ({ isOpen, onClose }) => {
  const { currentProject, chapters } = useProjectStore();
  const [format, setFormat] = useState<'txt' | 'md' | 'docx' | 'pdf'>('txt');
  const [includeTitle, setIncludeTitle] = useState(true);
  const [includeAuthor, setIncludeAuthor] = useState(true);
  const [includeChapterTitles, setIncludeChapterTitles] = useState(true);
  const [isExporting, setIsExporting] = useState(false);

  if (!isOpen || !currentProject) return null;

  const handleExport = async () => {
    try {
      setIsExporting(true);
      await generateExport(
        { title: currentProject.title, author: currentProject.author },
        chapters,
        {
          format,
          includeTitle,
          includeAuthor,
          includeChapterTitles,
        }
      );

      onClose();
    } catch (error) {
      console.error('Export failed:', error);
      alert('Export failed. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-md bg-[var(--surface-primary)] rounded-xl shadow-2xl border border-[var(--border-primary)] overflow-hidden">
        <div className="p-6 border-b border-[var(--border-primary)] flex justify-between items-center">
          <h2 className="text-xl font-bold text-[var(--text-primary)]">Export Studio</h2>
          <button onClick={onClose} className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)]">
            ✕
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Format Selection */}
          <div>
            <label className="block text-sm font-medium text-[var(--text-secondary)] mb-2">Format</label>
            <div className="grid grid-cols-2 gap-3">
              {(['txt', 'md', 'docx', 'pdf'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setFormat(f)}
                  className={`px-4 py-3 rounded-lg border text-sm font-semibold capitalize transition-all ${
                    format === f
                      ? 'bg-[var(--interactive-accent)] border-transparent text-white'
                      : 'bg-[var(--surface-secondary)] border-[var(--border-secondary)] text-[var(--text-secondary)] hover:border-[var(--interactive-accent)]'
                  }`}
                >
                  {f === 'md' ? 'Markdown' : f.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          {/* Options */}
          <div className="space-y-3">
            <label className="block text-sm font-medium text-[var(--text-secondary)]">Options</label>

            <label className="flex items-center gap-3 p-3 rounded-lg border border-[var(--border-secondary)] cursor-pointer hover:bg-[var(--surface-secondary)]">
              <input
                type="checkbox"
                checked={includeTitle}
                onChange={(e) => setIncludeTitle(e.target.checked)}
                className="w-5 h-5 rounded border-gray-300 text-[var(--interactive-accent)] focus:ring-[var(--interactive-accent)]"
              />
              <span className="text-sm text-[var(--text-primary)]">Include Title Page</span>
            </label>

            <label className="flex items-center gap-3 p-3 rounded-lg border border-[var(--border-secondary)] cursor-pointer hover:bg-[var(--surface-secondary)]">
              <input
                type="checkbox"
                checked={includeAuthor}
                onChange={(e) => setIncludeAuthor(e.target.checked)}
                className="w-5 h-5 rounded border-gray-300 text-[var(--interactive-accent)] focus:ring-[var(--interactive-accent)]"
              />
              <span className="text-sm text-[var(--text-primary)]">Include Author Name</span>
            </label>

            <label className="flex items-center gap-3 p-3 rounded-lg border border-[var(--border-secondary)] cursor-pointer hover:bg-[var(--surface-secondary)]">
              <input
                type="checkbox"
                checked={includeChapterTitles}
                onChange={(e) => setIncludeChapterTitles(e.target.checked)}
                className="w-5 h-5 rounded border-gray-300 text-[var(--interactive-accent)] focus:ring-[var(--interactive-accent)]"
              />
              <span className="text-sm text-[var(--text-primary)]">Include Chapter Headers</span>
            </label>
          </div>
        </div>

        <div className="p-6 bg-[var(--surface-secondary)] border-t border-[var(--border-primary)] flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
          >
            Cancel
          </button>
          <button
            onClick={handleExport}
            disabled={isExporting}
            className="px-6 py-2 rounded-lg bg-[var(--interactive-accent)] text-white text-sm font-semibold shadow-sm hover:opacity-90 disabled:opacity-50"
          >
            {isExporting ? 'Exporting...' : 'Download Export'}
          </button>
        </div>
      </div>
    </div>
  );
};
