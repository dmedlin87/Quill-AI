import { beforeEach, describe, expect, it, vi, beforeAll } from 'vitest';

const documentStub = { documentElement: { setAttribute: vi.fn() } };
const localStorageStub = {
  getItem: vi.fn().mockReturnValue('light'),
  setItem: vi.fn(),
};

// Provide minimal globals before module import
vi.stubGlobal('document', documentStub as unknown);
vi.stubGlobal('window', {} as unknown);
vi.stubGlobal('localStorage', localStorageStub as unknown);

const emitPanelSwitched = vi.hoisted(() => vi.fn());

vi.mock('@/services/appBrain', () => ({
  emitPanelSwitched,
}));

let useLayoutStore: typeof import('@/features/layout/store/useLayoutStore')['useLayoutStore'];
let MainView: typeof import('@/types')['MainView'];
let SidebarTab: typeof import('@/types')['SidebarTab'];
let initialState: ReturnType<typeof useLayoutStore.getState>;

beforeAll(async () => {
  ({ MainView, SidebarTab } = await import('@/types'));
  ({ useLayoutStore } = await import('@/features/layout/store/useLayoutStore'));
  initialState = useLayoutStore.getState();
});

beforeEach(() => {
  emitPanelSwitched.mockClear();
  useLayoutStore.setState(initialState, true);
});

