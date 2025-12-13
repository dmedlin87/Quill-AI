import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/react';

import { KnowledgeGraph } from '@/features/lore/components/KnowledgeGraph';
import { useProjectStore } from '@/features/project';

vi.mock('@/features/project', () => ({
  useProjectStore: vi.fn(),
}));

const mockUseProjectStore = vi.mocked(useProjectStore);

describe('KnowledgeGraph', () => {
  let ctx: any;
  let rafCallbacks: FrameRequestCallback[];

  beforeEach(() => {
    vi.clearAllMocks();

    rafCallbacks = [];
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      rafCallbacks.push(cb);
      return rafCallbacks.length;
    });
    vi.stubGlobal('cancelAnimationFrame', vi.fn());

    ctx = {
      fillStyle: '',
      strokeStyle: '',
      lineWidth: 0,
      font: '',
      textAlign: '',
      textBaseline: '',
      fillRect: vi.fn(),
      beginPath: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      stroke: vi.fn(),
      arc: vi.fn(),
      fill: vi.fn(),
      fillText: vi.fn(),
      createRadialGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
      measureText: vi.fn((text: string) => ({ width: String(text).length * 20 })),
    };

    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(ctx);
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      width: 800,
      height: 600,
      left: 0,
      top: 0,
      right: 800,
      bottom: 600,
      x: 0,
      y: 0,
      toJSON: () => ({}),
    } as any);

    vi.spyOn(Math, 'random').mockReturnValue(0.5);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('renders empty state when no characters are available', () => {
    mockUseProjectStore.mockReturnValue({
      currentProject: { lore: { characters: [] } },
      chapters: [],
    } as any);

    render(<KnowledgeGraph onSelectCharacter={vi.fn()} />);
    expect(screen.getByText('No Characters Found')).toBeInTheDocument();
  });

  it('renders a legend and truncates at 5 items', () => {
    mockUseProjectStore.mockReturnValue({
      currentProject: {
        lore: {
          characters: [
            { name: 'A' },
            { name: 'B' },
            { name: 'C' },
            { name: 'D' },
            { name: 'E' },
            { name: 'F' },
          ],
        },
      },
      chapters: [],
    } as any);

    render(<KnowledgeGraph onSelectCharacter={vi.fn()} />);
    expect(screen.getByText('Characters')).toBeInTheDocument();
    expect(screen.getByText('+1 more')).toBeInTheDocument();
  });

  it('selects a node on click and renders hovered link label on subsequent frame', () => {
    const onSelectCharacter = vi.fn();

    mockUseProjectStore.mockReturnValue({
      currentProject: {
        lore: {
          characters: [
            {
              name: 'Alice',
              relationships: [{ name: 'Bob', type: 'friend', dynamic: 'trusted' }],
            },
            {
              name: 'Bob',
              relationships: [{ name: 'Alice', type: 'friend', dynamic: 'trusted' }],
            },
          ],
        },
      },
      chapters: [],
    } as any);

    render(<KnowledgeGraph onSelectCharacter={onSelectCharacter} />);

    const canvas = document.querySelector('canvas') as HTMLCanvasElement;
    expect(canvas).toBeTruthy();

    fireEvent.mouseMove(canvas, { clientX: 400, clientY: 300 });
    expect(canvas.style.cursor).toBe('pointer');

    fireEvent.click(canvas, { clientX: 400, clientY: 300 });
    expect(onSelectCharacter).toHaveBeenCalledTimes(1);
    expect(onSelectCharacter.mock.calls[0][0].name).toBe('Alice');

    // Run one scheduled animation frame to exercise hover rendering branches.
    rafCallbacks.shift()?.(0);
    expect(
      ctx.fillText.mock.calls.some((call: any[]) => call[0] === 'friend'),
    ).toBe(true);
  });

  it('supports dragging a node without throwing', () => {
    mockUseProjectStore.mockReturnValue({
      currentProject: {
        lore: {
          characters: [{ name: 'Solo' }],
        },
      },
      chapters: [],
    } as any);

    render(<KnowledgeGraph onSelectCharacter={vi.fn()} />);
    const canvas = document.querySelector('canvas') as HTMLCanvasElement;

    fireEvent.mouseDown(canvas, { clientX: 400, clientY: 300 });
    fireEvent.mouseMove(canvas, { clientX: 420, clientY: 320 });
    fireEvent.mouseUp(canvas);
    fireEvent.mouseUp(window);
  });
});

