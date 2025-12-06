/**
 * PersonaSelector - Agent Persona Switcher for Quill AI 3.0
 * 
 * Allows users to select which AI persona provides feedback.
 */

import React, { useState, useRef, useEffect } from 'react';
import { Persona, DEFAULT_PERSONAS } from '@/types/personas';

interface PersonaSelectorProps {
  currentPersona: Persona;
  onSelectPersona: (persona: Persona) => void;
  compact?: boolean;
}

export const PersonaSelector: React.FC<PersonaSelectorProps> = ({
  currentPersona,
  onSelectPersona,
  compact = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close on click outside (only when compact dropdown is open)
  useEffect(() => {
    if (!compact || !isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [compact, isOpen]);

  // Close on escape (only when compact dropdown is open)
  useEffect(() => {
    if (!compact || !isOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [compact, isOpen]);

  if (compact) {
    return (
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-2 px-3 py-1.5 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-lg transition-colors"
          title={`Current: ${currentPersona.name}`}
        >
          <span className="text-lg">{currentPersona.icon}</span>
          <span className="text-sm font-medium text-gray-700">{currentPersona.name}</span>
          <svg
            className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {isOpen && (
          <div className="absolute top-full left-0 mt-1 w-64 bg-white rounded-lg shadow-xl border border-gray-200 py-1 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
            {DEFAULT_PERSONAS.map(persona => (
              <button
                key={persona.id}
                onClick={() => {
                  onSelectPersona(persona);
                  setIsOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-3 py-2 hover:bg-gray-50 transition-colors ${
                  persona.id === currentPersona.id ? 'bg-indigo-50' : ''
                }`}
              >
                <span className="text-xl">{persona.icon}</span>
                <div className="flex-1 text-left">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-800 text-sm">{persona.name}</span>
                    {persona.id === currentPersona.id && (
                      <svg className="w-4 h-4 text-indigo-600" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    )}
                  </div>
                  <p className="text-xs text-gray-500">{persona.role}</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Full view
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold text-gray-700">Select Persona</h4>
        <span
          className="text-xs px-2 py-0.5 rounded-full"
          style={{ backgroundColor: `${currentPersona.color}20`, color: currentPersona.color }}
        >
          {currentPersona.style}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-2">
        {DEFAULT_PERSONAS.map(persona => {
          const isSelected = persona.id === currentPersona.id;
          
          return (
            <button
              key={persona.id}
              onClick={() => onSelectPersona(persona)}
              className={`flex items-start gap-3 p-3 rounded-lg border-2 transition-all text-left ${
                isSelected
                  ? 'border-current bg-opacity-10'
                  : 'border-gray-200 hover:border-gray-300 bg-white'
              }`}
              style={isSelected ? { borderColor: persona.color, backgroundColor: `${persona.color}10` } : {}}
            >
              <span className="text-2xl mt-0.5">{persona.icon}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-gray-800">{persona.name}</span>
                  <span
                    className="text-[10px] font-medium px-1.5 py-0.5 rounded uppercase"
                    style={{ backgroundColor: `${persona.color}20`, color: persona.color }}
                  >
                    {persona.style}
                  </span>
                </div>
                <p className="text-sm text-gray-600 mt-0.5">{persona.role}</p>
                <p className="text-xs text-gray-400 mt-1 line-clamp-2">
                  {persona.systemPrompt.split('\n')[0].replace('You are ', '')}
                </p>
              </div>
              {isSelected && (
                <svg
                  className="w-5 h-5 shrink-0"
                  style={{ color: persona.color }}
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default PersonaSelector;
