import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';
import { AIPresenceOrb, OrbStatus } from '@/features/agent/components/AIPresenceOrb';
import { Persona } from '@/types/personas';
import * as framerMotion from 'framer-motion';

// Mock framer-motion
vi.mock('framer-motion', async () => {
  const actual = await vi.importActual('framer-motion');
  return {
    ...actual,
    motion: {
      div: ({ children, ...props }: any) => <div {...props}>{children}</div>,
      button: ({ children, ...props }: any) => <button {...props}>{children}</button>,
    },
    useReducedMotion: vi.fn(),
  };
});

const mockPersona: Persona = {
  id: 'test-persona',
  name: 'Test Persona',
  role: 'editor',
  description: 'A test persona',
  icon: '🤖',
  color: '#FF0000',
  instructions: 'Test instructions'
};

describe('AIPresenceOrb', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (framerMotion.useReducedMotion as any).mockReturnValue(false);
  });

  it('renders correctly with default props', () => {
    render(
      <AIPresenceOrb
        status="idle"
        persona={mockPersona}
        analysisReady={false}
      />
    );

    const button = screen.getByRole('button', { name: /Agent Test Persona is idle/i });
    expect(button).toBeInTheDocument();
    expect(screen.getByText('🤖')).toBeInTheDocument();
  });

  it('calls onClick handler when clicked', () => {
    const handleClick = vi.fn();
    render(
      <AIPresenceOrb
        status="idle"
        persona={mockPersona}
        analysisReady={false}
        onClick={handleClick}
      />
    );

    const button = screen.getByRole('button');
    fireEvent.click(button);
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it('displays analysis ready badge when analysisReady is true', () => {
    render(
      <AIPresenceOrb
        status="idle"
        persona={mockPersona}
        analysisReady={true}
      />
    );
    const polyline = document.querySelector('polyline[points="2 6 5 9 10 3"]');
    expect(polyline).toBeInTheDocument();
  });

  it('renders pending suggestions badge', () => {
    render(
      <AIPresenceOrb
        status="idle"
        persona={mockPersona}
        analysisReady={false}
        pendingSuggestions={5}
      />
    );

    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('renders pending suggestions badge as 9+ for more than 9', () => {
    render(
      <AIPresenceOrb
        status="idle"
        persona={mockPersona}
        analysisReady={false}
        pendingSuggestions={12}
      />
    );

    expect(screen.getByText('9+')).toBeInTheDocument();
  });

  it('renders active indicator when isActive is true', () => {
    const { container } = render(
      <AIPresenceOrb
        status="idle"
        persona={mockPersona}
        analysisReady={false}
        isActive={true}
      />
    );
    const activeIndicator = container.querySelector('.right-\\[-13px\\]');
    expect(activeIndicator).toBeInTheDocument();
  });

  it('renders different statuses correctly', () => {
    const statuses: OrbStatus[] = ['thinking', 'writing', 'processing', 'dreaming'];

    statuses.forEach(status => {
      const { unmount } = render(
        <AIPresenceOrb
          status={status}
          persona={mockPersona}
          analysisReady={false}
        />
      );

      const button = screen.getByRole('button', { name: new RegExp(`Agent Test Persona is ${status}`, 'i') });
      expect(button).toBeInTheDocument();

      if (status === 'dreaming') {
        expect(screen.getByText('zZz')).toBeInTheDocument();
      }

      unmount();
    });
  });

  it('adjusts colors based on status', () => {
     const { container } = render(
        <AIPresenceOrb
          status="writing"
          persona={mockPersona}
          analysisReady={false}
        />
     );
     const animatedDivs = container.querySelectorAll('div[animate="writing"]');
     expect(animatedDivs.length).toBeGreaterThan(0);
  });

  it('renders correctly with reduced motion enabled', () => {
    (framerMotion.useReducedMotion as any).mockReturnValue(true);

    // Render with a status that has specific reduced motion variants (e.g. thinking)
    render(
      <AIPresenceOrb
        status="thinking"
        persona={mockPersona}
        analysisReady={false}
      />
    );

    // We can't easily check the animation values in jsdom without inspecting the props passed to the mock
    // But ensuring it renders without crashing covers the branch where useReducedMotion returns true
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('handles processing and dreaming states with reduced motion', () => {
      (framerMotion.useReducedMotion as any).mockReturnValue(true);
      const { unmount } = render(
        <AIPresenceOrb
          status="processing"
          persona={mockPersona}
          analysisReady={false}
        />
      );
      expect(screen.getByRole('button')).toBeInTheDocument();
      unmount();

      render(
        <AIPresenceOrb
          status="dreaming"
          persona={mockPersona}
          analysisReady={false}
        />
      );
      expect(screen.getByRole('button')).toBeInTheDocument();
  });
});
