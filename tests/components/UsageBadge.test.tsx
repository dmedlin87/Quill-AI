import React from 'react';
import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';

// Mock useUsage hook
const mockUseUsage = vi.fn();
vi.mock('@/features/shared/context/UsageContext', () => ({
  useUsage: () => mockUseUsage(),
}));

import { UsageBadge } from '@/features/shared/components/UsageBadge';

describe('UsageBadge', () => {
  beforeEach(() => {
    mockUseUsage.mockClear();
  });

  it('returns null when totalRequestCount is 0', () => {
    mockUseUsage.mockReturnValue({
      promptTokens: 0,
      responseTokens: 0,
      totalRequestCount: 0,
    });
    
    const { container } = render(<UsageBadge />);
    
    expect(container.firstChild).toBeNull();
  });

  it('displays total tokens when there are requests', () => {
    mockUseUsage.mockReturnValue({
      promptTokens: 1000,
      responseTokens: 500,
      totalRequestCount: 3,
    });
    
    render(<UsageBadge />);
    
    expect(screen.getByText('1,500 tokens')).toBeInTheDocument();
  });

  it('shows tooltip with breakdown on hover', () => {
    mockUseUsage.mockReturnValue({
      promptTokens: 2500,
      responseTokens: 1200,
      totalRequestCount: 5,
    });
    
    render(<UsageBadge />);
    
    // Tooltip content should be in DOM (even if hidden by CSS)
    expect(screen.getByText('Input:')).toBeInTheDocument();
    expect(screen.getByText('2,500')).toBeInTheDocument();
    expect(screen.getByText('Output:')).toBeInTheDocument();
    expect(screen.getByText('1,200')).toBeInTheDocument();
    expect(screen.getByText('Requests:')).toBeInTheDocument();
    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('formats large numbers with locale string', () => {
    mockUseUsage.mockReturnValue({
      promptTokens: 10000,
      responseTokens: 5000,
      totalRequestCount: 10,
    });
    
    render(<UsageBadge />);
    
    expect(screen.getByText('15,000 tokens')).toBeInTheDocument();
  });
});
