/**
 * Proactive Suggestions Component
 * 
 * Displays memory-based suggestions when navigating to chapters
 * with watched entities, related memories, or active goals.
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ProactiveSuggestion } from '@/services/memory/proactive';
import { eventBus } from '@/services/appBrain';
import { SuggestionCategory } from '@/types/experienceSettings';

interface ProactiveSuggestionsProps {
  suggestions: ProactiveSuggestion[];
  onDismiss: (id: string) => void;
  onDismissAll: () => void;
  onAction?: (suggestion: ProactiveSuggestion) => void;
  /** Called when user applies a suggestion (positive feedback) */
  onApply?: (suggestion: ProactiveSuggestion) => void;
  /** Whether the proactive thinker is currently active */
  isThinking?: boolean;
}

const suggestionVariants = {
  hidden: { opacity: 0, x: 20, scale: 0.95 },
  visible: { 
    opacity: 1, 
    x: 0, 
    scale: 1,
    transition: { type: 'spring' as const, stiffness: 400, damping: 30 }
  },
  exit: { opacity: 0, x: -20, scale: 0.95, transition: { duration: 0.15 } }
};

function getSuggestionCategory(suggestion: ProactiveSuggestion): SuggestionCategory {
  if (suggestion.type === 'related_memory') {
    const tags = suggestion.tags || [];
    if (tags.includes('plot')) return 'plot';
    if (tags.includes('character')) return 'character';
    if (tags.includes('pacing')) return 'pacing';
    if (tags.includes('style')) return 'style';
    if (tags.includes('continuity')) return 'continuity';
    return 'other';
  }
  return suggestion.type as SuggestionCategory;
}

const typeIcons: Record<ProactiveSuggestion['type'], string> = {
  watched_entity: '👁️',
  related_memory: '💭',
  active_goal: '🎯',
  reminder: '⚡',
  lore_discovery: '📖',
  timeline_conflict: '⏳',
  voice_inconsistency: '🎙️',
  plot: '📝',
  character: '👤',
  pacing: '⏱️',
  style: '🎨',
  continuity: '🔄',
};

const priorityColors: Record<ProactiveSuggestion['priority'], string> = {
  high: 'border-red-200 bg-red-50',
  medium: 'border-amber-200 bg-amber-50',
  low: 'border-blue-200 bg-blue-50',
};

const priorityDots: Record<ProactiveSuggestion['priority'], string> = {
  high: 'bg-red-500',
  medium: 'bg-amber-500',
  low: 'bg-blue-500',
};

// Define specific metadata interfaces
interface VoiceInconsistencyMetadata {
  speaker: string;
  historicImpression: string;
  currentImpression: string;
  diffs: Array<{ label: string; current: number; historic: number }>;
}

interface TimelineConflictMetadata {
  previousMarker: string;
  currentMarker: string;
}

// Type guard helpers
function isVoiceInconsistencyMetadata(metadata: Record<string, unknown> | undefined): metadata is Record<string, unknown> & VoiceInconsistencyMetadata {
  return metadata !== undefined && 'speaker' in metadata && 'historicImpression' in metadata;
}

function isTimelineConflictMetadata(metadata: Record<string, unknown> | undefined): metadata is Record<string, unknown> & TimelineConflictMetadata {
  return metadata !== undefined && 'previousMarker' in metadata && 'currentMarker' in metadata;
}

