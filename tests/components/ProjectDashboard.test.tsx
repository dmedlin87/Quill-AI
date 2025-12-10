import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, type Mock } from 'vitest';
import { ProjectDashboard } from '@/features/project/components/ProjectDashboard';
import { parseManuscript } from '@/services/manuscriptParser';
import { useProjectStore } from '@/features/project/store/useProjectStore';

vi.mock('@/features/project/store/useProjectStore');
vi.mock('@/features/project/components/ImportWizard', () => ({
  ImportWizard: ({ initialChapters, onConfirm }: any) => (
    <div>
      <div data-testid="import-wizard">Import Wizard ({initialChapters.length})</div>
      <button
        type="button"
        data-testid="confirm-import"
        onClick={() => onConfirm(initialChapters)}
      >
        Confirm Import
      </button>
    </div>
  )
}));
vi.mock('@/services/manuscriptParser', () => ({
  parseManuscript: vi.fn(() => [
    { title: 'Chapter 1', content: 'First chapter' },
    { title: 'Chapter 2', content: 'Second chapter' },
  ]),
}));

const mockUseProjectStore = useProjectStore as unknown as Mock;
const mockParseManuscript = parseManuscript as unknown as Mock;

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

  it('renders an empty shelf state when there are no projects', () => {
    const store = {
      ...baseStore(),
      projects: [],
    };
    mockUseProjectStore.mockReturnValue(store);

    render(<ProjectDashboard />);

    // Library header and primary actions are still available
    expect(screen.getByText('Quill AI Library')).toBeInTheDocument();
    expect(screen.getByText('New Novel')).toBeInTheDocument();
    expect(screen.getByText('Import Draft')).toBeInTheDocument();
    // No existing project cards rendered
    expect(screen.queryByText('Mystery Novel')).not.toBeInTheDocument();
  });

  it('creates a new project through the modal', async () => {
    const store = baseStore();
    mockUseProjectStore.mockReturnValue(store);

    render(<ProjectDashboard />);

    fireEvent.click(screen.getByText('New Novel'));
    const titleInput = await screen.findByPlaceholderText('e.g. The Winds of Winter');

    fireEvent.change(titleInput, { target: { value: 'New Saga' } });
    fireEvent.click(screen.getByText('Create Project'));

    await waitFor(() => {
      expect(store.createProject).toHaveBeenCalledWith('New Saga', 'Me', undefined);
    });
  });

  it('shows a working state while creating a project', async () => {
    const store = baseStore();
    const pending = new Promise<string>(() => {});
    store.createProject = vi.fn(() => pending);
    mockUseProjectStore.mockReturnValue(store);

    render(<ProjectDashboard />);

    fireEvent.click(screen.getByText('New Novel'));
    const titleInput = await screen.findByPlaceholderText('e.g. The Winds of Winter');

    fireEvent.change(titleInput, { target: { value: 'Long Running Project' } });

    const submitButton = screen.getByText('Create Project').closest('button');
    if (!submitButton) throw new Error('Create button not found');

    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(submitButton).toBeDisabled();
      expect(submitButton).toHaveTextContent('Working...');
    });
  });

  it('walks through the import workflow and shows the wizard', async () => {
    const store = baseStore();
    mockUseProjectStore.mockReturnValue(store);

    const originalText = File.prototype.text;
    const textMock = vi.fn().mockResolvedValue('chapter content');
    Object.defineProperty(File.prototype, 'text', { value: textMock, configurable: true });

    render(<ProjectDashboard />);

    const importButton = screen.getByText('Import Draft').closest('button');
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

  it('renders setting badge when project has setting', () => {
    const base = baseStore();
    const store = {
      ...base,
      projects: [
        {
          ...base.projects[0],
          setting: {
            timePeriod: '1890s',
            location: 'London',
          },
        },
      ],
    };
    mockUseProjectStore.mockReturnValue(store);

    render(<ProjectDashboard />);

    expect(screen.getByText('1890s • London')).toBeInTheDocument();
  });

  it('creates a new project with setting from modal inputs', async () => {
    const store = baseStore();
    mockUseProjectStore.mockReturnValue(store);

    render(<ProjectDashboard />);

    fireEvent.click(screen.getByText('New Novel'));
    const titleInput = await screen.findByPlaceholderText('e.g. The Winds of Winter');
    const timeInput = screen.getByPlaceholderText('e.g. 1890s, 2050');
    const locationInput = screen.getByPlaceholderText('e.g. London, Mars');

    fireEvent.change(titleInput, { target: { value: 'Historical Epic' } });
    fireEvent.change(timeInput, { target: { value: '1890s' } });
    fireEvent.change(locationInput, { target: { value: 'London' } });

    fireEvent.click(screen.getByText('Create Project'));

    await waitFor(() => {
      expect(store.createProject).toHaveBeenCalledWith(
        'Historical Epic',
        'Me',
        { timePeriod: '1890s', location: 'London' },
      );
    });
  });

  it('ignores file selection when no file is provided', async () => {
    const store = baseStore();
    mockUseProjectStore.mockReturnValue(store);

    render(<ProjectDashboard />);

    const importButton = screen.getByText('Import Draft').closest('button');
    const fileInput = importButton?.parentElement?.querySelector('input[type="file"]') as HTMLInputElement;

    fireEvent.change(fileInput, { target: { files: [] } });

    await waitFor(() => {
      expect(screen.queryByText('Import Draft Settings')).not.toBeInTheDocument();
    });
  });

  it('handles file reading failure gracefully', async () => {
    const store = baseStore();
    mockUseProjectStore.mockReturnValue(store);

    const originalText = File.prototype.text;
    const failingText = vi.fn().mockRejectedValue(new Error('fail'));
    Object.defineProperty(File.prototype, 'text', { value: failingText, configurable: true });

    render(<ProjectDashboard />);

    const importButton = screen.getByText('Import Draft').closest('button');
    const fileInput = importButton?.parentElement?.querySelector('input[type="file"]') as HTMLInputElement;

    const file = new File(['content'], 'broken.txt', { type: 'text/plain' });
    fireEvent.change(fileInput, { target: { files: [file] } });

    // When file read fails, error state is set but modal doesn't open
    // Verify the modal isn't opened (success path opens modal)
    await waitFor(() => {
      expect(screen.queryByText('Import Draft Settings')).not.toBeInTheDocument();
    });

    // Verify file.text was called and rejected
    expect(failingText).toHaveBeenCalled();

    Object.defineProperty(File.prototype, 'text', { value: originalText ?? undefined, configurable: true });
  });

  it('imports project with settings when confirming wizard', async () => {
    const store = baseStore();
    mockUseProjectStore.mockReturnValue(store);

    const originalText = File.prototype.text;
    const textMock = vi.fn().mockResolvedValue('chapter content');
    Object.defineProperty(File.prototype, 'text', { value: textMock, configurable: true });

    render(<ProjectDashboard />);

    const importButton = screen.getByText('Import Draft').closest('button');
    const fileInput = importButton?.parentElement?.querySelector('input[type="file"]') as HTMLInputElement;

    const file = new File(['chapter content'], 'space-odyssey.txt', { type: 'text/plain' });
    fireEvent.change(fileInput, { target: { files: [file] } });

    const titleInput = await screen.findByPlaceholderText('e.g. The Winds of Winter');
    const timeInput = screen.getByPlaceholderText('e.g. 1890s, 2050');
    const locationInput = screen.getByPlaceholderText('e.g. London, Mars');

    fireEvent.change(titleInput, { target: { value: 'Space Odyssey' } });
    fireEvent.change(timeInput, { target: { value: '2050' } });
    fireEvent.change(locationInput, { target: { value: 'Mars' } });

    fireEvent.click(screen.getByText('Next: Review Chapters'));

    await waitFor(() => {
      expect(screen.getByTestId('import-wizard')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('confirm-import'));

    await waitFor(() => {
      expect(store.importProject).toHaveBeenCalledWith(
        'Space Odyssey',
        [
          { title: 'Chapter 1', content: 'First chapter' },
          { title: 'Chapter 2', content: 'Second chapter' },
        ],
        'Me',
        { timePeriod: '2050', location: 'Mars' },
      );
    });

    Object.defineProperty(File.prototype, 'text', { value: originalText ?? undefined, configurable: true });
  });
});
