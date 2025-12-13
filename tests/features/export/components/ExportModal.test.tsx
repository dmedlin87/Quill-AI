import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ExportModal } from '@/features/export/components/ExportModal';
import { useProjectStore } from '@/features/project/store/useProjectStore';
import * as exportFormats from '@/features/export/utils/exportFormats';

// Mock dependencies
vi.mock('@/features/project/store/useProjectStore');
vi.mock('@/features/export/utils/exportFormats');

describe('ExportModal', () => {
  const mockOnClose = vi.fn();
  const mockGenerateExport = vi.mocked(exportFormats.generateExport);

  const mockProject = {
    id: '1',
    title: 'Test Novel',
    author: 'Test Author',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockChapters = [
    { id: 'c1', title: 'Chapter 1', content: 'Once upon a time...' },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    (useProjectStore as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      currentProject: mockProject,
      chapters: mockChapters,
    });
  });

  it('does not render when isOpen is false', () => {
    render(<ExportModal isOpen={false} onClose={mockOnClose} />);
    expect(screen.queryByText('Export Studio')).not.toBeInTheDocument();
  });

  it('renders correctly when open', () => {
    render(<ExportModal isOpen={true} onClose={mockOnClose} />);

    expect(screen.getByText('Export Studio')).toBeInTheDocument();

    // Check format buttons
    expect(screen.getByText('TXT')).toBeInTheDocument();
    expect(screen.getByText('Markdown')).toBeInTheDocument();
    expect(screen.getByText('DOCX')).toBeInTheDocument();
    expect(screen.getByText('PDF')).toBeInTheDocument();

    // Check options
    expect(screen.getByLabelText('Include Title Page')).toBeChecked();
    expect(screen.getByLabelText('Include Author Name')).toBeChecked();
    expect(screen.getByLabelText('Include Chapter Headers')).toBeChecked();

    // Check action buttons
    expect(screen.getByText('Cancel')).toBeInTheDocument();
    expect(screen.getByText('Download Export')).toBeInTheDocument();
  });

  it('updates format selection', () => {
    render(<ExportModal isOpen={true} onClose={mockOnClose} />);

    const docxButton = screen.getByRole('button', { name: /DOCX/i });
    fireEvent.click(docxButton);

    // We can verify class names for active state or check if internal logic flows
    // Since we don't have direct access to state, we'll verify it via the export call later
    // But checking visual feedback logic (class names) is brittle.
    // Let's rely on the final export call to verify state change.
  });

  it('calls generateExport with correct default parameters', async () => {
    render(<ExportModal isOpen={true} onClose={mockOnClose} />);

    const exportButton = screen.getByText('Download Export');
    fireEvent.click(exportButton);

    await waitFor(() => {
      expect(mockGenerateExport).toHaveBeenCalledWith(
        { title: mockProject.title, author: mockProject.author },
        mockChapters,
        {
          format: 'txt', // Default
          includeTitle: true,
          includeAuthor: true,
          includeChapterTitles: true,
        }
      );
    });

    expect(mockOnClose).toHaveBeenCalled();
  });

  it('calls generateExport with customized parameters', async () => {
    render(<ExportModal isOpen={true} onClose={mockOnClose} />);

    // Select DOCX
    fireEvent.click(screen.getByRole('button', { name: /DOCX/i }));

    // Uncheck "Include Title Page"
    fireEvent.click(screen.getByLabelText('Include Title Page'));

    const exportButton = screen.getByText('Download Export');
    fireEvent.click(exportButton);

    await waitFor(() => {
      expect(mockGenerateExport).toHaveBeenCalledWith(
        expect.objectContaining({ title: mockProject.title }),
        mockChapters,
        expect.objectContaining({
          format: 'docx',
          includeTitle: false,
        })
      );
    });
  });

  it('handles export failure gracefully', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {});

    mockGenerateExport.mockRejectedValue(new Error('Export failed'));

    render(<ExportModal isOpen={true} onClose={mockOnClose} />);

    fireEvent.click(screen.getByText('Download Export'));

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalled();
      expect(screen.getByRole('alert')).toHaveTextContent(/export failed/i);
    });

    expect(alertSpy).not.toHaveBeenCalled();

    // Should not close on error
    expect(mockOnClose).not.toHaveBeenCalled();

    consoleSpy.mockRestore();
    alertSpy.mockRestore();
  });

  it('closes when Cancel is clicked', () => {
    render(<ExportModal isOpen={true} onClose={mockOnClose} />);

    fireEvent.click(screen.getByText('Cancel'));
    expect(mockOnClose).toHaveBeenCalled();
  });
});
