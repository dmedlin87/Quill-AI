import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { FileUpload } from '@/features/project/components/FileUpload';
import { MAX_UPLOAD_SIZE } from '@/config/security';

vi.mock('@/services/io/docxImporter', () => ({
  extractRawTextFromDocxArrayBuffer: vi.fn(async () => 'Extracted docx text'),
}));

import { extractRawTextFromDocxArrayBuffer } from '@/services/io/docxImporter';

describe('FileUpload', () => {
  const mockOnTextLoaded = vi.fn();

  beforeEach(() => {
    mockOnTextLoaded.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders upload area and textarea', () => {
    render(<FileUpload onTextLoaded={mockOnTextLoaded} />);
    
    expect(screen.getByText('Upload Manuscript')).toBeInTheDocument();
    expect(screen.getByText('Click to upload draft')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Paste text here...')).toBeInTheDocument();
  });

  it('handles .txt file upload', async () => {
    render(<FileUpload onTextLoaded={mockOnTextLoaded} />);
    
    const fileContent = 'Chapter 1\n\nThis is a test.';
    const file = new File([fileContent], 'manuscript.txt', { type: 'text/plain' });
    
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    
    // Mock file.text() method
    Object.defineProperty(file, 'text', {
      value: vi.fn().mockResolvedValue(fileContent),
    });
    
    fireEvent.change(input, { target: { files: [file] } });
    
    await waitFor(() => {
      expect(mockOnTextLoaded).toHaveBeenCalledWith(fileContent, 'manuscript.txt');
    });
  });

  it('handles .md file upload', async () => {
    render(<FileUpload onTextLoaded={mockOnTextLoaded} />);
    
    const fileContent = '# Chapter 1\n\nThis is markdown.';
    const file = new File([fileContent], 'manuscript.md', { type: 'text/plain' });
    
    Object.defineProperty(file, 'text', {
      value: vi.fn().mockResolvedValue(fileContent),
    });
    
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });
    
    await waitFor(() => {
      expect(mockOnTextLoaded).toHaveBeenCalledWith(fileContent, 'manuscript.md');
    });
  });

  it('rejects unsupported file types', async () => {
    render(<FileUpload onTextLoaded={mockOnTextLoaded} />);
    
    const file = new File(['data'], 'document.pdf', { type: 'application/pdf' });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    
    fireEvent.change(input, { target: { files: [file] } });
    
    await waitFor(() => {
      expect(screen.getByText('Unsupported file format. Please upload .txt, .md, or .docx.')).toBeInTheDocument();
    });
    expect(mockOnTextLoaded).not.toHaveBeenCalled();
  });

  it('handles .docx file upload', async () => {
    render(<FileUpload onTextLoaded={mockOnTextLoaded} />);

    const arrayBuffer = new ArrayBuffer(8);
    const file = new File([arrayBuffer], 'manuscript.docx', {
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    });

    Object.defineProperty(file, 'arrayBuffer', {
      value: vi.fn().mockResolvedValue(arrayBuffer),
    });

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(extractRawTextFromDocxArrayBuffer).toHaveBeenCalledWith(arrayBuffer);
      expect(mockOnTextLoaded).toHaveBeenCalledWith('Extracted docx text', 'manuscript.docx');
    });
  });

  it('handles pasted text in textarea', () => {
    render(<FileUpload onTextLoaded={mockOnTextLoaded} />);
    
    const textarea = screen.getByPlaceholderText('Paste text here...');
    fireEvent.change(textarea, { target: { value: 'Pasted content here' } });
    
    // Click the "Load pasted text" button to trigger onTextLoaded
    const loadButton = screen.getByText('Load pasted text');
    fireEvent.click(loadButton);
    
    expect(mockOnTextLoaded).toHaveBeenCalledWith('Pasted content here', 'Untitled Draft');
  });

  it('does not call onTextLoaded for empty textarea', () => {
    render(<FileUpload onTextLoaded={mockOnTextLoaded} />);
    
    const textarea = screen.getByPlaceholderText('Paste text here...');
    fireEvent.change(textarea, { target: { value: '' } });
    
    expect(mockOnTextLoaded).not.toHaveBeenCalled();
  });

  it('renders recent files when provided', () => {
    const recentFiles = [
      { name: 'Draft 1.txt', content: 'Content 1', timestamp: Date.now() - 86400000 },
      { name: 'Draft 2.md', content: 'Content 2', timestamp: Date.now() },
    ];
    
    render(<FileUpload onTextLoaded={mockOnTextLoaded} recentFiles={recentFiles} />);
    
    expect(screen.getByText('Recent Drafts')).toBeInTheDocument();
    expect(screen.getByText('Draft 1.txt')).toBeInTheDocument();
    expect(screen.getByText('Draft 2.md')).toBeInTheDocument();
  });

  it('loads recent file when clicked', () => {
    const recentFiles = [
      { name: 'Draft 1.txt', content: 'Content from draft 1', timestamp: Date.now() },
    ];
    
    const { getByText } = render(<FileUpload onTextLoaded={mockOnTextLoaded} recentFiles={recentFiles} />);
    
    fireEvent.click(getByText('Draft 1.txt'));
    
    expect(mockOnTextLoaded).toHaveBeenCalledWith('Content from draft 1', 'Draft 1.txt');
  });

  it('does not render recent files section when empty', () => {
    const { queryByText } = render(<FileUpload onTextLoaded={mockOnTextLoaded} recentFiles={[]} />);
    
    expect(queryByText('Recent Drafts')).not.toBeInTheDocument();
  });

  it('handles file read error gracefully', async () => {
    render(<FileUpload onTextLoaded={mockOnTextLoaded} />);
    
    const file = new File(['content'], 'test.txt', { type: 'text/plain' });
    
    Object.defineProperty(file, 'text', {
      value: vi.fn().mockRejectedValue(new Error('Read error')),
    });
    
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });
    
    await waitFor(() => {
      expect(screen.getByText('Could not read file. Please ensure it is a valid text document.')).toBeInTheDocument();
    });
  });

  it('ignores when no file is selected', () => {
    render(<FileUpload onTextLoaded={mockOnTextLoaded} />);
    
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [] } });
    
    expect(mockOnTextLoaded).not.toHaveBeenCalled();
  });

  it('rejects files exceeding MAX_UPLOAD_SIZE', async () => {
    render(<FileUpload onTextLoaded={mockOnTextLoaded} />);

    const fileSize = MAX_UPLOAD_SIZE + 1024; // Exceed limit
    const file = {
      name: 'large_file.txt',
      type: 'text/plain',
      size: fileSize,
      text: vi.fn(),
      arrayBuffer: vi.fn(),
    } as unknown as File; // Mocking a large file

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    // We need to bypass the read-only file input restriction for testing
    // or just mock the event
    fireEvent.change(input, { target: { files: [file] } });

    await waitFor(() => {
      expect(screen.getByText(`File too large. Max size is ${MAX_UPLOAD_SIZE / 1024 / 1024}MB.`)).toBeInTheDocument();
    });
    expect(mockOnTextLoaded).not.toHaveBeenCalled();
    // Ensure file.text() was NOT called
    expect(file.text).not.toHaveBeenCalled();
  });
});
