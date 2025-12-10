import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';
import { AnalysisPanel } from '@/features/analysis/components/AnalysisPanel';
import * as keyConfig from '@/config/api';

// Mock the API config module
vi.mock('@/config/api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/config/api')>();
  return {
    ...actual,
    isApiConfigured: vi.fn(),
  };
});

// Mock framer-motion to avoid JSDOM issues
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
    span: ({ children, ...props }: any) => <span {...props}>{children}</span>,
    p: ({ children, ...props }: any) => <p {...props}>{children}</p>,
  },
  AnimatePresence: ({ children }: any) => <>{children}</>,
}));

describe('API Key Handling', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('AnalysisPanel', () => {
    it('shows warning banner when API key is missing', () => {
      // Mock API key as missing
      vi.mocked(keyConfig.isApiConfigured).mockReturnValue(false);

      render(
        <AnalysisPanel 
          analysis={null} 
          isLoading={false}
          currentText=""
          onNavigate={vi.fn()}
          onFixRequest={vi.fn()}
          onAnalyzeSelection={vi.fn()}
          hasSelection={false}
        />
      );

      expect(screen.getByText('API Key Missing')).toBeInTheDocument();
      expect(screen.getByText(/Gemini API key is not configured/)).toBeInTheDocument();
    });

    it('does not show warning banner when API key is present', () => {
      // Mock API key as present
      vi.mocked(keyConfig.isApiConfigured).mockReturnValue(true);

      render(
        <AnalysisPanel 
          analysis={null} 
          isLoading={false}
          currentText=""
          onNavigate={vi.fn()}
          onFixRequest={vi.fn()}
          onAnalyzeSelection={vi.fn()}
          hasSelection={false}
        />
      );

      expect(screen.queryByText('API Key Missing')).not.toBeInTheDocument();
    });
  });
});
