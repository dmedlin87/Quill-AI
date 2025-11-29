import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { ProjectDashboard } from '@/features/project/components/ProjectDashboard';
import { parseManuscript } from '@/services/manuscriptParser';
import { useProjectStore } from '@/features/project/store/useProjectStore';

vi.mock('@/features/project/store/useProjectStore');
vi.mock('@/features/project/components/ImportWizard', () => ({
  ImportWizard: ({ initialChapters }: { initialChapters: unknown[] }) => (
    <div data-testid="import-wizard">Import Wizard ({initialChapters.length})</div>
  )
}));
vi.mock('@/services/manuscriptParser', () => ({
  parseManuscript: vi.fn(() => [
    { title: 'Chapter 1', content: 'First chapter' },
    { title: 'Chapter 2', content: 'Second chapter' },
  ]),
}));

const mockUseProjectStore = useProjectStore as unknown as vi.Mock;
const mockParseManuscript = parseManuscript as unknown as vi.Mock;

describe('ProjectDashboard', () => {
  beforeEach(() => {
    mockUseProjectStore.mockReset();
    mockParseManuscript.mockClear();
  });

  const baseStore = () => ({
    projects: [
      {
        id: 'p1',
        title: 'Mystery Novel',
        author: 'Author One',
        manuscriptIndex: { characters: {}, lastUpdated: {} },
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    ],
    loadProject: vi.fn(),
    createProject: vi.fn(() => Promise.resolve('new-id')),
    importProject: vi.fn(() => Promise.resolve('import-id')),
  });

  it('renders projects and loads on selection', () => {
    const store = baseStore();
    mockUseProjectStore.mockReturnValue(store);

    render(<ProjectDashboard />);

    expect(screen.getByText('Mystery Novel')).toBeInTheDocument();
    fireEvent.click(screen.getByText('Mystery Novel'));
    expect(store.loadProject).toHaveBeenCalledWith('p1');
  });

  it('creates a new project through the modal', async () => {
    const store = baseStore();
    mockUseProjectStore.mockReturnValue(store);

    render(<ProjectDashboard />);

    fireEvent.click(screen.getByText('Create New Novel'));
    const titleInput = await screen.findByPlaceholderText('e.g. The Winds of Winter');

    fireEvent.change(titleInput, { target: { value: 'New Saga' } });
    fireEvent.click(screen.getByText('Create Project'));

    await waitFor(() => {
      expect(store.createProject).toHaveBeenCalledWith('New Saga', 'Me', undefined);
    });
  });

  it('walks through the import workflow and shows the wizard', async () => {
    const store = baseStore();
    mockUseProjectStore.mockReturnValue(store);

    const originalText = File.prototype.text;
    const textMock = vi.fn().mockResolvedValue('chapter content');
    Object.defineProperty(File.prototype, 'text', { value: textMock, configurable: true });

    render(<ProjectDashboard />);

    const importButton = screen.getByText('Import Draft (.txt/.md)').closest('button');
    const fileInput = importButton?.parentElement?.querySelector('input[type="file"]');
    expect(fileInput).toBeInstanceOf(HTMLInputElement);

    const file = new File(['chapter content'], 'draft.txt', { type: 'text/plain' });
    fireEvent.change(fileInput as HTMLInputElement, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText('Import Draft Settings')).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText('Next: Review Chapters'));

    await waitFor(() => {
      expect(screen.getByTestId('import-wizard')).toBeInTheDocument();
    });
    expect(mockParseManuscript).toHaveBeenCalled();

    Object.defineProperty(File.prototype, 'text', { value: originalText ?? undefined, configurable: true });
  });
});
