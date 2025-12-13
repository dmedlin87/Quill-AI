import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MagicBar } from '@/features/editor/components/MagicBar';

// Mock dependencies
vi.mock('@/features/shared/components/AccessibleTooltip', () => ({
  AccessibleTooltip: ({ children, content }: any) => <div title={content}>{children}</div>
}));

// Mock useViewportCollision
vi.mock('@/features/shared', () => ({
  useViewportCollision: (pos: any) => pos
}));

describe('MagicBar Formatting Fix', () => {
  const defaultProps = {
    isLoading: false,
    variations: [],
    grammarSuggestions: [],
    onRewrite: vi.fn(),
    onHelp: vi.fn(),
    onApply: vi.fn(),
    onGrammarCheck: vi.fn(),
    onApplyGrammar: vi.fn(),
    onApplyAllGrammar: vi.fn(),
    onDismissGrammar: vi.fn(),
    onClose: vi.fn(),
    position: { top: 100, left: 100 }
  };

  it('renders "Clean Up" button when hasFormattingIssues is true', () => {
    const onFixFormatting = vi.fn();
    render(
      <MagicBar
        {...defaultProps}
        hasFormattingIssues={true}
        onFixFormatting={onFixFormatting}
      />
    );

    const button = screen.getByText('Clean Up');
    expect(button).toBeDefined();
    fireEvent.click(button);
    expect(onFixFormatting).toHaveBeenCalled();
  });

  it('does NOT render "Clean Up" button when hasFormattingIssues is false', () => {
    const onFixFormatting = vi.fn();
    render(
      <MagicBar
        {...defaultProps}
        hasFormattingIssues={false}
        onFixFormatting={onFixFormatting}
      />
    );

    expect(screen.queryByText('Clean Up')).toBeNull();
  });
});
