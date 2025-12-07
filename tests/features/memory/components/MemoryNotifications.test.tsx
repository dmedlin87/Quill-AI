import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import {
  MemoryNotifications,
  type MemoryNotification,
} from '@/features/memory/components/MemoryNotifications';

describe('MemoryNotifications', () => {
  it('shows "No alerts" when notifications array is empty', () => {
    render(<MemoryNotifications notifications={[]} />);
    
    expect(screen.getByText('No alerts')).toBeInTheDocument();
  });

  it('renders notification titles', () => {
    const notifications: MemoryNotification[] = [
      { type: 'update', title: 'Memory Updated', description: 'Desc 1' },
      { type: 'conflict', title: 'Conflict Found', description: 'Desc 2' },
    ];
    
    render(<MemoryNotifications notifications={notifications} />);
    
    expect(screen.getByText('Memory Updated')).toBeInTheDocument();
    expect(screen.getByText('Conflict Found')).toBeInTheDocument();
  });

  it('includes description in title attribute', () => {
    const notifications: MemoryNotification[] = [
      { type: 'goal', title: 'Goal Alert', description: 'This is the description' },
    ];
    
    render(<MemoryNotifications notifications={notifications} />);
    
    const badge = screen.getByText('Goal Alert');
    expect(badge).toHaveAttribute('title', 'This is the description');
  });

  it('includes description in aria-label', () => {
    const notifications: MemoryNotification[] = [
      { type: 'update', title: 'Update', description: 'Full context' },
    ];
    
    render(<MemoryNotifications notifications={notifications} />);
    
    expect(screen.getByLabelText('Update: Full context')).toBeInTheDocument();
  });

  it('applies correct styling for each notification type', () => {
    const notifications: MemoryNotification[] = [
      { type: 'update', title: 'Update', description: '' },
      { type: 'conflict', title: 'Conflict', description: '' },
      { type: 'goal', title: 'Goal', description: '' },
    ];
    
    render(<MemoryNotifications notifications={notifications} />);
    
    const updateBadge = screen.getByText('Update');
    const conflictBadge = screen.getByText('Conflict');
    const goalBadge = screen.getByText('Goal');
    
    expect(updateBadge.className).toContain('surface-tertiary');
    expect(conflictBadge.className).toContain('error');
    expect(goalBadge.className).toContain('warning');
  });
});
