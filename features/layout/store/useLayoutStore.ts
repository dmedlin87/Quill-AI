import { create } from 'zustand';
import { SidebarTab, MainView, CharacterProfile } from '@/types';
import { emitPanelSwitched } from '@/services/appBrain';
import { useProjectStore } from '@/features/project/store/useProjectStore';

type Theme = 'light' | 'dark';

interface LayoutState {
  // Sidebar & Panel State
  activeTab: SidebarTab;
  activeView: MainView;
  isSidebarCollapsed: boolean;
  isToolsCollapsed: boolean;
  
  // Theme
  theme: Theme; // 'light' | 'dark'
  visualTheme: 'parchment' | 'modern' | 'classic';
  
  // Chat State
  chatInitialMessage: string | undefined;
  interviewTarget: CharacterProfile | null;

  // Lore Drafting
  loreDraftCharacter: CharacterProfile | null;
  
  // Graph State
  selectedGraphCharacter: CharacterProfile | null;
  
  // Zen Mode Hover State (ephemeral, but cleaner here than scattered)
  isExitZenHovered: boolean;
  isHeaderHovered: boolean;
  
  // Persona
  currentPersonaIndex: number;
  
  // Tools Panel
  toolsPanelWidth: number;
  isToolsPanelExpanded: boolean;
}

interface LayoutActions {
  // Tab/View
  setActiveTab: (tab: SidebarTab) => void;
  setActiveView: (view: MainView) => void;
  toggleView: () => void;
  
  // Collapse State
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setToolsCollapsed: (collapsed: boolean) => void;
  
  // Theme
  toggleTheme: () => void;
  setVisualTheme: (theme: 'parchment' | 'modern' | 'classic') => void;
  
  // Chat
  setChatInitialMessage: (message: string | undefined) => void;
  clearChatInitialMessage: () => void;
  
  // Interview
  setInterviewTarget: (target: CharacterProfile | null) => void;
  exitInterview: () => void;
  
  // Graph
  setSelectedGraphCharacter: (character: CharacterProfile | null) => void;
  
  // Zen Mode Hover
  setExitZenHovered: (hovered: boolean) => void;
  setHeaderHovered: (hovered: boolean) => void;
  
  // Persona
  setCurrentPersonaIndex: (index: number) => void;
  
  // Compound Actions
  openTabWithPanel: (tab: SidebarTab) => void;
  handleFixRequest: (issueContext: string, suggestion: string) => void;
  handleSelectGraphCharacter: (character: CharacterProfile) => void;
  handleInterviewCharacter: (character: CharacterProfile) => void;
  openLoreDraft: (character: CharacterProfile) => void;
  consumeLoreDraft: () => void;
  resetToProjectDashboard: () => void;
  
  // Tools Panel
  setToolsPanelWidth: (width: number) => void;
  toggleToolsPanelExpanded: () => void;
}

type LayoutStore = LayoutState & LayoutActions;

const applyTheme = (mode: Theme, visualTheme: string) => {
  if (typeof window !== 'undefined') {
    document.documentElement.setAttribute('data-mode', mode);
    document.documentElement.setAttribute('data-theme', visualTheme);
    localStorage.setItem('quillai-mode', mode); // Renamed to mode for clarity, but keeping theme for compat
    localStorage.setItem('quillai-visual-theme', visualTheme);
  }
};

const isTheme = (value: unknown): value is Theme => value === 'light' || value === 'dark';

const isVisualTheme = (value: unknown): value is LayoutState['visualTheme'] =>
  value === 'parchment' || value === 'modern' || value === 'classic';

const getInitialState = () => {
  if (typeof window === 'undefined') return { mode: 'light' as Theme, visualTheme: 'parchment' as const };
  
  const rawMode = localStorage.getItem('quillai-mode') || localStorage.getItem('quillai-theme') || 'light';
  const savedMode: Theme = isTheme(rawMode) ? rawMode : 'light';

  const rawVisualTheme = localStorage.getItem('quillai-visual-theme') || 'parchment';
  const savedVisualTheme: LayoutState['visualTheme'] = isVisualTheme(rawVisualTheme) ? rawVisualTheme : 'parchment';
  
  return { mode: savedMode, visualTheme: savedVisualTheme };
};

