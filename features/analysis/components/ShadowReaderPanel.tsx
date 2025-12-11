import React, { useState } from 'react';
import { useReaderStore } from '../readerStore';
import { DEFAULT_READERS } from '@/types/personas';
import { useEditorState, useEditorActions } from '@/features/core/context/EditorContext';
import { findQuoteRange } from '@/features/shared';
import { InlineComment } from '@/types/schema';
import { AccessibleTooltip } from '@/features/shared/components/AccessibleTooltip';

export const ShadowReaderPanel: React.FC = () => {
  const { activePersona, setActivePersona, isReading, generateReactions, reactions } = useReaderStore();
  const { currentText, inlineComments } = useEditorState();
  const { setInlineComments } = useEditorActions();
  const [addingId, setAddingId] = useState<string | null>(null);

  const handleRead = () => {
    generateReactions(currentText);
  };

  const handleAddComment = (reaction: any) => {
    if (!reaction.quote || !reaction.issue) return;

    setAddingId(reaction.id);

    // Slight delay to show loading state if desired, or just immediate
    const range = findQuoteRange(currentText, reaction.quote);

    if (!range) {
        console.warn('Could not find quote range for reaction:', reaction.quote);
        setAddingId(null);
        return;
    }

    const newComment: InlineComment = {
        id: crypto.randomUUID(),
        type: 'prose', // Generic type for reader reactions
        issue: `${activePersona.name} says: ${reaction.issue}`,
        suggestion: '',
        severity: reaction.severity === 'error' ? 'error' : reaction.severity === 'info' ? 'info' : 'warning',
        quote: reaction.quote,
        startIndex: range.start,
        endIndex: range.end,
        dismissed: false,
        createdAt: Date.now()
    };

    setInlineComments([...inlineComments, newComment]);
    setAddingId(null);
  };

  return (
    <div className="flex flex-col h-full bg-[var(--parchment-50)] border-l border-[var(--ink-100)] w-80 shrink-0">
      {/* Header */}
      <div className="p-4 border-b border-[var(--ink-100)]">
        <h2 className="font-serif text-lg font-bold text-[var(--ink-900)] flex items-center gap-2">
          <span>👥</span> Shadow Reader
        </h2>
        <p className="text-xs text-[var(--ink-500)] mt-1">
          Simulate how different readers experience your story.
        </p>
      </div>

      {/* Persona Selector */}
      <div className="p-4 border-b border-[var(--ink-100)] bg-white/50">
        <label className="text-xs font-bold text-[var(--ink-400)] uppercase tracking-wider mb-2 block">
          Select Reader
        </label>
        <div className="flex gap-2 overflow-x-auto pb-2">
          {DEFAULT_READERS.map(persona => (
            <button
              key={persona.id}
              onClick={() => setActivePersona(persona.id)}
              className={`flex flex-col items-center p-2 rounded-lg border min-w-[80px] transition-all ${
                activePersona.id === persona.id
                  ? 'bg-[var(--magic-5)] border-[var(--magic-300)] ring-1 ring-[var(--magic-300)]'
                  : 'bg-white border-[var(--ink-200)] hover:border-[var(--ink-400)]'
              }`}
            >
              <span className="text-2xl mb-1" role="img" aria-label={persona.name}>
                {persona.icon}
              </span>
              <span className="text-[10px] font-medium text-center leading-tight">
                {persona.name}
              </span>
            </button>
          ))}
        </div>
        <div className="mt-3 text-sm text-[var(--ink-700)] bg-[var(--parchment-100)] p-3 rounded border border-[var(--ink-100)]">
          <strong className="block mb-1 font-semibold">{activePersona.role}</strong>
          {activePersona.description}
        </div>
      </div>

      {/* Action Area */}
      <div className="p-4 flex justify-center">
        <AccessibleTooltip
          content={!currentText ? "Text content required" : isReading ? "Reading..." : "Generate AI reader feedback"}
          position="top"
        >
          <div className="w-full"> {/* Wrapper for disabled tooltip */}
            <button
              onClick={handleRead}
              disabled={isReading || !currentText}
              className="w-full py-2 px-4 bg-[var(--ink-900)] text-white rounded-lg font-medium shadow-sm hover:bg-[var(--ink-800)] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 transition-all"
            >
              {isReading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Reading...
                </>
              ) : (
                <>
                  <span>👓</span> Read Chapter
                </>
              )}
            </button>
          </div>
        </AccessibleTooltip>
      </div>

      {/* Reactions List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {reactions.length === 0 ? (
          <div className="text-center text-[var(--ink-400)] text-sm py-10">
            Select a persona and click "Read Chapter" to get reactions.
          </div>
        ) : (
          reactions.map((reaction) => (
            <div
              key={reaction.id}
              className={`p-3 rounded-lg border text-sm animate-fade-in ${
                reaction.severity === 'error'
                  ? 'bg-red-50 border-red-100 text-red-900'
                  : reaction.severity === 'info'
                  ? 'bg-green-50 border-green-100 text-green-900'
                  : 'bg-yellow-50 border-yellow-100 text-yellow-900'
              }`}
            >
              <div className="font-bold mb-1 flex justify-between">
                <span>{activePersona.name}</span>
                <span className="opacity-50 text-xs">
                  {reaction.severity === 'error' ? '😠' : reaction.severity === 'info' ? '😍' : '🤔'}
                </span>
              </div>
              <p className="mb-2">{reaction.issue}</p>
              {reaction.quote && (
                <>
                    <div className="text-xs opacity-70 border-l-2 border-black/10 pl-2 italic truncate mb-2">
                    "{reaction.quote}"
                    </div>
                    <button
                        onClick={() => handleAddComment(reaction)}
                        disabled={addingId === reaction.id}
                        className="text-xs flex items-center gap-1 text-[var(--interactive-accent)] hover:underline disabled:opacity-50"
                    >
                        {addingId === reaction.id ? 'Adding...' : '➕ Add as Comment'}
                    </button>
                </>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};
