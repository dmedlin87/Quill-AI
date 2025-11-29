import { describe, it, expect, vi, beforeEach } from 'vitest';

const renderMock = vi.fn();
const createRootMock = vi.fn(() => ({ render: renderMock }));

vi.mock('react-dom/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-dom/client')>();
  return {
    ...actual,
    // React 18 entrypoint imports the default export as ReactDOM
    default: {
      ...(actual as any).default,
      createRoot: createRootMock,
    },
  };
});

vi.mock('@/App', () => ({
  default: () => null,
}));

describe('index entrypoint', () => {
  beforeEach(() => {
    vi.resetModules();
    document.body.innerHTML = '<div id="root"></div>';
    renderMock.mockClear();
    createRootMock.mockClear();
  });

  it('mounts App into #root using ReactDOM.createRoot', async () => {
    await import('@/index.tsx');

    const rootElement = document.getElementById('root');
    expect(createRootMock).toHaveBeenCalledTimes(1);
    expect(createRootMock).toHaveBeenCalledWith(rootElement);
    expect(renderMock).toHaveBeenCalledTimes(1);
  });

  it('throws when the root element is missing', async () => {
    const originalGetElementById = document.getElementById;
    const getElementByIdMock = vi
      .fn<typeof document.getElementById>()
      .mockReturnValue(null);

    (document.getElementById as typeof document.getElementById) = getElementByIdMock;

    try {
      await expect(import('@/index.tsx')).rejects.toThrowError(
        'Could not find root element to mount to',
      );
    } finally {
      document.getElementById = originalGetElementById;
    }
  });
});
