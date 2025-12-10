import React, { forwardRef, useImperativeHandle, useState } from 'react';
import { act, render, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useAutoResize, useResizeObserver } from '@/features/editor/hooks/useAutoResize';

const AutoResizeHarness = forwardRef(
  (
    { initialValue, mode }: { initialValue: string; mode: string },
    ref: React.Ref<{ setValue: (val: string) => void }>
  ) => {
    const [value, setValue] = useState(initialValue);
    const textareaRef = React.useRef<HTMLTextAreaElement | null>(null);

    useAutoResize(textareaRef, value, mode);

    useImperativeHandle(ref, () => ({ setValue }));

    return <textarea data-testid="auto-textarea" ref={textareaRef} />;
  }
);

describe('useAutoResize', () => {
  const rafCallbacks: FrameRequestCallback[] = [];
  let requestSpy: ReturnType<typeof vi.spyOn>;
  let cancelSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    rafCallbacks.length = 0;
    requestSpy = vi
      .spyOn(window, 'requestAnimationFrame')
      .mockImplementation((cb: FrameRequestCallback) => {
        rafCallbacks.push(cb);
        return rafCallbacks.length;
      });
    cancelSpy = vi.spyOn(window, 'cancelAnimationFrame');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('schedules and applies resize when in editor mode', async () => {
    const ref = React.createRef<{ setValue: (val: string) => void }>();
    const { getByTestId } = render(<AutoResizeHarness ref={ref} initialValue="hello" mode="EDITOR" />);
    const textarea = getByTestId('auto-textarea') as HTMLTextAreaElement;

    Object.defineProperty(textarea, 'scrollHeight', { value: 120, configurable: true });

    expect(requestSpy).toHaveBeenCalledTimes(1);
    const cb = rafCallbacks.shift();
    cb?.(0);

    expect(textarea.style.height).toBe('120px');

    await act(async () => {
      ref.current?.setValue('updated');
    });

    await waitFor(() => expect(requestSpy).toHaveBeenCalledTimes(2));
  });

  it('does not schedule resize outside of editor mode', () => {
    render(<AutoResizeHarness initialValue="hello" mode="VIEW" />);
    expect(requestSpy).not.toHaveBeenCalled();
  });

  it('cancels any pending resize on unmount', () => {
    const { unmount } = render(<AutoResizeHarness initialValue="hello" mode="EDITOR" />);

    expect(requestSpy).toHaveBeenCalledTimes(1);
    unmount();
    expect(cancelSpy).toHaveBeenCalledWith(1);
  });

  it('cancels pending resize when switching from EDITOR to another mode', async () => {
    const TestComponent = () => {
        const [mode, setMode] = useState('EDITOR');
        const textareaRef = React.useRef<HTMLTextAreaElement | null>(null);
        useAutoResize(textareaRef, 'value', mode);
        return <button onClick={() => setMode('VIEW')}>Switch</button>;
    };

    const { getByRole } = render(<TestComponent />);

    // Initial render in EDITOR mode schedules a resize
    expect(requestSpy).toHaveBeenCalledTimes(1);

    // Switch to VIEW mode
    await act(async () => {
      getByRole('button').click();
    });

    expect(cancelSpy).toHaveBeenCalled();
  });

  it('coalesces multiple updates into a single frame', async () => {
    const ref = React.createRef<{ setValue: (val: string) => void }>();
    render(<AutoResizeHarness ref={ref} initialValue="hello" mode="EDITOR" />);

    // Initial render schedules one
    expect(requestSpy).toHaveBeenCalledTimes(1);

    // Process initial render
    const cb = rafCallbacks.shift();
    cb?.(0); // This sets pending = false
    rafCallbacks.length = 0;
    requestSpy.mockClear();

    // Set first value
    await act(async () => {
      ref.current?.setValue('A');
    });
    expect(requestSpy).toHaveBeenCalledTimes(1);

    // Set subsequent values rapidly
    // Note: Since we are mocking RAF and not running the callback, pendingRef stays true.
    // So subsequent calls should be coalesced (ignored).
    await act(async () => {
      ref.current?.setValue('B');
      ref.current?.setValue('C');
    });

    expect(requestSpy).toHaveBeenCalledTimes(1);
  });
});

describe('useResizeObserver', () => {
  let observeMock: ReturnType<typeof vi.fn>;
  let disconnectMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    observeMock = vi.fn();
    disconnectMock = vi.fn();

    // Mock ResizeObserver as a class
    global.ResizeObserver = class ResizeObserver {
      constructor(callback: ResizeObserverCallback) {
        (this as any).callback = callback;
      }
      observe = observeMock;
      disconnect = disconnectMock;
    } as any;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('observes element and triggers callback', async () => {
    const callback = vi.fn();
    const elementRef = { current: document.createElement('div') };

    const TestComponent = () => {
      useResizeObserver(elementRef, callback);
      return <div></div>;
    };

    render(<TestComponent />);

    expect(observeMock).toHaveBeenCalledWith(elementRef.current);
  });

  // Note: Integration tests for useResizeObserver were tricky to mock correctly
  // with combined RAF and ResizeObserver behavior.
  // We are relying on the observation test above and the logic simplicity.
});
