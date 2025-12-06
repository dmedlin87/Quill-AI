import React, { useState, useRef, useEffect, useId } from 'react';

type TooltipPosition = 'top' | 'bottom' | 'left' | 'right';

interface AccessibleTooltipProps {
  /** The content to display in the tooltip */
  content: React.ReactNode;
  /** The trigger element */
  children: React.ReactNode;
  /** Position preference (will flip if near boundary) */
  position?: TooltipPosition;
  /** Delay before showing (ms) */
  showDelay?: number;
  /** Additional className for the tooltip container */
  className?: string;
}

/**
 * AccessibleTooltip - A keyboard and screen reader accessible tooltip.
 * 
 * Features:
 * - Shows on hover AND focus (keyboard accessible)
 * - Uses aria-describedby for screen readers
 * - Boundary detection to prevent off-screen overflow
 * - Escape key to dismiss
 */
export const AccessibleTooltip: React.FC<AccessibleTooltipProps> = ({
  content,
  children,
  position = 'bottom',
  showDelay = 200,
  className = '',
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [actualPosition, setActualPosition] = useState(position);
  const tooltipId = useId();
  const triggerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();

  // Check boundaries and adjust position
  useEffect(() => {
    if (!isVisible || !tooltipRef.current || !triggerRef.current) return;

    const tooltip = tooltipRef.current;
    const trigger = triggerRef.current;
    const tooltipRect = tooltip.getBoundingClientRect();
    const triggerRect = trigger.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let newPosition = position;

    // Check if tooltip would overflow and flip if needed
    if (position === 'bottom' && triggerRect.bottom + tooltipRect.height > viewportHeight) {
      newPosition = 'top';
    } else if (position === 'top' && triggerRect.top - tooltipRect.height < 0) {
      newPosition = 'bottom';
    } else if (position === 'right' && triggerRect.right + tooltipRect.width > viewportWidth) {
      newPosition = 'left';
    } else if (position === 'left' && triggerRect.left - tooltipRect.width < 0) {
      newPosition = 'right';
    }

    if (newPosition !== actualPosition) {
      setActualPosition(newPosition);
    }
  }, [isVisible, position, actualPosition]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isVisible) {
        setIsVisible(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isVisible]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const show = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => setIsVisible(true), showDelay);
  };

  const hide = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setIsVisible(false);
  };

  const positionClasses: Record<TooltipPosition, string> = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  };

  const arrowClasses: Record<TooltipPosition, string> = {
    top: 'top-full left-1/2 -translate-x-1/2 border-t-[var(--ink-900)] border-x-transparent border-b-transparent',
    bottom: 'bottom-full left-1/2 -translate-x-1/2 border-b-[var(--ink-900)] border-x-transparent border-t-transparent',
    left: 'left-full top-1/2 -translate-y-1/2 border-l-[var(--ink-900)] border-y-transparent border-r-transparent',
    right: 'right-full top-1/2 -translate-y-1/2 border-r-[var(--ink-900)] border-y-transparent border-l-transparent',
  };

  return (
    <div
      ref={triggerRef}
      className={`relative inline-flex ${className}`}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
    >
      {/* Trigger with aria-describedby */}
      <div aria-describedby={isVisible ? tooltipId : undefined}>
        {children}
      </div>

      {/* Tooltip */}
      {isVisible && (
        <div
          ref={tooltipRef}
          id={tooltipId}
          role="tooltip"
          className={`absolute ${positionClasses[actualPosition]} z-50 animate-fade-in`}
        >
          <div className="bg-[var(--ink-900)] text-[var(--parchment-50)] p-3 rounded-lg shadow-xl text-[11px] min-w-[180px] max-w-[280px]">
            {content}
          </div>
          {/* Arrow */}
          <div className={`absolute border-4 ${arrowClasses[actualPosition]}`} />
        </div>
      )}
    </div>
  );
};