export const useLayoutStore = create<LayoutStore>((set, get) => {
  const { mode: initialMode, visualTheme: initialVisualTheme } = getInitialState();
  applyTheme(initialMode, initialVisualTheme);

  return {
    // Initial State
    activeTab: SidebarTab.ANALYSIS,
    activeView: MainView.EDITOR,
    isSidebarCollapsed: false,
    isToolsCollapsed: false,
    theme: initialMode,
    visualTheme: initialVisualTheme,
    chatInitialMessage: undefined,
    interviewTarget: null,
    selectedGraphCharacter: null,
    isExitZenHovered: false,
    isHeaderHovered: false,
    currentPersonaIndex: 0,
    loreDraftCharacter: null,
    toolsPanelWidth: 380,
    isToolsPanelExpanded: false,

    // Tab/View Actions
    setActiveTab: (tab) => {
      emitPanelSwitched(tab);
      set({ activeTab: tab });
    },

    openLoreDraft: (character) => {
      emitPanelSwitched(SidebarTab.LORE);
      set({
        loreDraftCharacter: character,
        activeTab: SidebarTab.LORE,
        isToolsCollapsed: false,
      });
    },

    consumeLoreDraft: () => set({ loreDraftCharacter: null }),
    setActiveView: (view) => set({ activeView: view }),
    toggleView: () => set((state) => ({
      activeView: state.activeView === MainView.EDITOR ? MainView.STORYBOARD : MainView.EDITOR
    })),

    // Collapse Actions
    toggleSidebar: () => set((state) => ({ isSidebarCollapsed: !state.isSidebarCollapsed })),
    setSidebarCollapsed: (collapsed) => set({ isSidebarCollapsed: collapsed }),
    setToolsCollapsed: (collapsed) => set({ isToolsCollapsed: collapsed }),

    // Theme Actions
    toggleTheme: () => set((state) => {
      const newMode = state.theme === 'light' ? 'dark' : 'light';
      applyTheme(newMode, state.visualTheme);
      localStorage.setItem('quillai-theme', newMode);
      return { theme: newMode };
    }),

    setVisualTheme: (visualTheme) => set((state) => {
      applyTheme(state.theme, visualTheme);
      return { visualTheme };
    }),

    // Chat Actions
    setChatInitialMessage: (message) => set({ chatInitialMessage: message }),
    clearChatInitialMessage: () => set({ chatInitialMessage: undefined }),

    // Interview Actions
    setInterviewTarget: (target) => set({ interviewTarget: target }),
    exitInterview: () => set({ interviewTarget: null }),

    // Graph Actions
    setSelectedGraphCharacter: (character) => set({ selectedGraphCharacter: character }),

    // Zen Mode Hover Actions
    setExitZenHovered: (hovered) => set({ isExitZenHovered: hovered }),
    setHeaderHovered: (hovered) => set({ isHeaderHovered: hovered }),

    // Persona Actions
    setCurrentPersonaIndex: (index) => set({ currentPersonaIndex: index }),

    // Compound Actions
    openTabWithPanel: (tab) => {
      emitPanelSwitched(tab);
      set({ activeTab: tab, isToolsCollapsed: false });
    },

    handleFixRequest: (issueContext, suggestion) => {
      const prompt = `I need to fix an issue. Context: ${issueContext}. Suggestion: ${suggestion}. Please locate this in the text and rewrite it using the update_manuscript tool.`;
      set({
        chatInitialMessage: prompt,
        activeTab: SidebarTab.CHAT,
        isToolsCollapsed: false
      });
    },

    handleSelectGraphCharacter: (character) => {
      set({
        selectedGraphCharacter: character,
        activeTab: SidebarTab.LORE,
        isToolsCollapsed: false
      });
    },

    handleInterviewCharacter: (character) => {
      set({
        interviewTarget: character,
        activeTab: SidebarTab.CHAT,
        isToolsCollapsed: false
      });
    },

    resetToProjectDashboard: () => {
      // Clear project selection to return to dashboard
      useProjectStore.getState().closeProject();
      // Reset layout state
      set({
        activeTab: SidebarTab.ANALYSIS,
        activeView: MainView.EDITOR,
        isSidebarCollapsed: false,
        isToolsCollapsed: false,
        chatInitialMessage: undefined,
        interviewTarget: null,
        selectedGraphCharacter: null,
        loreDraftCharacter: null,
      });
    },

    setToolsPanelWidth: (width) => set({ toolsPanelWidth: Math.max(320, Math.min(600, width)) }),
    toggleToolsPanelExpanded: () => set((state) => ({ isToolsPanelExpanded: !state.isToolsPanelExpanded }))
  };
});
