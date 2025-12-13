import React from 'react';
import { motion } from 'framer-motion';
import { SidebarTab, MainView, type CharacterProfile } from '@/types';
import { DEFAULT_PERSONAS } from '@/types/personas';
import { AIPresenceOrb, type OrbStatus } from '@/features/agent';
import { useLayoutStore } from './store/useLayoutStore';
import { AccessibleTooltip } from '@/features/shared/components/AccessibleTooltip';
import { useSettingsStore } from '@/features/settings/store/useSettingsStore';
import {
  ZenIcon,
  AnalysisIcon,
  HistoryIcon,
  MicIcon,
  WandIcon,
  GraphIcon,
  BookIcon,
  MemoryIcon,
  BoardIcon,
  SunIcon,
  MoonIcon,
  SettingsIcon,
  HomeIcon,
  VersionsIcon,
} from '@/features/shared/components/Icons';

interface NavigationRailProps {
  isZenMode: boolean;
  toggleZenMode: () => void;
  orbStatus: OrbStatus;
  analysisReady: boolean;
}

const NAV_ITEMS: Array<{ tab: SidebarTab; Icon: React.FC<{ className?: string }>; label: string; description: string }> = [
  { tab: SidebarTab.ANALYSIS, Icon: AnalysisIcon, label: 'Analysis', description: 'Deep analysis of your manuscript' },
  { tab: SidebarTab.HISTORY, Icon: HistoryIcon, label: 'History', description: 'View edit history and restore versions' },
  { tab: SidebarTab.BRANCHES, Icon: VersionsIcon, label: 'Story Versions', description: 'Try alternate directions for your chapter' },
  { tab: SidebarTab.VOICE, Icon: MicIcon, label: 'Voice', description: 'Dictate and transcribe with AI' },
  { tab: SidebarTab.MEMORY, Icon: MemoryIcon, label: 'Memory', description: 'AI memory and context tracking' },
  { tab: SidebarTab.GRAPH, Icon: GraphIcon, label: 'Graph', description: 'Visualize character relationships' },
  { tab: SidebarTab.LORE, Icon: BookIcon, label: 'Lore Bible', description: 'Manage world-building details' },
];

