import React from 'react';
import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';

// Mock ProjectDashboard
vi.mock('@/features/project', () => ({
  ProjectDashboard: () => <div data-testid="project-dashboard">Project Dashboard</div>,
}));

import { UploadLayout } from '@/features/layout/UploadLayout';

describe('UploadLayout', () => {
  it('renders the ProjectDashboard component', () => {
    render(<UploadLayout />);
    
    expect(screen.getByTestId('project-dashboard')).toBeInTheDocument();
  });

  it('has correct container styling', () => {
    const { container } = render(<UploadLayout />);
    const wrapper = container.firstChild as HTMLElement;
    
    expect(wrapper).toHaveClass('flex', 'h-screen', 'w-full');
  });
});
