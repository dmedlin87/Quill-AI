/**
 * AIPresenceOrb
 * 
 * Visual indicator for AI agent state with animated presence effects.
 * Shows status through animations: idle (subtle glow), thinking (pulse), writing (shimmer).
 */

import React, { useMemo } from 'react';
import { motion, type Variants, type Easing, useReducedMotion } from 'framer-motion';
import { Persona } from '@/types/personas';

const EASE_IN_OUT: Easing = [0.42, 0, 0.58, 1];

/**
 * Orb status states:
 * - idle: No active processing
 * - thinking: Agent is processing a user request
 * - writing: Agent is generating text
 * - processing: Background proactive thinking is active
 * - dreaming: Background consolidation/maintenance mode
 */
export type OrbStatus = 'idle' | 'thinking' | 'writing' | 'processing' | 'dreaming';

export interface AIPresenceOrbProps {
  status: OrbStatus;
  persona: Persona;
  analysisReady: boolean;
  onClick?: () => void;
  isActive?: boolean;
  /** Number of pending proactive suggestions */
  pendingSuggestions?: number;
}

export const AIPresenceOrb: React.FC<AIPresenceOrbProps> = ({
  status,
  persona,
  analysisReady,
  onClick,
  isActive = false,
  pendingSuggestions = 0,
}) => {
  const baseColor = persona.color;
  const prefersReducedMotion = useReducedMotion();

  const {
    orbVariants,
    glowVariants,
    shimmerVariants,
    badgeVariants,
    sleepIndicatorVariants,
  } = useMemo(() => {
    const repeat = prefersReducedMotion ? 0 : Infinity;

    // Animation variants for different states
    const computedOrbVariants: Variants = {
      idle: {
        scale: 1,
        opacity: 1,
      },
      thinking: prefersReducedMotion
        ? { scale: 1, opacity: 1 }
        : {
            scale: [1, 1.1, 1],
            opacity: [0.8, 1, 0.8],
            transition: {
              duration: 1.5,
              repeat,
              ease: EASE_IN_OUT,
            },
          },
      writing: {
        scale: 1,
        opacity: 1,
      },
      processing: prefersReducedMotion
        ? { scale: 1, opacity: 0.9 }
        : {
            scale: [1, 1.03, 1],
            opacity: [0.85, 0.95, 0.85],
            transition: {
              duration: 2.5,
              repeat,
              ease: EASE_IN_OUT,
            },
          },
      dreaming: prefersReducedMotion
        ? { scale: 1, opacity: 0.85 }
        : {
            scale: [1, 1.05, 1],
            opacity: [0.7, 0.9, 0.7],
            transition: {
              duration: 3.5,
              repeat,
              ease: EASE_IN_OUT,
            },
          },
    };

    // Glow animation for the outer ring
    const computedGlowVariants: Variants = {
      idle: {
        opacity: 0.3,
        scale: 1,
      },
      thinking: prefersReducedMotion
        ? { opacity: 0.4, scale: 1 }
        : {
            opacity: [0.3, 0.6, 0.3],
            scale: [1, 1.15, 1],
            transition: {
              duration: 1.5,
              repeat,
              ease: EASE_IN_OUT,
            },
          },
      writing: prefersReducedMotion
        ? { opacity: 0.6, scale: 1 }
        : {
            opacity: [0.4, 0.8, 0.4],
            scale: [1, 1.1, 1],
            transition: {
              duration: 0.8,
              repeat,
              ease: EASE_IN_OUT,
            },
          },
      processing: prefersReducedMotion
        ? { opacity: 0.35, scale: 1 }
        : {
            opacity: [0.25, 0.4, 0.25],
            scale: [1, 1.08, 1],
            transition: {
              duration: 3,
              repeat,
              ease: EASE_IN_OUT,
            },
          },
      dreaming: prefersReducedMotion
        ? { opacity: 0.3, scale: 1 }
        : {
            opacity: [0.2, 0.35, 0.2],
            scale: [1, 1.06, 1],
            transition: {
              duration: 3.5,
              repeat,
              ease: EASE_IN_OUT,
            },
          },
    };

    // Shimmer effect for writing state
    const computedShimmerVariants: Variants = {
      idle: { opacity: 0, rotate: 0 },
      thinking: { opacity: 0, rotate: 0 },
      writing: prefersReducedMotion
        ? { opacity: 0, rotate: 0 }
        : {
            opacity: [0, 0.6, 0],
            rotate: [0, 180, 360],
            transition: {
              duration: 2,
              repeat,
              ease: 'linear' as Easing,
            },
          },
      processing: prefersReducedMotion
        ? { opacity: 0, rotate: 0 }
        : {
            opacity: [0, 0.3, 0],
            rotate: [0, 360],
            transition: {
              duration: 4,
              repeat,
              ease: 'linear' as Easing,
            },
          },
      dreaming: { opacity: 0, rotate: 0 },
    };

    // Analysis ready badge animation
    const computedBadgeVariants: Variants = {
      hidden: { scale: 0, opacity: 0 },
      visible: {
        scale: 1,
        opacity: 1,
        transition: prefersReducedMotion
          ? undefined
          : {
              type: 'spring' as const,
              stiffness: 500,
              damping: 25,
            },
      },
    };

    const computedSleepIndicatorVariants: Variants = {
      idle: { opacity: 0, scale: 0.8, y: 6 },
      thinking: { opacity: 0, scale: 0.8, y: 6 },
      writing: { opacity: 0, scale: 0.8, y: 6 },
      processing: { opacity: 0, scale: 0.8, y: 6 },
      dreaming: prefersReducedMotion
        ? { opacity: 0.6, scale: 1, y: 0 }
        : {
            opacity: [0.15, 0.55, 0.15],
            scale: [0.95, 1.05, 0.95],
            y: [6, 0, 6],
            transition: { duration: 3, repeat, ease: EASE_IN_OUT },
          },
    };

    return {
      orbVariants: computedOrbVariants,
      glowVariants: computedGlowVariants,
      shimmerVariants: computedShimmerVariants,
      badgeVariants: computedBadgeVariants,
      sleepIndicatorVariants: computedSleepIndicatorVariants,
    };
  }, [prefersReducedMotion]);

  return (
    <motion.button
      type="button"
      onClick={onClick}
      className="relative w-10 h-10 rounded-lg flex items-center justify-center transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-transparent"
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.95 }}
      title="Agent"
      aria-label={`Agent ${persona.name} is ${status}`}
    >
      {/* Outer glow ring */}
      <motion.div
        className="absolute inset-0 rounded-full"
        style={{
          background: `radial-gradient(circle, ${baseColor}40 0%, transparent 70%)`,
        }}
        variants={glowVariants}
        animate={status}
      />

      {/* Shimmer effect (writing state) */}
      <motion.div
        className="absolute inset-0 rounded-full"
        style={{
          background: `conic-gradient(from 0deg, transparent, ${baseColor}60, transparent, ${baseColor}60, transparent)`,
        }}
        variants={shimmerVariants}
        animate={status}
      />

      {/* Main orb */}
      <motion.div
        className="relative w-6 h-6 rounded-full flex items-center justify-center shadow-lg"
        style={{
          background: `linear-gradient(135deg, ${baseColor} 0%, ${adjustBrightness(baseColor, -30)} 100%)`,
          boxShadow: `0 0 12px ${baseColor}50, inset 0 1px 2px rgba(255,255,255,0.3)`,
        }}
        variants={orbVariants}
        animate={status}
      >
        {/* Inner highlight */}
        <div
          className="absolute top-1 left-1 w-2 h-2 rounded-full opacity-60"
          style={{
            background: `linear-gradient(135deg, rgba(255,255,255,0.8) 0%, transparent 100%)`,
          }}
        />

        {/* Persona icon */}
        <span className="text-xs select-none" style={{ filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.3))' }}>
          {persona.icon}
        </span>
      </motion.div>

      {/* Dreaming indicator */}
      <motion.div
        className="absolute -top-3 left-1/2 -translate-x-1/2 text-[10px] font-semibold text-[var(--text-primary)]"
        variants={sleepIndicatorVariants}
        animate={status}
        aria-hidden
      >
        zZz
      </motion.div>

      {/* Active indicator */}
      {isActive && (
        <div
          className="absolute right-[-13px] top-1/2 -translate-y-1/2 w-1 h-5 rounded-l-sm"
          style={{ backgroundColor: baseColor }}
        />
      )}

      {/* Analysis ready badge */}
      <motion.div
        className="absolute -top-1 -right-1 w-3 h-3 rounded-full flex items-center justify-center"
        style={{
          background: '#10b981', // Emerald green
          boxShadow: '0 0 6px rgba(16, 185, 129, 0.6)',
        }}
        variants={badgeVariants}
        initial="hidden"
        animate={analysisReady ? 'visible' : 'hidden'}
      >
        <svg
          width="8"
          height="8"
          viewBox="0 0 12 12"
          fill="none"
          stroke="white"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="2 6 5 9 10 3" />
        </svg>
      </motion.div>

      {/* Status indicator dot */}
      <motion.div
        className="absolute -bottom-0.5 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full"
        style={{
          backgroundColor: getStatusColor(status),
          boxShadow: status !== 'idle' ? `0 0 4px ${getStatusColor(status)}` : 'none',
        }}
        animate={
          prefersReducedMotion
            ? { opacity: status === 'idle' ? 0.6 : 1, scale: 1 }
            : { opacity: status === 'idle' ? 0.6 : [0.6, 1, 0.6], scale: status === 'idle' ? 1 : [1, 1.2, 1] }
        }
        transition={{
          duration: status === 'processing' ? 2 : 1,
          repeat: status === 'idle' || prefersReducedMotion ? 0 : Infinity,
          ease: 'easeInOut',
        }}
      />

      {/* Pending suggestions badge */}
      {pendingSuggestions > 0 && (
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          className="absolute -top-1 -left-1 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold text-white"
          style={{
            background: '#8b5cf6', // Purple for suggestions
            boxShadow: '0 0 6px rgba(139, 92, 246, 0.6)',
          }}
        >
          {pendingSuggestions > 9 ? '9+' : pendingSuggestions}
        </motion.div>
      )}
    </motion.button>
  );
};

/**
 * Get the status indicator color based on orb status
 */
function getStatusColor(status: OrbStatus): string {
  switch (status) {
    case 'idle':
      return '#6b7280'; // Gray
    case 'thinking':
      return '#f59e0b'; // Amber
    case 'writing':
      return '#10b981'; // Emerald
    case 'processing':
      return '#8b5cf6'; // Purple - indicates background processing
    case 'dreaming':
      return '#60a5fa'; // Soft blue for maintenance
    default:
      return '#6b7280';
  }
}

/**
 * Adjust the brightness of a hex color
 */
function adjustBrightness(hex: string, amount: number): string {
  // Remove # if present
  const color = hex.replace('#', '');
  
  // Parse RGB
  const r = Math.max(0, Math.min(255, parseInt(color.slice(0, 2), 16) + amount));
  const g = Math.max(0, Math.min(255, parseInt(color.slice(2, 4), 16) + amount));
  const b = Math.max(0, Math.min(255, parseInt(color.slice(4, 6), 16) + amount));
  
  // Convert back to hex
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}

export default AIPresenceOrb;