export const NavigationRail: React.FC<NavigationRailProps> = ({
  isZenMode,
  toggleZenMode,
  orbStatus,
  analysisReady,
}) => {
  const {
    activeTab,
    activeView,
    theme,
    currentPersonaIndex,
    openTabWithPanel,
    toggleView,
    toggleTheme,
  } = useLayoutStore((state) => ({
    activeTab: state.activeTab,
    activeView: state.activeView,
    theme: state.theme,
    currentPersonaIndex: state.currentPersonaIndex,
    openTabWithPanel: state.openTabWithPanel,
    toggleView: state.toggleView,
    toggleTheme: state.toggleTheme,
  }));

  const advancedFeaturesEnabled = useSettingsStore((state) => state.advancedFeaturesEnabled);
  const experimentalFeaturesEnabled = useSettingsStore((state) => state.experimentalFeaturesEnabled);

  const visibleNavItems = NAV_ITEMS.filter(({ tab }) => {
    if (tab === SidebarTab.HISTORY) return advancedFeaturesEnabled;
    if (
      tab === SidebarTab.BRANCHES ||
      tab === SidebarTab.VOICE ||
      tab === SidebarTab.GRAPH ||
      tab === SidebarTab.LORE
    ) {
      return experimentalFeaturesEnabled;
    }
    return true;
  });

  const currentPersona = DEFAULT_PERSONAS[currentPersonaIndex];

  const handleHomeClick = () => {
    // Navigate back to project dashboard instead of reloading
    useLayoutStore.getState().resetToProjectDashboard();
  };

  return (
    <motion.nav
      animate={{
        x: isZenMode ? -80 : 0,
        opacity: isZenMode ? 0 : 1,
      }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className="w-16 bg-[var(--nav-bg)] border-r border-[var(--border-primary)] flex flex-col items-center py-6 gap-2 shrink-0 z-40"
      style={{ pointerEvents: isZenMode ? 'none' : 'auto' }}
      aria-label="Main navigation"
      aria-hidden={isZenMode}
      // @ts-ignore - inert is a valid attribute but may not be in React types yet
      inert={isZenMode ? "true" : undefined}
    >
      {/* Home/Library Button */}
      <AccessibleTooltip content="Return to Project Library" position="right">
        <button
          onClick={handleHomeClick}
          className="w-10 h-10 rounded-xl bg-[var(--interactive-accent)] text-[var(--text-inverse)] flex items-center justify-center shadow-md mb-4 hover:scale-105 transition-transform"
          aria-label="Return to Library"
        >
          <HomeIcon />
        </button>
      </AccessibleTooltip>

      {/* View Toggle */}
      <AccessibleTooltip 
        content={activeView === MainView.EDITOR ? 'Switch to Story Board view' : 'Switch to Editor view'} 
        position="right"
      >
        <button
          onClick={toggleView}
          aria-label={activeView === MainView.EDITOR ? 'Switch to Story Board' : 'Switch to Editor'}
          aria-pressed={activeView === MainView.STORYBOARD}
          className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all mb-2 ${
            activeView === MainView.STORYBOARD
              ? 'bg-[var(--interactive-bg-active)] text-[var(--interactive-accent)]'
              : 'text-[var(--text-tertiary)] hover:bg-[var(--interactive-bg)] hover:text-[var(--text-secondary)]'
          }`}
        >
          <BoardIcon />
        </button>
      </AccessibleTooltip>

      <div className="w-8 border-t border-[var(--border-primary)] mb-2" aria-hidden="true" />

      {/* AI Presence Orb */}
      <AIPresenceOrb
        status={orbStatus}
        persona={currentPersona}
        analysisReady={analysisReady}
        onClick={() => openTabWithPanel(SidebarTab.CHAT)}
        isActive={activeTab === SidebarTab.CHAT}
      />

      {/* Navigation Items */}
      {visibleNavItems.map(({ tab, Icon, label, description }) => {
        const isExperimentalTab =
          tab === SidebarTab.BRANCHES ||
          tab === SidebarTab.VOICE ||
          tab === SidebarTab.GRAPH ||
          tab === SidebarTab.LORE;

        return (
        <AccessibleTooltip key={tab} content={<><strong>{label}</strong><br/><span className="text-[var(--text-muted)]">{description}</span></>} position="right">
          <button
            onClick={() => openTabWithPanel(tab)}
            aria-label={label}
            aria-current={activeTab === tab ? 'page' : undefined}
            className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all relative ${
              activeTab === tab
                ? 'bg-[var(--interactive-bg-active)] text-[var(--interactive-accent)]'
                : 'text-[var(--text-tertiary)] hover:bg-[var(--interactive-bg)] hover:text-[var(--text-secondary)]'
            }`}
          >
            <Icon />
            {isExperimentalTab && (
              <span
                className="absolute top-0 right-0 translate-x-1/3 -translate-y-1/3 text-[8px] px-1 py-0.5 rounded bg-[var(--surface-primary)] border border-[var(--border-primary)] text-[var(--text-tertiary)]"
                aria-hidden="true"
              >
                EXP
              </span>
            )}
            {activeTab === tab && (
              <div
                className="absolute right-[-13px] top-1/2 -translate-y-1/2 w-1 h-5 bg-[var(--interactive-accent)] rounded-l-sm"
                aria-hidden="true"
              />
            )}
          </button>
        </AccessibleTooltip>
        );
      })}

      {/* Bottom Actions */}
      <div className="mt-auto flex flex-col items-center gap-2">
        <AccessibleTooltip content={<><strong>Zen Mode</strong><br/><span className="text-[var(--text-muted)]">Distraction-free writing (Ctrl+Shift+Z)</span></>} position="right">
          <button
            onClick={toggleZenMode}
            aria-label={isZenMode ? 'Exit Zen Mode' : 'Enter Zen Mode'}
            aria-pressed={isZenMode}
            className="w-10 h-10 rounded-lg flex items-center justify-center text-[var(--text-tertiary)] hover:bg-[var(--interactive-bg)] hover:text-[var(--interactive-accent)] transition-all"
          >
            <ZenIcon />
          </button>
        </AccessibleTooltip>

        <AccessibleTooltip content={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'} position="right">
          <button
            onClick={toggleTheme}
            aria-label={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            className="w-10 h-10 rounded-lg flex items-center justify-center text-[var(--text-tertiary)] hover:bg-[var(--interactive-bg)] hover:text-[var(--interactive-accent)] transition-all"
          >
            {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
          </button>
        </AccessibleTooltip>

        <AccessibleTooltip content={<><strong>Settings</strong><br/><span className="text-[var(--text-muted)]">Customize your workspace</span></>} position="right">
          <button
            onClick={() => openTabWithPanel(SidebarTab.SETTINGS)}
            aria-label="Settings"
            aria-pressed={activeTab === SidebarTab.SETTINGS}
            className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all ${
              activeTab === SidebarTab.SETTINGS
                ? 'bg-[var(--interactive-bg-active)] text-[var(--interactive-accent)]'
                : 'text-[var(--text-tertiary)] hover:bg-[var(--interactive-bg)] hover:text-[var(--interactive-accent)]'
            }`}
          >
            <SettingsIcon />
          </button>
        </AccessibleTooltip>
      </div>
    </motion.nav>
  );
};
