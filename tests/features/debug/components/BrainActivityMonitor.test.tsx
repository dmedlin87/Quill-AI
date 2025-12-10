
import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BrainActivityMonitor } from '@/features/debug/components/BrainActivityMonitor';
import { eventBus } from '@/services/appBrain/eventBus';
import { useSettingsStore } from '@/features/settings';
import type { AppEvent } from '@/services/appBrain/types';

// Mock dependencies
vi.mock('@/features/settings', () => ({
  useSettingsStore: vi.fn(),
}));

// Mock EventBus
vi.mock('@/services/appBrain/eventBus', () => ({
  eventBus: {
    getChangeLog: vi.fn(),
    subscribeAll: vi.fn(),
  },
}));

describe('BrainActivityMonitor', () => {
  const mockSubscribeAll = vi.fn();
  const mockGetChangeLog = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (eventBus.getChangeLog as any).mockImplementation(mockGetChangeLog);
    (eventBus.subscribeAll as any).mockImplementation(mockSubscribeAll);

    // Default mocks
    mockGetChangeLog.mockReturnValue([]);
    mockSubscribeAll.mockReturnValue(() => {});

    // Default settings: developerModeEnabled = true
    (useSettingsStore as any).mockImplementation((selector: any) =>
      selector({ developerModeEnabled: true })
    );
  });

  it('renders nothing when developer mode is disabled', () => {
    (useSettingsStore as any).mockImplementation((selector: any) =>
      selector({ developerModeEnabled: false })
    );

    const { container } = render(<BrainActivityMonitor />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders monitor when developer mode is enabled', () => {
    render(<BrainActivityMonitor />);
    expect(screen.getByText('Brain Activity Monitor')).toBeInTheDocument();
  });

  it('initializes with existing events from eventBus', () => {
    const mockEvents: AppEvent[] = [
      { type: 'SIGNIFICANT_EDIT_DETECTED', timestamp: 1000, payload: { delta: 10, chapterId: 'ch1' } }
    ];
    mockGetChangeLog.mockReturnValue(mockEvents);

    render(<BrainActivityMonitor />);

    expect(screen.getByText('SIGNIFICANT_EDIT_DETECTED')).toBeInTheDocument();
  });

  it('subscribes to eventBus on mount', () => {
    render(<BrainActivityMonitor />);
    expect(mockSubscribeAll).toHaveBeenCalled();
  });

  it('updates when new events arrive', () => {
    let subscriberCallback: (event: AppEvent) => void;
    mockSubscribeAll.mockImplementation((cb) => {
      subscriberCallback = cb;
      return () => {};
    });

    render(<BrainActivityMonitor />);

    expect(screen.queryByText('PROACTIVE_THINKING_STARTED')).not.toBeInTheDocument();

    act(() => {
      if (subscriberCallback) {
        subscriberCallback({
          type: 'PROACTIVE_THINKING_STARTED',
          timestamp: 2000,
          payload: { trigger: 'edit' }
        });
      }
    });

    expect(screen.getByText('PROACTIVE_THINKING_STARTED')).toBeInTheDocument();
  });

  it('toggles collapse state', () => {
    render(<BrainActivityMonitor />);

    const collapseButton = screen.getByText('Collapse');
    fireEvent.click(collapseButton);

    expect(screen.getByText('Expand')).toBeInTheDocument();
    expect(screen.queryByText('Live stream from ProactiveThinker & MemoryService')).toBeInTheDocument();
    // The list container should be gone
    expect(screen.queryByText('No activity yet.')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText('Expand'));
    expect(screen.getByText('Collapse')).toBeInTheDocument();
  });

  describe('Event Details Rendering', () => {
    it('renders SIGNIFICANT_EDIT_DETECTED details', () => {
        const events: AppEvent[] = [{
            type: 'SIGNIFICANT_EDIT_DETECTED',
            timestamp: 1000,
            payload: { delta: 100, chapterId: 'ch1' }
        }];
        mockGetChangeLog.mockReturnValue(events);

        render(<BrainActivityMonitor />);

        // Use text matchers that are more resilient to HTML structure
        expect(screen.getByText((content, element) => {
            return element?.textContent === 'Delta: 100 chars';
        })).toBeInTheDocument();

        expect(screen.getByText((content, element) => {
            return element?.textContent === 'Chapter: ch1';
        })).toBeInTheDocument();
    });

    it('renders PROACTIVE_THINKING_STARTED details', () => {
        const events: AppEvent[] = [{
            type: 'PROACTIVE_THINKING_STARTED',
            timestamp: 1000,
            payload: {
                trigger: 'manual',
                pendingEvents: [{ type: 'TEST_EVENT', timestamp: 900 }]
            }
        }];
        mockGetChangeLog.mockReturnValue(events);

        render(<BrainActivityMonitor />);

        expect(screen.getByText('Trigger:')).toBeInTheDocument();
        expect(screen.getByText('manual')).toBeInTheDocument();
        expect(screen.getByText('Context Triggers')).toBeInTheDocument();
    });

    it('renders PROACTIVE_THINKING_COMPLETED details', () => {
        const events: AppEvent[] = [{
            type: 'PROACTIVE_THINKING_COMPLETED',
            timestamp: 1000,
            payload: {
                suggestionsCount: 2,
                thinkingTime: 500,
                memoryContext: {
                    longTermMemoryIds: ['mem1'],
                    longTermMemoryPreview: ['preview1']
                },
                contextUsed: {
                    compressedContext: 'compressed',
                    longTermMemory: 'ltm',
                    formattedEvents: 'events'
                },
                suggestions: [{ id: 'sug1' }],
                rawThinking: 'thinking process'
            }
        }];
        mockGetChangeLog.mockReturnValue(events);

        render(<BrainActivityMonitor />);

        expect(screen.getByText('Suggestions:')).toBeInTheDocument();
        expect(screen.getByText('2')).toBeInTheDocument();
        expect(screen.getByText('Duration:')).toBeInTheDocument();
        expect(screen.getByText('500ms')).toBeInTheDocument();

        expect(screen.getByText('Memory Context')).toBeInTheDocument();
        expect(screen.getByText('IDs: mem1')).toBeInTheDocument();
        expect(screen.getByText('preview1')).toBeInTheDocument();

        expect(screen.getByText('Context Snapshot')).toBeInTheDocument();
        expect(screen.getByText('Suggestions')).toBeInTheDocument();
        expect(screen.getByText('Raw Reasoning')).toBeInTheDocument();
    });
  });
});
