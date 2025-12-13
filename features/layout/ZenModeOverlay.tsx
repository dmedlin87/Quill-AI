import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ExitIcon } from '@/features/shared/components/Icons';
import { useLayoutStore } from './store/useLayoutStore';
import { useFocusStore } from './store/useFocusStore';
import { FocusHUD } from './components/FocusHUD';
import { FocusSetupModal } from './components/FocusSetupModal';

interface ZenModeOverlayProps {
  isZenMode: boolean;
  toggleZenMode: () => void;
}

const FocusIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2" />
    <path d="M12 20v2" />
    <path d="m4.93 4.93 1.41 1.41" />
    <path d="m17.66 17.66 1.41 1.41" />
    <path d="M2 12h2" />
    <path d="M20 12h2" />
    <path d="m6.34 17.66-1.41 1.41" />
    <path d="m19.07 4.93-1.41 1.41" />
  </svg>
);

/**
 * ZenModeOverlay handles the floating exit button, focus tools, and header hover zone.
 */
export const ZenModeOverlay: React.FC<ZenModeOverlayProps> = ({
  isZenMode,
  toggleZenMode,
}) => {
  const { isExitZenHovered, setExitZenHovered, setHeaderHovered } = useLayoutStore((state) => ({
    isExitZenHovered: state.isExitZenHovered,
    setExitZenHovered: state.setExitZenHovered,
    setHeaderHovered: state.setHeaderHovered,
  }));

  const { isSessionActive, endSession } = useFocusStore();
  const [showSetup, setShowSetup] = useState(false);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        toggleZenMode();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [toggleZenMode]);

  // Clean up session if Zen Mode is exited manually (optional, maybe we want it to persist?)
  // For now, let's pause or hide it. The store keeps state, so re-entering Zen Mode resumes HUD.

  if (!isZenMode) return null;

  return (
    <>
      {/* Invisible hover zone at top for header reveal */}
      <div
        className="fixed top-0 left-0 right-0 h-12 z-40"
        onMouseEnter={() => setHeaderHovered(true)}
        onFocus={() => setHeaderHovered(true)}
        tabIndex={-1}
        aria-hidden="true"
      />

      {/* Focus HUD (Always visible if active) */}
      <FocusHUD />

      {/* Modal */}
      {showSetup && <FocusSetupModal onClose={() => setShowSetup(false)} />}

      {/* Floating Controls (Bottom Right) */}
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0, scale: 0.8, y: 20 }}
          animate={{
            opacity: isExitZenHovered ? 1 : 0.3,
            scale: isExitZenHovered ? 1 : 0.9,
            y: 0,
          }}
          exit={{ opacity: 0, scale: 0.8, y: 20 }}
          transition={{ type: 'spring', stiffness: 400, damping: 25 }}
          className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3"
          onMouseEnter={() => setExitZenHovered(true)}
          onMouseLeave={() => setExitZenHovered(false)}
        >
          {/* Start/Stop Focus Session Button */}
          {isExitZenHovered && (
             <motion.button
               initial={{ opacity: 0, x: 20 }}
               animate={{ opacity: 1, x: 0 }}
               onClick={() => isSessionActive ? endSession() : setShowSetup(true)}
               className={`flex items-center gap-2 px-4 py-2 rounded-full border shadow-lg transition-all duration-200 focus:outline-none ${
                 isSessionActive
                   ? 'bg-red-500/10 border-red-500/20 text-red-500 hover:bg-red-500/20'
                   : 'bg-[var(--surface-primary)] border-[var(--border-primary)] text-[var(--text-secondary)] hover:bg-[var(--surface-secondary)]'
               }`}
               aria-label={isSessionActive ? "End Focus Session" : "Start Focus Session"}
             >
               <FocusIcon />
               <span className="text-[var(--text-sm)] font-medium">
                 {isSessionActive ? "End Session" : "Focus Mode"}
               </span>
             </motion.button>
          )}

          {/* Exit Zen Button */}
          <button
            onClick={toggleZenMode}
            onFocus={() => setExitZenHovered(true)}
            onBlur={() => setExitZenHovered(false)}
            className="flex items-center gap-2 px-4 py-2 rounded-full bg-[var(--surface-primary)] border border-[var(--border-primary)] shadow-lg hover:shadow-xl transition-all duration-200 hover:bg-[var(--surface-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--interactive-accent)] focus:ring-offset-2"
            aria-label="Exit Zen Mode (Escape)"
          >
            <ExitIcon />
            <span className="text-[var(--text-sm)] font-medium text-[var(--text-secondary)]">
              Exit Zen
            </span>
          </button>
        </motion.div>
      </AnimatePresence>
    </>
  );
};
