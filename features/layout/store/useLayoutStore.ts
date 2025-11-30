import { create } from 'zustand';
import { SidebarTab, MainView, CharacterProfile } from '@/types';

interface LayoutState {
  // Sidebar & Panel State
  activeTab: SidebarTab;
  activeView: MainView;
  isSidebarCollapsed: boolean;
  isToolsCollapsed: boolean;
  
  // Theme
  theme: 'light' | 'dark';
  
  // Chat State
  chatInitialMessage: string | undefined;
  interviewTarget: CharacterProfile | null;
  
  // Graph State
  selectedGraphCharacter: CharacterProfile | null;
  
  // Zen Mode Hover State (ephemeral, but cleaner here than scattered)
  isExitZenHovered: boolean;
  isHeaderHovered: boolean;
  
  // Persona
  currentPersonaIndex: number;
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
}

type LayoutStore = LayoutState & LayoutActions;

const getInitialTheme = (): 'light' | 'dark' => {
  if (typeof window !== 'undefined') {
    return (localStorage.getItem('quillai-theme') as 'light' | 'dark') || 'light';
  }
  return 'light';
};

export const useLayoutStore = create<LayoutStore>((set, get) => ({
  // Initial State
  activeTab: SidebarTab.ANALYSIS,
  activeView: MainView.EDITOR,
  isSidebarCollapsed: false,
  isToolsCollapsed: false,
  theme: getInitialTheme(),
  chatInitialMessage: undefined,
  interviewTarget: null,
  selectedGraphCharacter: null,
  isExitZenHovered: false,
  isHeaderHovered: false,
  currentPersonaIndex: 0,

  // Tab/View Actions
  setActiveTab: (tab) => set({ activeTab: tab }),
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
    const newTheme = state.theme === 'light' ? 'dark' : 'light';
    if (typeof window !== 'undefined') {
      document.documentElement.setAttribute('data-theme', newTheme);
      localStorage.setItem('quillai-theme', newTheme);
    }
    return { theme: newTheme };
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
  openTabWithPanel: (tab) => set({ activeTab: tab, isToolsCollapsed: false }),

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
      activeTab: SidebarTab.LORE
    });
  },

  handleInterviewCharacter: (character) => {
    set({
      interviewTarget: character,
      activeTab: SidebarTab.CHAT,
      isToolsCollapsed: false
    });
  }
}));
