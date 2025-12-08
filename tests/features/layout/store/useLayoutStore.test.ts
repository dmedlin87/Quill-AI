import { beforeEach, describe, expect, it, vi } from 'vitest';

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
    expect(localStorageStub.getItem).toHaveBeenCalledWith('quillai-theme');
    expect(useLayoutStore.getState().theme).toBe('light');
    expect(documentStub.documentElement.setAttribute).toHaveBeenCalledWith('data-theme', 'light');
  });

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
    } = useLayoutStore.getState();

    handleFixRequest('context', 'suggest');
    expect(useLayoutStore.getState().chatInitialMessage).toContain('context');
    expect(useLayoutStore.getState().activeTab).toBe(SidebarTab.CHAT);

    setChatInitialMessage('hello');
    expect(useLayoutStore.getState().chatInitialMessage).toBe('hello');
    clearChatInitialMessage();
    expect(useLayoutStore.getState().chatInitialMessage).toBeUndefined();

    const character = { id: 'c1', name: 'Alice' } as any;
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
    expect(localStorageStub.setItem).toHaveBeenCalledWith('quillai-theme', 'dark');
    expect(documentStub.documentElement.setAttribute).toHaveBeenCalledWith('data-theme', 'dark');
  });
});
