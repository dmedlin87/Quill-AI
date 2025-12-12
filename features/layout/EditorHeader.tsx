import React, { useState } from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { UsageBadge } from '@/features/shared';
import { useLayoutStore } from './store/useLayoutStore';
import { VoiceCommandButton } from '@/features/voice';
import { useProjectStore } from '@/features/project/store/useProjectStore';
import { ExportModal } from '@/features/export/components/ExportModal';

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

  const shouldHide = isZenMode && !isHeaderHovered;

  return (
    <>
      <ExportModal isOpen={isExportOpen} onClose={() => setIsExportOpen(false)} />

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
            onClick={() => setIsExportOpen(true)}
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