describe('useLayoutStore', () => {
  it('initializes theme from localStorage and applies it to document', () => {
    expect(localStorageStub.getItem).toHaveBeenCalledWith('quillai-mode');
    expect(useLayoutStore.getState().theme).toBe('light');
    expect(documentStub.documentElement.setAttribute).toHaveBeenCalledWith('data-mode', 'light');
  });

  // ... (keeping other tests as they are not targeting this replacement, 
  // but since replace_file_content replaces the block, I need to match carefully or just target the specific lines)
  // I will target the specific blocks cleanly.


  it('toggles sidebar and tools collapsed state', () => {
    const { toggleSidebar, setToolsCollapsed } = useLayoutStore.getState();

    toggleSidebar();
    expect(useLayoutStore.getState().isSidebarCollapsed).toBe(true);

    setToolsCollapsed(true);
    expect(useLayoutStore.getState().isToolsCollapsed).toBe(true);
  });

  it('switches active view and tab, emitting panel switch events', () => {
    const { setActiveView, toggleView, setActiveTab, openTabWithPanel } = useLayoutStore.getState();

    setActiveView(MainView.STORYBOARD);
    expect(useLayoutStore.getState().activeView).toBe(MainView.STORYBOARD);

    toggleView();
    expect(useLayoutStore.getState().activeView).toBe(MainView.EDITOR);

    // Toggle back to STORYBOARD
    toggleView();
    expect(useLayoutStore.getState().activeView).toBe(MainView.STORYBOARD);

    setActiveTab(SidebarTab.CHAT);
    expect(emitPanelSwitched).toHaveBeenCalledWith(SidebarTab.CHAT);

    openTabWithPanel(SidebarTab.LORE);
    expect(useLayoutStore.getState().activeTab).toBe(SidebarTab.LORE);
    expect(useLayoutStore.getState().isToolsCollapsed).toBe(false);
  });

  it('handles chat helpers and graph selection helpers', () => {
    const {
      handleFixRequest,
      setChatInitialMessage,
      clearChatInitialMessage,
      handleSelectGraphCharacter,
      handleInterviewCharacter,
      exitInterview,
      setSelectedGraphCharacter
    } = useLayoutStore.getState();

    handleFixRequest('context', 'suggest');
    expect(useLayoutStore.getState().chatInitialMessage).toContain('context');
    expect(useLayoutStore.getState().activeTab).toBe(SidebarTab.CHAT);

    setChatInitialMessage('hello');
    expect(useLayoutStore.getState().chatInitialMessage).toBe('hello');
    clearChatInitialMessage();
    expect(useLayoutStore.getState().chatInitialMessage).toBeUndefined();

    const character = { id: 'c1', name: 'Alice' } as any;

    // Direct setter
    setSelectedGraphCharacter(character);
    expect(useLayoutStore.getState().selectedGraphCharacter).toEqual(character);

    // Helper
    handleSelectGraphCharacter(character);
    expect(useLayoutStore.getState().selectedGraphCharacter).toEqual(character);
    expect(useLayoutStore.getState().activeTab).toBe(SidebarTab.LORE);

    handleInterviewCharacter(character);
    expect(useLayoutStore.getState().interviewTarget).toEqual(character);
    expect(useLayoutStore.getState().activeTab).toBe(SidebarTab.CHAT);
    expect(useLayoutStore.getState().isToolsCollapsed).toBe(false);

    exitInterview();
    expect(useLayoutStore.getState().interviewTarget).toBeNull();
  });

  it('toggles and persists theme', () => {
    const { toggleTheme } = useLayoutStore.getState();

    toggleTheme();
    expect(useLayoutStore.getState().theme).toBe('dark');
    expect(localStorageStub.setItem).toHaveBeenCalledWith('quillai-mode', 'dark');
    expect(documentStub.documentElement.setAttribute).toHaveBeenCalledWith('data-mode', 'dark');

    toggleTheme();
    expect(useLayoutStore.getState().theme).toBe('light');
  });

  it('sets sidebar collapsed directly', () => {
    const { setSidebarCollapsed } = useLayoutStore.getState();
    setSidebarCollapsed(true);
    expect(useLayoutStore.getState().isSidebarCollapsed).toBe(true);
    setSidebarCollapsed(false);
    expect(useLayoutStore.getState().isSidebarCollapsed).toBe(false);
  });

  it('manages zen mode hover states', () => {
    const { setExitZenHovered, setHeaderHovered } = useLayoutStore.getState();

    setExitZenHovered(true);
    expect(useLayoutStore.getState().isExitZenHovered).toBe(true);

    setHeaderHovered(true);
    expect(useLayoutStore.getState().isHeaderHovered).toBe(true);
  });

  it('sets current persona index', () => {
    const { setCurrentPersonaIndex } = useLayoutStore.getState();
    setCurrentPersonaIndex(5);
    expect(useLayoutStore.getState().currentPersonaIndex).toBe(5);
  });

  it('manages lore draft state', () => {
    const { openLoreDraft, consumeLoreDraft } = useLayoutStore.getState();
    const character = { id: 'c2', name: 'Bob' } as any;

    openLoreDraft(character);
    expect(useLayoutStore.getState().loreDraftCharacter).toEqual(character);
    expect(useLayoutStore.getState().activeTab).toBe(SidebarTab.LORE);
    expect(useLayoutStore.getState().isToolsCollapsed).toBe(false);
    expect(emitPanelSwitched).toHaveBeenCalledWith(SidebarTab.LORE);

    consumeLoreDraft();
    expect(useLayoutStore.getState().loreDraftCharacter).toBeNull();
  });

  it('handles invalid panel identifiers (should not crash)', () => {
      const { setActiveTab } = useLayoutStore.getState();
      // @ts-ignore
      setActiveTab('INVALID_TAB');
      expect(useLayoutStore.getState().activeTab).toBe('INVALID_TAB');
  });

  it('prevents simultaneous opening of exclusive panels', () => {
      const { openLoreDraft, handleInterviewCharacter } = useLayoutStore.getState();
      const character = { id: 'c1', name: 'Alice' } as any;

      // First open Lore Draft
      openLoreDraft(character);
      expect(useLayoutStore.getState().activeTab).toBe(SidebarTab.LORE);

      // Then try to open Interview, which should override the active tab
      handleInterviewCharacter(character);
      expect(useLayoutStore.getState().activeTab).toBe(SidebarTab.CHAT);

      // In this specific store implementation, the state is simple (activeTab).
      // There isn't a complex "exclusive" check other than overwriting the activeTab.
      // But we verify that `isToolsCollapsed` is handled correctly (e.g. forced open).
      expect(useLayoutStore.getState().isToolsCollapsed).toBe(false);
  });
});