export const ProactiveSuggestions: React.FC<ProactiveSuggestionsProps> = ({
  suggestions,
  onDismiss,
  onDismissAll,
  onAction,
  onApply,
  isThinking = false,
}) => {
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  if (suggestions.length === 0) return null;

  const handleFeedback = (suggestion: ProactiveSuggestion, action: 'applied' | 'dismissed' | 'muted') => {
    eventBus.emit({
      type: 'PROACTIVE_SUGGESTION_ACTION',
      payload: {
        suggestionId: suggestion.id,
        action,
        suggestionCategory: getSuggestionCategory(suggestion),
      },
    });

    if (action === 'applied' && onApply) {
      onApply(suggestion);
    } else if (action === 'dismissed' || action === 'muted') {
      onDismiss(suggestion.id);
    }
    setActiveMenuId(null);
  };

  return (
    <div className="p-3 space-y-2">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-indigo-600">{isThinking ? '🧠' : '✨'}</span>
          <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
            {isThinking ? 'Thinking...' : 'Suggestions'}
          </span>
          {suggestions.length > 0 && (
            <span className="text-[10px] bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded-full">
              {suggestions.length}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={onDismissAll}
          className="text-[10px] text-gray-400 hover:text-gray-600 transition-colors"
          aria-label={`Dismiss all ${suggestions.length} suggestions`}
        >
          Dismiss all
        </button>
      </div>

      {/* Suggestions List */}
      <AnimatePresence mode="popLayout">
        {suggestions.map((suggestion) => (
          <motion.div
            key={suggestion.id}
            variants={suggestionVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            layout
            className={`relative p-3 rounded-lg border ${priorityColors[suggestion.priority]} shadow-sm ${
              suggestion.type === 'lore_discovery'
                ? 'ring-1 ring-indigo-100'
                : suggestion.type === 'timeline_conflict'
                  ? 'ring-1 ring-rose-100'
                  : ''
            }`}
          >
            {/* Options Menu (Top Right) */}
            <div className="absolute top-2 right-2 flex items-center gap-1">
               <div className={`w-2 h-2 rounded-full ${priorityDots[suggestion.priority]}`} />
               <button
                 onClick={() => setActiveMenuId(activeMenuId === suggestion.id ? null : suggestion.id)}
                 className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-black/5"
               >
                 ⋮
               </button>

               {activeMenuId === suggestion.id && (
                 <div className="absolute right-0 top-6 bg-white shadow-lg rounded-lg border border-gray-100 py-1 w-32 z-10 text-xs">
                   <button
                     className="w-full text-left px-3 py-2 hover:bg-gray-50 text-gray-700"
                     onClick={() => handleFeedback(suggestion, 'dismissed')}
                   >
                     Dismiss
                   </button>
                   <button
                     className="w-full text-left px-3 py-2 hover:bg-gray-50 text-gray-700"
                     onClick={() => handleFeedback(suggestion, 'muted')}
                   >
                     Don't show this again
                   </button>
                 </div>
               )}
            </div>
            
            {/* Content */}
            <div className="pr-6">
              {/* Type Icon & Title */}
              <div className="flex items-start gap-2 mb-1">
                <span className="text-sm">{typeIcons[suggestion.type]}</span>
                <span className="text-sm font-medium text-gray-800 leading-tight">
                  {suggestion.title}
                </span>
                {suggestion.type === 'lore_discovery' && (
                  <span className="ml-1 inline-flex items-center rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-semibold text-indigo-700">
                    Lore
                  </span>
                )}
                {suggestion.type === 'timeline_conflict' && (
                  <span className="ml-1 inline-flex items-center rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-semibold text-rose-700">
                    Timeline
                  </span>
                )}
              </div>

              {/* Description */}
              <p className="text-xs text-gray-600 ml-6 leading-relaxed">
                {suggestion.description}
              </p>

              {suggestion.type === 'voice_inconsistency' && isVoiceInconsistencyMetadata(suggestion.metadata) && (
                <div className="mt-2 ml-6 rounded-md border border-indigo-100 bg-indigo-50/60 px-2 py-1.5 text-[11px] text-indigo-900">
                  <div className="font-semibold flex items-center gap-1 text-indigo-700">
                    <span>🗣️</span>
                    <span>Voice consistency</span>
                  </div>
                  <div className="mt-1 flex flex-col gap-0.5">
                    <span>
                      Speaker: <strong>{suggestion.metadata.speaker ?? 'Unknown'}</strong>
                    </span>
                    <span>
                      Historic tone: <strong>{suggestion.metadata.historicImpression ?? '—'}</strong>
                    </span>
                    <span>
                      Current tone: <strong>{suggestion.metadata.currentImpression ?? '—'}</strong>
                    </span>
                  </div>
                  {Array.isArray(suggestion.metadata.diffs) && (
                    <ul className="mt-1 list-disc list-inside space-y-0.5 text-indigo-800">
                      {suggestion.metadata.diffs.slice(0, 3).map((diff, index) => (
                        <li key={`${suggestion.id}-diff-${index}`}>
                          {diff.label}: {diff.current.toFixed(2)} vs {diff.historic.toFixed(2)}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {suggestion.type === 'timeline_conflict' && isTimelineConflictMetadata(suggestion.metadata) && (
                <div className="mt-2 ml-6 rounded-md border border-rose-100 bg-rose-50/60 px-2 py-1.5 text-[11px] text-rose-800">
                  <div className="font-semibold flex items-center gap-1 text-rose-700">
                    <span>⏱️</span>
                    <span>Continuity check</span>
                  </div>
                  <div className="mt-1 flex flex-col gap-0.5">
                    <span>
                      Previous: <strong>{suggestion.metadata.previousMarker ?? '—'}</strong>
                    </span>
                    <span>
                      Current: <strong>{suggestion.metadata.currentMarker ?? '—'}</strong>
                    </span>
                  </div>
                </div>
              )}
              
              {/* Tags */}
              {suggestion.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2 ml-6">
                  {suggestion.tags.slice(0, 3).map((tag) => (
                    <span
                      key={tag}
                      className="text-[10px] bg-white/60 text-gray-500 px-1.5 py-0.5 rounded"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
              
              {/* Actions */}
              <div className="flex items-center gap-3 mt-2 ml-6">
                {onApply && (
                  <button
                    type="button"
                    onClick={() => handleFeedback(suggestion, 'applied')}
                    className="text-[10px] text-emerald-600 hover:text-emerald-800 font-medium transition-colors"
                    aria-label={`Apply suggestion: ${suggestion.title}`}
                  >
                    {suggestion.type === 'lore_discovery' ? 'Create entry' : '✓ Apply'}
                  </button>
                )}
                {onAction && suggestion.suggestedAction && (
                  <button
                    type="button"
                    onClick={() => onAction(suggestion)}
                    className="text-[10px] text-indigo-600 hover:text-indigo-800 font-medium transition-colors"
                    aria-label={`Take action on suggestion: ${suggestion.title}`}
                  >
                    {suggestion.type === 'voice_inconsistency' ? 'Rephrase' : 'Details →'}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => handleFeedback(suggestion, 'dismissed')}
                  className="text-[10px] text-gray-400 hover:text-gray-600 transition-colors"
                  aria-label={`Dismiss suggestion: ${suggestion.title}`}
                >
                  Dismiss
                </button>
              </div>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
};

/**
 * Compact version for embedding in other panels
 */
export const ProactiveSuggestionsBadge: React.FC<{
  count: number;
  onClick: () => void;
}> = ({ count, onClick }) => {
  if (count === 0) return null;

  return (
    <motion.button
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      exit={{ scale: 0 }}
      onClick={onClick}
      className="flex items-center gap-1.5 px-2 py-1 bg-indigo-100 text-indigo-700 rounded-full text-xs font-medium hover:bg-indigo-200 transition-colors"
    >
      <span>✨</span>
      <span>{count} suggestion{count !== 1 ? 's' : ''}</span>
    </motion.button>
  );
};

export default ProactiveSuggestions;
