import React, { useCallback, useMemo, useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { UsageBadge } from '@/features/shared';
import { useLayoutStore } from './store/useLayoutStore';
import { VoiceCommandButton } from '@/features/voice';
import { useProjectStore } from '@/features/project/store/useProjectStore';
import { ExportSection, type ExportConfig } from '@/types/export';
import { pdfExportService } from '@/services/pdfExport';
import { exportStandardManuscriptDocx } from '@/services/io/docxExporter';
import { createManuscriptExportData, toManuscriptExportChapters } from '@/services/io/manuscriptExport';

interface EditorHeaderProps {
  isZenMode: boolean;
}

/**
 * EditorHeader - The top header bar in the editor view.
 * Auto-hides in Zen Mode but reveals on hover.
 */
export const EditorHeader: React.FC<EditorHeaderProps> = ({ isZenMode }) => {
  const { isHeaderHovered, setHeaderHovered } = useLayoutStore((state) => ({
    isHeaderHovered: state.isHeaderHovered,
    setHeaderHovered: state.setHeaderHovered,
  }));
  const { currentProject, chapters } = useProjectStore((state) => ({
    currentProject: state.currentProject,
    chapters: state.chapters,
  }));
  const prefersReducedMotion = useReducedMotion();

  const [isExportOpen, setIsExportOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const safeBaseName = useMemo(() => {
    const title = currentProject?.title ?? 'quill-export';
    return title.replace(/[^a-zA-Z0-9_-]/g, '_').toLowerCase();
  }, [currentProject?.title]);

  const canExport = Boolean(currentProject) && chapters.length > 0 && !isExporting;

  const standardConfig = useMemo((): ExportConfig => ({
    sections: [ExportSection.Manuscript],
    manuscriptOptions: {
      includeChapterTitles: true,
      fontScale: 1,
      lineHeight: 2,
      preset: 'standard_manuscript',
    },
    analysisOptions: {
      includeCharts: false,
      detailedBreakdown: false,
    },
  }), []);

  const handleExportPdf = useCallback(async () => {
    if (!currentProject) return;

    try {
      setIsExporting(true);
      setExportError(null);

      const data = createManuscriptExportData({
        title: currentProject.title,
        author: currentProject.author,
        chapters,
        includeTitles: true,
        pageBreakBetweenChapters: true,
      });

      await pdfExportService.generatePdf(data, {
        ...standardConfig,
        filename: `${safeBaseName}_manuscript.pdf`,
      });

      setIsExportOpen(false);
    } catch {
      setExportError('Failed to export PDF.');
    } finally {
      setIsExporting(false);
    }
  }, [chapters, currentProject, safeBaseName, standardConfig]);

  const handleExportDocx = useCallback(async () => {
    if (!currentProject) return;

    try {
      setIsExporting(true);
      setExportError(null);

      await exportStandardManuscriptDocx({
        title: currentProject.title,
        author: currentProject.author,
        chapters: toManuscriptExportChapters(chapters),
        filename: `${safeBaseName}_manuscript.docx`,
      });

      setIsExportOpen(false);
    } catch {
      setExportError('Failed to export Word document.');
    } finally {
      setIsExporting(false);
    }
  }, [chapters, currentProject, safeBaseName]);

  const shouldHide = isZenMode && !isHeaderHovered;

  return (
    <>
      {isExportOpen && (
        <div className="fixed inset-0 z-[80] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-xl bg-[var(--surface-primary)] border border-[var(--border-primary)] shadow-2xl p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-lg font-semibold text-[var(--text-primary)]">Export Manuscript</div>
                <div className="text-sm text-[var(--text-secondary)]">Choose a format</div>
              </div>
              <button
                type="button"
                onClick={() => setIsExportOpen(false)}
                className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
                aria-label="Close export dialog"
              >
                ×
              </button>
            </div>

            {exportError && (
              <div className="mt-4 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                {exportError}
              </div>
            )}

            <div className="mt-5 grid grid-cols-1 gap-3">
              <button
                type="button"
                onClick={() => void handleExportPdf()}
                disabled={!canExport}
                className="w-full px-4 py-3 rounded-lg bg-[var(--interactive-accent)] text-[var(--text-inverse)] font-semibold disabled:opacity-50"
              >
                {isExporting ? 'Exporting…' : 'PDF (For Submission)'}
              </button>
              <button
                type="button"
                onClick={() => void handleExportDocx()}
                disabled={!canExport}
                className="w-full px-4 py-3 rounded-lg bg-[var(--interactive-bg)] text-[var(--text-primary)] font-semibold border border-[var(--border-primary)] disabled:opacity-50"
              >
                {isExporting ? 'Exporting…' : 'Word (For Editing)'}
              </button>
            </div>
          </div>
        </div>
      )}

      <motion.header
        initial={false}
        animate={{
          y: shouldHide ? -60 : 0,
          opacity: shouldHide ? 0 : 1,
        }}
        transition={
          prefersReducedMotion
            ? { duration: 0 }
            : { type: 'spring', stiffness: 300, damping: 30 }
        }
        className="flex items-center justify-between px-6 py-2 bg-[var(--surface-primary)] border-b border-[var(--border-primary)] shrink-0"
        style={{
          position: isZenMode ? 'fixed' : 'relative',
          top: 0,
          left: isZenMode ? 0 : 'auto',
          right: isZenMode ? 0 : 'auto',
          zIndex: isZenMode ? 50 : 'auto',
        }}
        onMouseEnter={() => isZenMode && setHeaderHovered(true)}
        onMouseLeave={() => setHeaderHovered(false)}
        role="banner"
      >
        <div className="flex items-center gap-4">
          <UsageBadge />
          <VoiceCommandButton />
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              setExportError(null);
              setIsExportOpen(true);
            }}
            disabled={!currentProject || chapters.length === 0}
            className="px-4 py-2 rounded-lg bg-[var(--ink-900)] text-[var(--parchment-50)] text-sm font-semibold disabled:opacity-50"
          >
            Export Manuscript
          </button>
        </div>
      </motion.header>
    </>
  );
};
