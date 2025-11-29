import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';

import { PersonaSelector } from '@/features/agent/components/PersonaSelector';
import { DEFAULT_PERSONAS } from '@/types/personas';

describe('PersonaSelector', () => {
  const [first, second] = DEFAULT_PERSONAS;

  it('opens compact dropdown and selects a different persona', () => {
    const onSelectPersona = vi.fn();

    render(
      <PersonaSelector
        currentPersona={first}
        onSelectPersona={onSelectPersona}
        compact
      />
    );

    const toggle = screen.getByTitle(`Current: ${first.name}`);
    fireEvent.click(toggle);

    const secondButton = screen.getByText(second.name).closest('button');
    expect(secondButton).toBeTruthy();

    fireEvent.click(secondButton!);
    expect(onSelectPersona).toHaveBeenCalledWith(second);
  });

  it('closes compact dropdown on Escape', () => {
    const onSelectPersona = vi.fn();

    render(
      <PersonaSelector
        currentPersona={first}
        onSelectPersona={onSelectPersona}
        compact
      />
    );

    const toggle = screen.getByTitle(`Current: ${first.name}`);
    fireEvent.click(toggle);

    expect(screen.getByText(second.name)).toBeInTheDocument();

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(screen.queryByText(second.name)).not.toBeInTheDocument();
  });

  it('renders full view cards and calls onSelectPersona', () => {
    const onSelectPersona = vi.fn();

    render(
      <PersonaSelector
        currentPersona={first}
        onSelectPersona={onSelectPersona}
      />
    );

    const target = screen.getByText(second.name);
    fireEvent.click(target);

    expect(onSelectPersona).toHaveBeenCalledWith(second);
  });
});
