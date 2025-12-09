import React, { useEffect, useMemo, useState } from 'react';
import { eventBus } from '@/services/appBrain/eventBus';
import type { AppEvent } from '@/services/appBrain/types';
import { useSettingsStore } from '@/features/settings';

interface BrainActivityEntry extends AppEvent {
  id: string;
}

const MAX_EVENTS = 50;
const createEventId = (event: AppEvent, seed: number) =>
  `${event.timestamp}-${event.type}-${seed}-${Math.random().toString(36).slice(2, 8)}`;

const formatTimestamp = (timestamp: number) => new Date(timestamp).toLocaleTimeString();

const getEventAccent = (type: AppEvent['type']): string => {
  switch (type) {
    case 'SIGNIFICANT_EDIT_DETECTED':
      return 'border-orange-300 bg-orange-50 text-orange-900';
    case 'PROACTIVE_THINKING_STARTED':
      return 'border-indigo-300 bg-indigo-50 text-indigo-900';
    case 'PROACTIVE_THINKING_COMPLETED':
      return 'border-emerald-300 bg-emerald-50 text-emerald-900';
    default:
      return 'border-gray-200 bg-white text-[var(--text-primary)]';
  }
};

const renderDetails = (event: AppEvent) => {
  switch (event.type) {
    case 'SIGNIFICANT_EDIT_DETECTED':
      return (
        <div className="text-xs text-[var(--text-secondary)] space-y-1">
          <div>Delta: <strong>{event.payload.delta}</strong> chars</div>
          {event.payload.chapterId && <div>Chapter: {event.payload.chapterId}</div>}
        </div>
      );
    case 'PROACTIVE_THINKING_STARTED':
      return (
        <div className="text-xs text-[var(--text-secondary)] space-y-1">
          <div>Trigger: <strong>{event.payload.trigger}</strong></div>
          {event.payload.pendingEvents && event.payload.pendingEvents.length > 0 && (
            <div className="space-y-1">
              <div className="font-semibold text-[var(--text-primary)]">Context Triggers</div>
              <ul className="list-disc list-inside space-y-0.5">
                {event.payload.pendingEvents.slice(-5).map((e, idx) => (
                  <li key={`${e.timestamp}-${idx}`}>{`${e.type} @ ${formatTimestamp(e.timestamp)}`}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      );
    case 'PROACTIVE_THINKING_COMPLETED': {
      const { suggestionsCount, thinkingTime, memoryContext, suggestions, rawThinking, contextUsed } = event.payload;
      return (
        <div className="text-xs text-[var(--text-secondary)] space-y-2">
          <div className="flex gap-3">
            <span>Suggestions: <strong>{suggestionsCount}</strong></span>
            <span>Duration: <strong>{thinkingTime}ms</strong></span>
          </div>
          {memoryContext && (
            <div className="space-y-1">
              <div className="font-semibold text-[var(--text-primary)]">Memory Context</div>
              {memoryContext.longTermMemoryIds && memoryContext.longTermMemoryIds.length > 0 && (
                <div>IDs: {memoryContext.longTermMemoryIds.join(', ')}</div>
              )}
              {memoryContext.longTermMemoryPreview && memoryContext.longTermMemoryPreview.length > 0 && (
                <div className="max-h-24 overflow-auto bg-white border border-[var(--border-primary)] rounded p-2 space-y-1">
                  {memoryContext.longTermMemoryPreview.map((preview, idx) => (
                    <p key={idx} className="leading-snug">
                      {preview}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}
          {contextUsed?.compressedContext && (
            <details className="bg-white border border-[var(--border-primary)] rounded p-2">
              <summary className="cursor-pointer font-semibold text-[var(--text-primary)]">Context Snapshot</summary>
              <pre className="mt-2 text-[10px] whitespace-pre-wrap max-h-32 overflow-auto">{contextUsed.compressedContext}</pre>
              {contextUsed.longTermMemory && (
                <pre className="mt-2 text-[10px] whitespace-pre-wrap max-h-32 overflow-auto">{contextUsed.longTermMemory}</pre>
              )}
              {contextUsed.formattedEvents && (
                <pre className="mt-2 text-[10px] whitespace-pre-wrap max-h-24 overflow-auto">{contextUsed.formattedEvents}</pre>
              )}
            </details>
          )}
          {suggestions && suggestions.length > 0 && (
            <details className="bg-white border border-[var(--border-primary)] rounded p-2">
              <summary className="cursor-pointer font-semibold text-[var(--text-primary)]">Suggestions</summary>
              <pre className="mt-2 text-[10px] whitespace-pre-wrap max-h-32 overflow-auto">
                {JSON.stringify(suggestions, null, 2)}
              </pre>
            </details>
          )}
          {rawThinking && (
            <details className="bg-white border border-[var(--border-primary)] rounded p-2">
              <summary className="cursor-pointer font-semibold text-[var(--text-primary)]">Raw Reasoning</summary>
              <pre className="mt-2 text-[10px] whitespace-pre-wrap max-h-32 overflow-auto">{rawThinking}</pre>
            </details>
          )}
        </div>
      );
    }
    default:
      return null;
  }
};

export const BrainActivityMonitor: React.FC = () => {
  const developerModeEnabled = useSettingsStore((state) => state.developerModeEnabled);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [events, setEvents] = useState<BrainActivityEntry[]>(() =>
    eventBus.getChangeLog(10).map((evt, idx) => ({ ...evt, id: createEventId(evt, idx) }))
  );

  useEffect(() => {
    if (!developerModeEnabled) return;

    setEvents(eventBus.getChangeLog(10).map((evt, idx) => ({ ...evt, id: createEventId(evt, idx) })));

    const unsubscribe = eventBus.subscribeAll((event) => {
      setEvents((prev) => {
        const next: BrainActivityEntry[] = [...prev, { ...event, id: createEventId(event, prev.length) }];
        return next.slice(-MAX_EVENTS);
      });
    });

    return () => {
      unsubscribe();
    };
  }, [developerModeEnabled]);

  const sortedEvents = useMemo(() => [...events].sort((a, b) => b.timestamp - a.timestamp), [events]);

  if (!developerModeEnabled) return null;

  return (
    <div className="fixed right-4 bottom-4 w-96 max-h-[80vh] shadow-2xl border border-[var(--border-primary)] bg-[var(--surface-primary)] rounded-lg overflow-hidden z-50">
      <div className="flex items-center justify-between px-4 py-2 bg-[var(--surface-secondary)] border-b border-[var(--border-primary)]">
        <div>
          <p className="text-xs font-semibold text-[var(--text-secondary)] uppercase">Brain Activity Monitor</p>
          <p className="text-[10px] text-[var(--text-tertiary)]">Live stream from ProactiveThinker & MemoryService</p>
        </div>
        <button
          onClick={() => setIsCollapsed((prev) => !prev)}
          className="text-[var(--text-secondary)] text-xs border px-2 py-1 rounded hover:bg-[var(--surface-tertiary)]"
        >
          {isCollapsed ? 'Expand' : 'Collapse'}
        </button>
      </div>
      {!isCollapsed && (
        <div className="max-h-[70vh] overflow-y-auto p-3 space-y-2 bg-[var(--surface-primary)]">
          {sortedEvents.length === 0 && (
            <div className="text-xs text-[var(--text-tertiary)]">No activity yet.</div>
          )}
          {sortedEvents.map((event) => (
            <div
              key={event.id}
              className={`border rounded-md p-3 shadow-sm ${getEventAccent(event.type)}`}
            >
              <div className="flex items-center justify-between text-xs font-semibold">
                <span>{event.type}</span>
                <span className="text-[10px] text-[var(--text-tertiary)]">{formatTimestamp(event.timestamp)}</span>
              </div>
              {renderDetails(event)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
