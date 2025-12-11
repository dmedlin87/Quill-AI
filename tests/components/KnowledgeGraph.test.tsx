import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { KnowledgeGraph } from '@/features/lore/components/KnowledgeGraph';
import { useProjectStore } from '@/features/project';
import type { CharacterProfile } from '@/types';
import { vi } from 'vitest';

vi.mock('@/features/project', () => ({
  useProjectStore: vi.fn(),
}));

const mockedUseProjectStore = vi.mocked(useProjectStore);

const createMockContext = () => {
  return {
    fillRect: vi.fn(),
    clearRect: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    createRadialGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
    fillText: vi.fn(),
    measureText: vi.fn(() => ({ width: 20 })),
    roundRect: vi.fn(),
    set fillStyle(value: string) {},
    set strokeStyle(value: string) {},
    set lineWidth(value: number) {},
    set font(value: string) {},
    set textAlign(value: CanvasTextAlign) {},
    set textBaseline(value: CanvasTextBaseline) {},
    set shadowBlur(value: number) {},
    set shadowColor(value: string) {},
  } as unknown as CanvasRenderingContext2D;
};

const createObserverEntry = (width: number, height: number) =>
  ({
    contentRect: { width, height } as DOMRectReadOnly,
    target: document.body,
  } as unknown as ResizeObserverEntry);

