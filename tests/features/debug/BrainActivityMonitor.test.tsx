import React from 'react';
import { render, screen, act, within } from '@testing-library/react';
import { vi, describe, it, beforeEach, afterEach, expect } from 'vitest';
import { BrainActivityMonitor } from '@/features/debug/components/BrainActivityMonitor';
import { useSettingsStore } from '@/features/settings';
import { eventBus } from '@/services/appBrain/eventBus';

vi.mock('@/features/settings', () => ({
  useSettingsStore: vi.fn(),
}));

vi.mock('@/services/appBrain/eventBus', () => ({
  eventBus: {
    getChangeLog: vi.fn(() => []),
    subscribeAll: vi.fn(() => vi.fn()),
  },
}));

const mockedSettings = vi.mocked(useSettingsStore);
const mockedEventBus = vi.mocked(eventBus as any);

describe('BrainActivityMonitor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Clean up any globals if needed
  });

  it('renders nothing when developer mode is disabled', () => {
    mockedSettings.mockImplementation((selector: any) => selector({ developerModeEnabled: false }));

    const { container } = render(<BrainActivityMonitor />);

    expect(container.firstChild).toBeNull();
    expect(mockedEventBus.getChangeLog).not.toHaveBeenCalled();
    expect(mockedEventBus.subscribeAll).not.toHaveBeenCalled();
  });

  it('subscribes to event bus and renders incoming events when developer mode is enabled', () => {
    const baseEvent = {
      type: 'SIGNIFICANT_EDIT_DETECTED',
      timestamp: Date.now(),
      payload: { delta: 42, chapterId: 'ch-1' },
    } as any;

    mockedSettings.mockImplementation((selector: any) => selector({ developerModeEnabled: true }));
    mockedEventBus.getChangeLog.mockReturnValue([baseEvent]);

    let globalHandler: ((event: any) => void) | undefined;
    mockedEventBus.subscribeAll.mockImplementation((handler: any) => {
      globalHandler = handler;
      return vi.fn();
    });

    render(<BrainActivityMonitor />);

    expect(screen.getByText('Brain Activity Monitor')).toBeInTheDocument();
    expect(screen.getByText('SIGNIFICANT_EDIT_DETECTED')).toBeInTheDocument();

    // Simulate a new event flowing through the bus
    const newEvent = {
      ...baseEvent,
      timestamp: baseEvent.timestamp + 1000,
      payload: { delta: 100, chapterId: 'ch-2' },
    };

    act(() => {
      globalHandler?.(newEvent);
    });

    // We should now see both the original event and the new one; assert via chapter id
    expect(screen.getAllByText('SIGNIFICANT_EDIT_DETECTED').length).toBeGreaterThanOrEqual(1);
    const eventCard = screen.getByText(/Chapter:\s*ch-2/i).closest('div[class*="border"]');
    expect(eventCard).toBeTruthy();
    expect(within(eventCard!).getByText(/Delta:/)).toBeInTheDocument();
    expect(within(eventCard!).getByText('100')).toBeInTheDocument();
  });
});
