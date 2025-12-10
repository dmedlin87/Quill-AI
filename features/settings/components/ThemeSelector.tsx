import React from 'react';
import { motion } from 'framer-motion';
import { useLayoutStore } from '@/features/layout/store/useLayoutStore';
import { shallow } from 'zustand/shallow';
import { Card } from '@/features/shared/components/ui/Card';
import { Text, Heading } from '@/features/shared/components/ui/Typography';
import { Button } from '@/features/shared/components/ui/Button';

// Theme Preview Colors
const THEME_PREVIEWS = {
  parchment: { bg: '#fdfcfa', accent: '#c9a227', border: '#e8e6e3' },
  modern: { bg: '#ffffff', accent: '#6366f1', border: '#e2e8f0' },
  classic: { bg: '#fffef5', accent: '#d97706', border: '#fde68a' },
};

export const ThemeSelector: React.FC = () => {
  const { theme, visualTheme, toggleTheme, setVisualTheme } = useLayoutStore(
    (state) => ({
      theme: state.theme,
      visualTheme: state.visualTheme,
      toggleTheme: state.toggleTheme,
      setVisualTheme: state.setVisualTheme,
    }),
    shallow
  );

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <Text variant="label">Appearance</Text>
        
        {/* Mode Toggle (Light/Dark) */}
        <Card 
          variant="flat" 
          padding="sm" 
          className="flex items-center justify-between cursor-pointer hover:bg-[var(--interactive-bg-hover)] transition-colors group"
          onClick={toggleTheme}
        >
          <div className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${theme === 'dark' ? 'bg-indigo-900/30 text-indigo-400' : 'bg-amber-100 text-amber-600'}`}>
              {theme === 'dark' ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"></path></svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"></circle><line x1="12" y1="1" x2="12" y2="3"></line><line x1="12" y1="21" x2="12" y2="23"></line><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"></line><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"></line><line x1="1" y1="12" x2="3" y2="12"></line><line x1="21" y1="12" x2="23" y2="12"></line><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"></line><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"></line></svg>
              )}
            </div>
            <div className="text-left">
              <Text variant="body" className="font-medium">
                {theme === 'dark' ? 'Dark Mode' : 'Light Mode'}
              </Text>
              <Text variant="muted">
                {theme === 'dark' ? 'Easy on the eyes' : 'Classic bright look'}
              </Text>
            </div>
          </div>
          <div className={`w-10 h-5 rounded-full relative transition-colors ${theme === 'dark' ? 'bg-[var(--interactive-accent)]' : 'bg-[var(--ink-200)]'}`}>
            <motion.div 
              className="absolute top-1 left-1 w-3 h-3 rounded-full bg-white shadow-sm"
              animate={{ x: theme === 'dark' ? 20 : 0 }}
              transition={{ type: "spring", stiffness: 500, damping: 30 }}
            />
          </div>
        </Card>
      </div>

      <div className="space-y-3">
        <Text variant="label">Theme</Text>
        
        <div className="grid grid-cols-1 gap-2">
          {/* Parchment Theme */}
          <ThemeOption
            id="parchment"
            label="Parchment"
            description="Warm, serif-focused, writerly"
            isActive={visualTheme === 'parchment'}
            onClick={() => setVisualTheme('parchment')}
            preview={THEME_PREVIEWS.parchment}
          />

          {/* Modern Theme */}
          <ThemeOption
            id="modern"
            label="Modern"
            description="Cool gray, clean sans-serif"
            isActive={visualTheme === 'modern'}
            onClick={() => setVisualTheme('modern')}
            preview={THEME_PREVIEWS.modern}
          />

          {/* Classic Theme */}
          <ThemeOption
            id="classic"
            label="Classic"
            description="High contrast amber, skeuomorphic"
            isActive={visualTheme === 'classic'}
            onClick={() => setVisualTheme('classic')}
            preview={THEME_PREVIEWS.classic}
          />
        </div>
      </div>
    </div>
  );
};

interface ThemeOptionProps {
  id: string;
  label: string;
  description: string;
  isActive: boolean;
  onClick: () => void;
  preview: { bg: string; accent: string; border: string };
}

const ThemeOption: React.FC<ThemeOptionProps> = ({ id, label, description, isActive, onClick, preview }) => {
  return (
    <Card
      variant={isActive ? 'elevated' : 'flat'}
      padding="sm"
      className={`
        relative w-full text-left transition-all duration-200 group flex items-start gap-3 cursor-pointer
        ${isActive 
          ? 'ring-2 ring-[var(--interactive-accent)] bg-[var(--surface-primary)]' 
          : 'hover:border-[var(--border-secondary)] hover:bg-[var(--surface-secondary)]'
        }
      `}
      onClick={onClick}
    >
      {/* Preview Swatch */}
      <div 
        className="w-10 h-10 rounded-md shadow-sm shrink-0 border border-black/5 relative overflow-hidden"
        style={{ backgroundColor: preview.bg }}
      >
        <div className="absolute top-0 left-0 w-full h-1/3 opacity-20" style={{ backgroundColor: preview.accent }} />
        <div className="absolute bottom-2 right-2 w-4 h-4 rounded-full" style={{ backgroundColor: preview.accent }} />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <Text variant="body" className={`font-medium ${isActive ? 'text-[var(--interactive-accent)]' : ''}`}>
            {label}
          </Text>
          {isActive && (
            <motion.div layoutId="check" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="text-[var(--interactive-accent)]">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
            </motion.div>
          )}
        </div>
        <Text variant="muted" className="mt-0.5 truncate">
          {description}
        </Text>
      </div>
    </Card>
  );
};