describe('KnowledgeGraph', () => {
  let mockContext: CanvasRenderingContext2D;
  const originalGetContext = HTMLCanvasElement.prototype.getContext;
  const originalGetBoundingClientRect = HTMLElement.prototype.getBoundingClientRect;
  const originalResizeObserver = (globalThis as any).ResizeObserver;

  beforeEach(() => {
    vi.clearAllMocks();
    mockContext = createMockContext();
    HTMLCanvasElement.prototype.getContext = vi.fn(() => mockContext) as any;

    // Default dimensions: 500x400. Center is (250, 200).
    HTMLElement.prototype.getBoundingClientRect = vi.fn(() => ({
      width: 500,
      height: 400,
      top: 0,
      left: 0,
      right: 500,
      bottom: 400,
      x: 0,
      y: 0,
      toJSON: () => {},
    }));

    vi.spyOn(window, 'requestAnimationFrame').mockReturnValue(1 as any);
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {});

    // Mock random to return 0.5, so nodes are placed exactly at center (250, 200)
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
  });

  afterEach(() => {
    HTMLCanvasElement.prototype.getContext = originalGetContext;
    HTMLElement.prototype.getBoundingClientRect = originalGetBoundingClientRect;
    if (originalResizeObserver) {
      (globalThis as any).ResizeObserver = originalResizeObserver;
    } else {
      delete (globalThis as any).ResizeObserver;
    }
    vi.restoreAllMocks();
  });

  it('shows an empty state when no characters exist', () => {
    mockedUseProjectStore.mockReturnValue({
      currentProject: { lore: { characters: [], worldRules: [] } },
      chapters: [],
    } as any);

    render(<KnowledgeGraph onSelectCharacter={vi.fn()} />);

    expect(screen.getByText(/no characters found/i)).toBeInTheDocument();
  });

  it('renders the graph canvas when characters are present', async () => {
    const characters: CharacterProfile[] = [
      {
        name: 'Alice',
        bio: '',
        arc: '',
        arcStages: [],
        relationships: [{ name: 'Bob', type: 'friend', dynamic: '' }],
        plotThreads: [],
        inconsistencies: [],
        developmentSuggestion: '',
      },
      {
        name: 'Bob',
        bio: '',
        arc: '',
        arcStages: [],
        relationships: [{ name: 'Alice', type: 'ally', dynamic: '' }],
        plotThreads: [],
        inconsistencies: [],
        developmentSuggestion: '',
      },
    ];

    mockedUseProjectStore.mockReturnValue({
      currentProject: { lore: { characters, worldRules: [] } },
      chapters: [],
    } as any);

    render(<KnowledgeGraph onSelectCharacter={vi.fn()} />);

    await waitFor(() => expect(mockContext.fillRect).toHaveBeenCalled());
    expect(screen.queryByText(/no characters found/i)).not.toBeInTheDocument();
  });

  it('allows selecting a character node via canvas click', async () => {
    const onSelectCharacter = vi.fn();
    const characters: CharacterProfile[] = [
      {
        name: 'Alice',
        bio: '',
        arc: '',
        arcStages: [],
        relationships: [],
        plotThreads: [],
        inconsistencies: [],
        developmentSuggestion: '',
      },
    ];

    mockedUseProjectStore.mockReturnValue({
      currentProject: { lore: { characters, worldRules: [] } },
      chapters: [],
    } as any);

    render(<KnowledgeGraph onSelectCharacter={onSelectCharacter} />);

    const canvas = document.querySelector('canvas');
    expect(canvas).toBeTruthy();

    await waitFor(() => expect(mockContext.fillRect).toHaveBeenCalled());

    // Node is at (250, 200). Click exactly there.
    fireEvent.click(canvas as HTMLCanvasElement, { clientX: 250, clientY: 200 });

    await waitFor(() => expect(onSelectCharacter).toHaveBeenCalled());
    expect(onSelectCharacter).toHaveBeenCalledWith(expect.objectContaining({ name: 'Alice' }));
  });

  it('deselects character when clicking empty space', async () => {
    const onSelectCharacter = vi.fn();
    const characters: CharacterProfile[] = [
      {
        name: 'Alice',
        bio: '',
        arc: '',
        arcStages: [],
        relationships: [],
        plotThreads: [],
        inconsistencies: [],
        developmentSuggestion: '',
      },
    ];

    mockedUseProjectStore.mockReturnValue({
      currentProject: { lore: { characters, worldRules: [] } },
      chapters: [],
    } as any);

    render(<KnowledgeGraph onSelectCharacter={onSelectCharacter} />);

    const canvas = document.querySelector('canvas') as HTMLCanvasElement;
    await waitFor(() => expect(canvas).toBeInstanceOf(HTMLCanvasElement));
    await waitFor(() => expect(mockContext.fillRect).toHaveBeenCalled());

    // First click to select (250, 200)
    fireEvent.click(canvas, { clientX: 250, clientY: 200 });
    await waitFor(() => expect(onSelectCharacter).toHaveBeenCalled());

    // Second click on empty space (10, 10)
    fireEvent.click(canvas, { clientX: 10, clientY: 10 });

    onSelectCharacter.mockClear();
    fireEvent.click(canvas, { clientX: 10, clientY: 10 });
    expect(onSelectCharacter).not.toHaveBeenCalled();
  });

  it('supports node dragging interactions', async () => {
    const characters: CharacterProfile[] = [
      {
        name: 'Alice',
        bio: '',
        arc: '',
        arcStages: [],
        relationships: [],
        plotThreads: [],
        inconsistencies: [],
        developmentSuggestion: '',
      },
    ];

    mockedUseProjectStore.mockReturnValue({
      currentProject: { lore: { characters, worldRules: [] } },
      chapters: [],
    } as any);

    render(<KnowledgeGraph onSelectCharacter={vi.fn()} />);

    const canvas = document.querySelector('canvas') as HTMLCanvasElement;
    await waitFor(() => expect(canvas).toBeInstanceOf(HTMLCanvasElement));
    await waitFor(() => expect(mockContext.fillRect).toHaveBeenCalled());

    // Mouse Down on node at (250, 200)
    fireEvent.mouseDown(canvas, { clientX: 250, clientY: 200 });

    // Mouse Move to (300, 250)
    fireEvent.mouseMove(canvas, { clientX: 300, clientY: 250 });

    // Mouse Up
    fireEvent.mouseUp(canvas);
  });

  it('changes cursor on hover and resets when leaving node', async () => {
    const characters: CharacterProfile[] = [
      {
        name: 'Alice',
        bio: '',
        arc: '',
        arcStages: [],
        relationships: [{ name: 'Bob', type: 'friend', dynamic: '' }],
        plotThreads: [],
        inconsistencies: [],
        developmentSuggestion: '',
      },
      {
        name: 'Bob',
        bio: '',
        arc: '',
        arcStages: [],
        relationships: [{ name: 'Alice', type: 'ally', dynamic: '' }],
        plotThreads: [],
        inconsistencies: [],
        developmentSuggestion: '',
      },
    ];

    mockedUseProjectStore.mockReturnValue({
      currentProject: { lore: { characters, worldRules: [] } },
      chapters: [],
    } as any);

    render(<KnowledgeGraph onSelectCharacter={vi.fn()} />);

    const canvas = document.querySelector('canvas') as HTMLCanvasElement;
    await waitFor(() => expect(canvas).toBeInstanceOf(HTMLCanvasElement));
    await waitFor(() => expect(mockContext.fillRect).toHaveBeenCalled());

    // Move over node at (250, 200)
    fireEvent.mouseMove(canvas, { clientX: 250, clientY: 200 });
    expect(canvas.style.cursor).toBe('pointer');

    // Move away to (10, 10)
    fireEvent.mouseMove(canvas, { clientX: 10, clientY: 10 });
    expect(canvas.style.cursor).toBe('default');
  });

  it('updates dimensions on resize via window listener and ResizeObserver fallback', async () => {
    const getRectMock = vi.fn().mockReturnValue({
      width: 500,
      height: 400,
      top: 0,
      left: 0,
      right: 500,
      bottom: 400,
      x: 0,
      y: 0,
      toJSON: () => {},
    });
    HTMLElement.prototype.getBoundingClientRect = getRectMock;

    const resizeDisconnect = vi.fn();
    const resizeObserve = vi.fn();
    class ResizeObserverMock {
      callback: ResizeObserverCallback;
      constructor(cb: ResizeObserverCallback) {
        this.callback = cb;
      }
      observe = resizeObserve;
      disconnect = resizeDisconnect;
      trigger(entry: ResizeObserverEntry) {
        this.callback([entry], this as unknown as ResizeObserver);
      }
    }
    (globalThis as any).ResizeObserver = ResizeObserverMock as unknown as typeof ResizeObserver;

    mockedUseProjectStore.mockReturnValue({
      currentProject: { lore: { characters: [{ name: 'Alice' } as CharacterProfile], worldRules: [] } },
      chapters: [],
    } as any);

    render(<KnowledgeGraph onSelectCharacter={vi.fn()} />);

    const canvas = document.querySelector('canvas') as HTMLCanvasElement;
    await waitFor(() => expect(canvas.width).toBe(500));

    getRectMock.mockReturnValue({
      width: 640,
      height: 360,
      top: 0,
      left: 0,
      right: 640,
      bottom: 360,
      x: 0,
      y: 0,
      toJSON: () => {},
    });

    fireEvent(window, new Event('resize'));
    await waitFor(() => {
      expect(canvas.width).toBe(640);
      expect(canvas.height).toBe(360);
    });

    const observerInstance = resizeObserve.mock.instances?.[0] as ResizeObserverMock | undefined;
    getRectMock.mockReturnValue({
      width: 700,
      height: 420,
      top: 0,
      left: 0,
      right: 700,
      bottom: 420,
      x: 0,
      y: 0,
      toJSON: () => {},
    });
    observerInstance?.trigger(createObserverEntry(700, 420));

    await waitFor(() => {
      expect(canvas.width).toBe(700);
      expect(canvas.height).toBe(420);
    });
  });

  it('deduplicates lore and chapter characters and allows selecting from combined set', async () => {
    // Both nodes at center (250, 200)
    vi.spyOn(Math, 'random').mockReturnValue(0.5);

    const loreCharacters: CharacterProfile[] = [
      {
        name: 'Alice',
        bio: '',
        arc: '',
        arcStages: [],
        relationships: [{ name: 'Bob', type: 'friend', dynamic: 'ally' }],
        plotThreads: [],
        inconsistencies: [],
        developmentSuggestion: '',
      },
    ];

    const chapterCharacters: CharacterProfile[] = [
      {
        name: 'Bob',
        bio: '',
        arc: '',
        arcStages: [],
        relationships: [{ name: 'Alice', type: 'friend', dynamic: 'ally' }],
        plotThreads: [],
        inconsistencies: [],
        developmentSuggestion: '',
      },
    ];

    mockedUseProjectStore.mockReturnValue({
      currentProject: { lore: { characters: loreCharacters, worldRules: [] } },
      chapters: [
        {
          id: 'c1',
          title: 'Chapter',
          content: '',
          createdAt: Date.now(),
          updatedAt: Date.now(),
          projectId: 'p1',
          lastAnalysis: { characters: chapterCharacters },
        },
      ],
    } as any);

    const onSelect = vi.fn();
    render(<KnowledgeGraph onSelectCharacter={onSelect} />);

    const canvas = document.querySelector('canvas') as HTMLCanvasElement;
    await waitFor(() => expect(canvas).toBeInstanceOf(HTMLCanvasElement));
    await waitFor(() => expect(mockContext.fillRect).toHaveBeenCalled());

    // Both overlap at (250, 200). Alice is first.
    fireEvent.click(canvas, { clientX: 250, clientY: 200 });

    await waitFor(() => expect(onSelect).toHaveBeenCalled());
    const selected = onSelect.mock.calls[0][0] as CharacterProfile;
    expect(selected.name).toBe('Alice');
  });

  it('renders legend and truncates if too many items', async () => {
    // 6 characters to trigger truncation
    const characters = Array.from({ length: 6 }, (_, i) => ({
      name: `Char${i}`,
      bio: '',
      arc: '',
      arcStages: [],
      relationships: [],
      plotThreads: [],
      inconsistencies: [],
      developmentSuggestion: '',
    }));

    mockedUseProjectStore.mockReturnValue({
      currentProject: { lore: { characters, worldRules: [] } },
      chapters: [],
    } as any);

    render(<KnowledgeGraph onSelectCharacter={vi.fn()} />);

    await waitFor(() => expect(screen.getByText('Characters')).toBeInTheDocument());

    // Should see first 5
    expect(screen.getByText('Char0')).toBeInTheDocument();
    expect(screen.getByText('Char4')).toBeInTheDocument();

    // Should not see 6th
    expect(screen.queryByText('Char5')).not.toBeInTheDocument();

    // Should see "+1 more"
    expect(screen.getByText('+1 more')).toBeInTheDocument();
  });

  it('cleans up animation frame, resize/mouse listeners, and observers on unmount', async () => {
    const disconnectSpy = vi.fn();
    class ResizeObserverMock {
      disconnect = disconnectSpy;
      observe = vi.fn();
    }
    (globalThis as any).ResizeObserver = ResizeObserverMock;

    const cancelSpy = vi.spyOn(window, 'cancelAnimationFrame');
    const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener');

    mockedUseProjectStore.mockReturnValue({
      currentProject: { lore: { characters: [{ name: 'Alice' } as CharacterProfile], worldRules: [] } },
      chapters: [],
    } as any);

    const { unmount } = render(<KnowledgeGraph onSelectCharacter={vi.fn()} />);
    await waitFor(() => expect(mockContext.fillRect).toHaveBeenCalled());

    unmount();

    expect(cancelSpy).toHaveBeenCalled();
    expect(removeEventListenerSpy).toHaveBeenCalledWith('resize', expect.any(Function));
    expect(removeEventListenerSpy).toHaveBeenCalledWith('mouseup', expect.any(Function));
    expect(disconnectSpy).toHaveBeenCalled();

    delete (globalThis as any).ResizeObserver;
  });

  it('handles ResizeObserver instantiation failure gracefully', () => {
    // Mock ResizeObserver to throw
    (globalThis as any).ResizeObserver = class {
      constructor() {
        throw new Error('Not supported');
      }
    };
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    mockedUseProjectStore.mockReturnValue({
      currentProject: { lore: { characters: [], worldRules: [] } },
      chapters: [],
    } as any);

    expect(() => render(<KnowledgeGraph onSelectCharacter={vi.fn()} />)).not.toThrow();
    consoleSpy.mockRestore();
  });
});
