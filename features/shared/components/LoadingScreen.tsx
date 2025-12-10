import React from 'react';
import { motion } from 'framer-motion';

interface LoadingScreenProps {
  message?: string;
  subMessage?: string;
  variant?: 'full' | 'inline';
}

/**
 * Unified loading screen with animated quill pen and contextual messaging.
 * Use variant="full" for full-screen loading, "inline" for contained areas.
 */
export const LoadingScreen: React.FC<LoadingScreenProps> = ({
  message = 'Preparing your writing space...',
  subMessage,
  variant = 'full',
}) => {
  const containerClass = variant === 'full' 
    ? 'h-screen w-full fixed inset-0 z-50' 
    : 'h-full w-full min-h-[200px]';

  return (
    <div className={`${containerClass} flex flex-col items-center justify-center bg-gradient-to-br from-[#1a1a2e] via-[#16213e] to-[#0f0f1a]`}>
      {/* Ambient glow */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-64 h-64 bg-indigo-500/20 rounded-full blur-3xl pointer-events-none" />
      
      {/* Animated Quill Icon */}
      <motion.div
        className="relative mb-6"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <motion.svg 
          width="64" 
          height="64" 
          viewBox="0 0 24 24" 
          fill="none" 
          stroke="currentColor" 
          strokeWidth="1.5"
          className="text-indigo-400"
          animate={{ 
            rotate: [0, -5, 5, -5, 0],
            y: [0, -2, 0, -2, 0],
          }}
          transition={{ 
            duration: 2,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        >
          {/* Quill/feather pen */}
          <path d="M20.24 12.24a6 6 0 0 0-8.49-8.49L5 10.5V19h8.5l6.74-6.76z" />
          <line x1="16" y1="8" x2="2" y2="22" />
          <line x1="17.5" y1="15" x2="9" y2="15" />
        </motion.svg>
        
        {/* Ink drops animation */}
        <motion.div
          className="absolute -bottom-2 left-1/2 w-1.5 h-1.5 bg-indigo-400 rounded-full"
          animate={{
            y: [0, 20, 20],
            opacity: [1, 1, 0],
            scale: [1, 0.8, 0.5],
          }}
          transition={{
            duration: 1.5,
            repeat: Infinity,
            ease: "easeIn",
            repeatDelay: 0.5,
          }}
        />
      </motion.div>

      {/* Message */}
      <motion.div 
        className="text-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
      >
        <h2 className="text-xl font-serif text-white mb-2">{message}</h2>
        {subMessage && (
          <p className="text-sm text-gray-400">{subMessage}</p>
        )}
      </motion.div>

      {/* Progress bar */}
      <motion.div 
        className="mt-8 w-48 h-1 bg-gray-700 rounded-full overflow-hidden"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
      >
        <motion.div
          className="h-full bg-gradient-to-r from-indigo-500 to-purple-500"
          initial={{ width: '0%' }}
          animate={{ width: '100%' }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      </motion.div>

      {/* Tips (optional, shows after delay) */}
      <motion.div
        className="absolute bottom-8 text-center text-xs text-gray-500 max-w-md px-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 2 }}
      >
        <p>💡 Tip: Use <kbd className="px-1.5 py-0.5 bg-gray-700 rounded text-gray-300">Ctrl+K</kbd> to open the command palette anytime</p>
      </motion.div>
    </div>
  );
};

export default LoadingScreen;
