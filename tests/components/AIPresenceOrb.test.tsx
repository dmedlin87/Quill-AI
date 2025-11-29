import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { AIPresenceOrb } from '@/features/agent/components/AIPresenceOrb';
import { DEFAULT_PERSONAS } from '@/types/personas';

const persona = DEFAULT_PERSONAS[0];

describe('AIPresenceOrb', () => {
  it('renders persona icon', () => {
    render(<AIPresenceOrb status="idle" persona={persona} analysisReady={false} />);
    expect(screen.getByTitle('Agent')).toBeInTheDocument();
  });

  it('shows analysis ready badge when analysisReady is true', () => {
    const { container } = render(
      <AIPresenceOrb status="idle" persona={persona} analysisReady={true} />
    );

    // Badge wraps the small checkmark icon (8x8 SVG) in the top-right corner
    const checkIcon = container.querySelector('svg[width="8"][height="8"]');
    expect(checkIcon).not.toBeNull();
    expect(checkIcon?.parentElement).not.toBeNull();
  });

  it('uses different status indicator colors for each state', () => {
    const { rerender, container } = render(
      <AIPresenceOrb status="idle" persona={persona} analysisReady={false} />
    );

    const getStatusDot = () => {
      const divs = Array.from(container.querySelectorAll('div')) as HTMLDivElement[];
      return divs.find(el => {
        const classes = el.classList;
        return classes.contains('absolute') && classes.contains('-bottom-0.5');
      }) as HTMLDivElement | undefined;
    };

    const idleDot = getStatusDot();
    expect(idleDot).toBeDefined();
    const idleColor = idleDot!.style.backgroundColor;

    rerender(
      <AIPresenceOrb status="thinking" persona={persona} analysisReady={false} />
    );
    const thinkingDot = getStatusDot();
    expect(thinkingDot).toBeDefined();
    const thinkingColor = thinkingDot!.style.backgroundColor;

    rerender(
      <AIPresenceOrb status="writing" persona={persona} analysisReady={false} />
    );
    const writingDot = getStatusDot();
    expect(writingDot).toBeDefined();
    const writingColor = writingDot!.style.backgroundColor;

    expect(idleColor).not.toBe(thinkingColor);
    expect(thinkingColor).not.toBe(writingColor);
  });
});
