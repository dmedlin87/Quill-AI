/**
 * CommentCard - Floating comment popup for Quill AI 3.0
 * 
 * Displays AI critique when clicking on highlighted text.
 * Uses viewport collision detection for smart positioning.
 */

import React, { useRef, useEffect, useState } from 'react';
import { CommentMarkAttributes } from '../extensions/CommentMark';

interface CommentCardProps {
  comment: CommentMarkAttributes & {
    quote?: string;
  };
  position: { top: number; left: number };
  onClose: () => void;
  onFixWithAgent: (issue: string, suggestion: string, quote?: string) => void;
  onDismiss: (commentId: string) => void;
}

interface ViewportPosition {
  top: number;
  left: number;
  placement: 'above' | 'below';
}

/**
 * Smart positioning with viewport collision detection
 */
function useViewportCollision(
  initialPos: { top: number; left: number },
  cardRef: React.RefObject<HTMLDivElement>
): ViewportPosition {
  const [position, setPosition] = useState<ViewportPosition>({
    ...initialPos,
    placement: 'below',
  });

  useEffect(() => {
    if (!cardRef.current) return;

    const updatePosition = () => {
      const card = cardRef.current;
      if (!card) return;

      const rect = card.getBoundingClientRect();
      const viewport = {
        width: window.innerWidth,
        height: window.innerHeight,
      };

      let newTop = initialPos.top;
      let newLeft = initialPos.left;
      let placement: 'above' | 'below' = 'below';

      // Vertical collision
      if (initialPos.top + rect.height > viewport.height - 20) {
        // Would overflow bottom, place above
        newTop = initialPos.top - rect.height - 30;
        placement = 'above';
      }

      // Horizontal collision
      if (initialPos.left + rect.width > viewport.width - 20) {
        newLeft = viewport.width - rect.width - 20;
      }
      if (newLeft < 20) {
        newLeft = 20;
      }

      setPosition({ top: newTop, left: newLeft, placement });
    };

    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, { passive: true });
    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition);
    };
  }, [initialPos, cardRef]);

  return position;
}

const severityConfig = {
  error: {
    bg: 'bg-red-50',
    border: 'border-red-200',
    badge: 'bg-red-100 text-red-700',
    icon: '⚠️',
    label: 'Critical Issue',
  },
  warning: {
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    badge: 'bg-amber-100 text-amber-700',
    icon: '💡',
    label: 'Suggestion',
  },
  info: {
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    badge: 'bg-blue-100 text-blue-700',
    icon: '📝',
    label: 'Note',
  },
};

const typeConfig = {
  plot: { icon: '🏛️', label: 'Plot' },
  setting: { icon: '🌍', label: 'Setting' },
  character: { icon: '👤', label: 'Character' },
  pacing: { icon: '⏱️', label: 'Pacing' },
  prose: { icon: '✍️', label: 'Prose' },
};

export const CommentCard: React.FC<CommentCardProps> = ({
  comment,
  position,
  onClose,
  onFixWithAgent,
  onDismiss,
}) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const adjustedPos = useViewportCollision(position, cardRef);
  const severity = severityConfig[comment.severity];
  const type = typeConfig[comment.type];

  // Close on escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (cardRef.current && !cardRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    // Delay to prevent immediate close from the click that opened it
    const timeout = setTimeout(() => {
      document.addEventListener('mousedown', handleClickOutside);
    }, 100);
    return () => {
      clearTimeout(timeout);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClose]);

  return (
    <div
      ref={cardRef}
      className={`
        fixed z-50 w-80 rounded-lg shadow-xl border
        ${severity.bg} ${severity.border}
        animate-in fade-in slide-in-from-bottom-2 duration-200
      `}
      style={{
        top: adjustedPos.top,
        left: adjustedPos.left,
      }}
    >
      {/* Arrow indicator */}
      <div
        className={`
          absolute w-3 h-3 rotate-45 ${severity.bg} ${severity.border}
          ${adjustedPos.placement === 'below' ? '-top-1.5 border-r-0 border-b-0' : '-bottom-1.5 border-l-0 border-t-0'}
        `}
        style={{ left: '50%', marginLeft: '-6px' }}
      />

      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-inherit">
        <div className="flex items-center gap-2">
          <span className={`text-xs font-medium px-2 py-0.5 rounded ${severity.badge}`}>
            {severity.icon} {severity.label}
          </span>
          <span className="text-xs text-gray-500 flex items-center gap-1">
            {type.icon} {type.label}
          </span>
        </div>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Content */}
      <div className="p-3 space-y-3">
        {/* Issue */}
        <div>
          <h4 className="text-sm font-semibold text-gray-800 mb-1">Issue</h4>
          <p className="text-sm text-gray-600">{comment.issue}</p>
        </div>

        {/* Quote if present */}
        {comment.quote && (
          <div>
            <h4 className="text-xs font-semibold text-gray-500 mb-1">Highlighted Text</h4>
            <blockquote className="text-xs text-gray-500 italic bg-white/50 px-2 py-1 rounded border-l-2 border-gray-300">
              "{comment.quote.length > 100 ? comment.quote.slice(0, 100) + '...' : comment.quote}"
            </blockquote>
          </div>
        )}

        {/* Suggestion */}
        <div>
          <h4 className="text-sm font-semibold text-gray-800 mb-1">Suggestion</h4>
          <p className="text-sm text-gray-600">{comment.suggestion}</p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 px-3 py-2 bg-white/50 border-t border-inherit rounded-b-lg">
        <button
          onClick={() => onFixWithAgent(comment.issue, comment.suggestion, comment.quote)}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded transition-colors"
        >
          <span>✨</span>
          Fix with Agent
        </button>
        <button
          onClick={() => onDismiss(comment.commentId)}
          className="px-3 py-1.5 text-gray-500 hover:text-gray-700 hover:bg-gray-100 text-sm font-medium rounded transition-colors"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
};

export default CommentCard;
