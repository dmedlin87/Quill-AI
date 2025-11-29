import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AnalysisResult } from '@/types';
import { findQuoteRange } from '@/features/shared';

// Card animation variants
const cardVariants = {
  hidden: { opacity: 0, x: -20, scale: 0.95 },
  visible: (i: number) => ({
    opacity: 1,
    x: 0,
    scale: 1,
    transition: {
      delay: i * 0.08,
      type: 'spring',
      stiffness: 300,
      damping: 25
    }
  }),
  exit: { opacity: 0, x: 20, transition: { duration: 0.2 } }
};

const sectionVariants = {
  hidden: { opacity: 0 },
  visible: { 
    opacity: 1,
    transition: { staggerChildren: 0.08 }
  }
};

interface AnalysisPanelProps {
  analysis: AnalysisResult | null;
  isLoading: boolean;
  currentText: string;
  onNavigate: (start: number, end: number) => void;
  onFixRequest?: (issueContext: string, suggestion: string) => void;
  warning?: string | null;
}

export const AnalysisPanel: React.FC<AnalysisPanelProps> = ({ analysis, isLoading, currentText, onNavigate, onFixRequest, warning }) => {
  
  const handleQuoteClick = (quote?: string) => {
    if (!quote) return;
    const range = findQuoteRange(currentText, quote);
    if (range) onNavigate(range.start, range.end);
  };

  const handleFixClick = (e: React.MouseEvent, issue: { issue: string; suggestion: string; quote?: string; location?: string }) => {
    e.stopPropagation();
    if (onFixRequest) {
      const context = issue.quote 
        ? `"${issue.quote}"${issue.location ? ` (${issue.location})` : ''}` 
        : issue.location || 'Unknown location';
      onFixRequest(context, issue.suggestion);
    }
  };

  if (isLoading) {
    return (
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="flex flex-col items-center justify-center h-full p-8 text-center gap-4"
      >
         <motion.div 
           className="w-8 h-8 border-2 border-[var(--interactive-accent)] border-t-transparent rounded-full"
           animate={{ rotate: 360 }}
           transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
         />
         <motion.p 
           className="font-serif text-[var(--text-secondary)]"
           animate={{ opacity: [0.5, 1, 0.5] }}
           transition={{ duration: 2, repeat: Infinity }}
         >
           Consulting the muse...
         </motion.p>
      </motion.div>
    );
  }

  if (!analysis) {
    return (
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col items-center justify-center h-full p-8 text-center"
      >
        <p className="text-[var(--text-tertiary)] font-serif italic">Run an analysis to reveal insights.</p>
      </motion.div>
    );
  }

  return (
    <motion.div 
      initial="hidden"
      animate="visible"
      className="h-full overflow-y-auto p-5 space-y-6"
    >
      {warning && (
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-start gap-3 p-3 rounded-lg border border-[var(--warning-300)] bg-[var(--warning-50)] text-[var(--warning-800)]"
        >
          <div className="mt-0.5 text-[var(--warning-600)] font-bold">!</div>
          <div>
            <p className="text-[var(--text-sm)] font-semibold text-[var(--warning-800)]">Analysis Warning</p>
            <p className="text-[var(--text-xs)] leading-relaxed">{warning}</p>
          </div>
        </motion.div>
      )}
      
      {/* Score Card */}
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        className="bg-gradient-to-br from-[var(--interactive-bg-active)] to-[var(--surface-secondary)] rounded-[var(--radius-lg)] p-5 border border-[var(--glass-border)] shadow-sm"
      >
        <div className="flex justify-between items-start mb-3">
          <span className="text-[var(--text-sm)] font-semibold text-[var(--text-secondary)]">Pacing Score</span>
          <motion.span 
            className="text-[var(--text-2xl)] font-bold text-[var(--interactive-accent)] font-serif"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 400, damping: 15, delay: 0.2 }}
          >
            {analysis.pacing.score}
          </motion.span>
        </div>
        <div className="h-1.5 bg-[var(--surface-tertiary)] rounded-full overflow-hidden">
           <motion.div 
             className="h-full bg-gradient-to-r from-[var(--interactive-accent)] to-[var(--interactive-accent-hover)] rounded-full"
             initial={{ width: 0 }}
             animate={{ width: `${(analysis.pacing.score / 10) * 100}%` }}
             transition={{ duration: 0.8, ease: 'easeOut', delay: 0.3 }}
           />
        </div>
      </motion.div>

      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
      >
        <h4 className="text-[var(--text-sm)] font-semibold text-[var(--text-primary)] mb-3">Executive Summary</h4>
        <p className="text-[var(--text-sm)] text-[var(--text-secondary)] leading-relaxed font-serif">{analysis.summary}</p>
      </motion.section>

      {/* Issues List */}
      <motion.section
        variants={sectionVariants}
        initial="hidden"
        animate="visible"
      >
        <h4 className="text-[var(--text-sm)] font-semibold text-[var(--text-primary)] mb-3">Detected Issues</h4>
        <div className="space-y-3">
          <AnimatePresence>
            {analysis.plotIssues.map((issue, i) => (
               <motion.div 
                 key={`plot-${i}`}
                 custom={i}
                 variants={cardVariants}
                 initial="hidden"
                 animate="visible"
                 exit="exit"
                 onClick={() => handleQuoteClick(issue.quote)}
                 whileHover={{ x: 4, transition: { duration: 0.2 } }}
                 className="p-3 bg-[var(--error-100)] border-l-4 border-[var(--error-500)] rounded-r-md cursor-pointer"
               >
                  <h5 className="text-[var(--text-sm)] font-semibold text-[var(--error-500)] mb-1">{issue.issue}</h5>
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-[var(--text-xs)] text-[var(--text-secondary)]">{issue.suggestion}</p>
                    {onFixRequest && (
                      <motion.button
                        onClick={(e) => handleFixClick(e, issue)}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        className="shrink-0 px-2 py-1 bg-[var(--interactive-accent)] hover:bg-[var(--interactive-accent-hover)] text-[var(--text-inverse)] rounded text-[10px] font-medium transition-colors flex items-center gap-1"
                      >
                        ✨ Fix with Agent
                      </motion.button>
                    )}
                  </div>
               </motion.div>
            ))}
            {analysis.settingAnalysis?.issues.map((issue, i) => (
               <motion.div 
                 key={`setting-${i}`}
                 custom={i + analysis.plotIssues.length}
                 variants={cardVariants}
                 initial="hidden"
                 animate="visible"
                 exit="exit"
                 onClick={() => handleQuoteClick(issue.quote)}
                 whileHover={{ x: 4, transition: { duration: 0.2 } }}
                 className="p-3 bg-[var(--warning-100)] border-l-4 border-[var(--warning-500)] rounded-r-md cursor-pointer"
               >
                  <h5 className="text-[var(--text-sm)] font-semibold text-[var(--warning-500)] mb-1">{issue.issue}</h5>
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-[var(--text-xs)] text-[var(--text-secondary)]">{issue.suggestion}</p>
                    {onFixRequest && (
                      <motion.button
                        onClick={(e) => handleFixClick(e, issue)}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        className="shrink-0 px-2 py-1 bg-[var(--interactive-accent)] hover:bg-[var(--interactive-accent-hover)] text-[var(--text-inverse)] rounded text-[10px] font-medium transition-colors flex items-center gap-1"
                      >
                        ✨ Fix with Agent
                      </motion.button>
                    )}
                  </div>
               </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </motion.section>
    </motion.div>
  );
};
