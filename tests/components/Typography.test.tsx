import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { Heading, Text } from '@/features/shared/components/ui/Typography';
import type { HeadingVariant, TextVariant } from '@/features/shared/components/ui/Typography';

describe('Heading', () => {
  describe('Variant Prop', () => {
    it('renders as h2 by default', () => {
      const { container } = render(<Heading>Default Heading</Heading>);
      
      const h2 = container.querySelector('h2');
      expect(h2).toBeInTheDocument();
      expect(h2).toHaveTextContent('Default Heading');
    });

    it('renders as h1 when variant="h1"', () => {
      const { container } = render(<Heading variant="h1">Heading 1</Heading>);
      
      const h1 = container.querySelector('h1');
      expect(h1).toBeInTheDocument();
      expect(h1).toHaveTextContent('Heading 1');
    });

    it('renders as h2 when variant="h2"', () => {
      const { container } = render(<Heading variant="h2">Heading 2</Heading>);
      
      const h2 = container.querySelector('h2');
      expect(h2).toBeInTheDocument();
    });

    it('renders as h3 when variant="h3"', () => {
      const { container } = render(<Heading variant="h3">Heading 3</Heading>);
      
      const h3 = container.querySelector('h3');
      expect(h3).toBeInTheDocument();
    });

    it('renders as h4 when variant="h4"', () => {
      const { container } = render(<Heading variant="h4">Heading 4</Heading>);
      
      const h4 = container.querySelector('h4');
      expect(h4).toBeInTheDocument();
    });

    it('renders as h5 when variant="h5"', () => {
      const { container } = render(<Heading variant="h5">Heading 5</Heading>);
      
      const h5 = container.querySelector('h5');
      expect(h5).toBeInTheDocument();
    });

    it('renders as h6 when variant="h6"', () => {
      const { container } = render(<Heading variant="h6">Heading 6</Heading>);
      
      const h6 = container.querySelector('h6');
      expect(h6).toBeInTheDocument();
    });
  });

  describe('Styles', () => {
    it('applies h1 styles', () => {
      const { container } = render(<Heading variant="h1">H1</Heading>);
      
      const h1 = container.querySelector('h1');
      expect(h1).toHaveClass('font-serif');
      expect(h1).toHaveClass('text-[var(--text-primary)]');
      expect(h1).toHaveClass('text-[var(--text-4xl)]');
      expect(h1).toHaveClass('font-semibold');
    });

    it('applies h2 styles', () => {
      const { container } = render(<Heading variant="h2">H2</Heading>);
      
      const h2 = container.querySelector('h2');
      expect(h2).toHaveClass('text-[var(--text-3xl)]');
      expect(h2).toHaveClass('font-medium');
    });

    it('applies h6 styles with uppercase', () => {
      const { container } = render(<Heading variant="h6">H6</Heading>);
      
      const h6 = container.querySelector('h6');
      expect(h6).toHaveClass('text-[var(--text-base)]');
      expect(h6).toHaveClass('font-bold');
      expect(h6).toHaveClass('uppercase');
      expect(h6).toHaveClass('tracking-wide');
    });

    it('accepts custom className', () => {
      const { container } = render(<Heading className="custom-heading">Heading</Heading>);
      
      const h2 = container.querySelector('h2');
      expect(h2).toHaveClass('custom-heading');
      expect(h2).toHaveClass('font-serif'); // Still has base classes
    });
  });

  describe('Children', () => {
    it('renders text children', () => {
      render(<Heading>Simple heading text</Heading>);
      
      expect(screen.getByText('Simple heading text')).toBeInTheDocument();
    });

    it('renders JSX children', () => {
      render(
        <Heading>
          Heading with <strong>bold</strong> text
        </Heading>
      );
      
      expect(screen.getByText('Heading with')).toBeInTheDocument();
      expect(screen.getByText('bold')).toBeInTheDocument();
    });
  });
});

describe('Text', () => {
  describe('Variant Prop', () => {
    it('renders body variant by default', () => {
      const { container } = render(<Text>Default text</Text>);
      
      const element = container.firstChild;
      expect(element).toHaveClass('text-[var(--text-base)]');
      expect(element).toHaveClass('text-[var(--text-primary)]');
    });

    it('renders small variant', () => {
      const { container } = render(<Text variant="small">Small text</Text>);
      
      const element = container.firstChild;
      expect(element).toHaveClass('text-[var(--text-sm)]');
      expect(element).toHaveClass('text-[var(--text-secondary)]');
    });

    it('renders muted variant', () => {
      const { container } = render(<Text variant="muted">Muted text</Text>);
      
      const element = container.firstChild;
      expect(element).toHaveClass('text-[var(--text-xs)]');
      expect(element).toHaveClass('text-[var(--text-muted)]');
    });

    it('renders label variant', () => {
      const { container } = render(<Text variant="label">Label text</Text>);
      
      const element = container.firstChild;
      expect(element).toHaveClass('text-[var(--text-xs)]');
      expect(element).toHaveClass('font-bold');
      expect(element).toHaveClass('text-[var(--text-tertiary)]');
      expect(element).toHaveClass('uppercase');
      expect(element).toHaveClass('tracking-wider');
    });

    it('renders code variant', () => {
      const { container } = render(<Text variant="code">Code text</Text>);
      
      const element = container.firstChild;
      expect(element).toHaveClass('font-mono');
      expect(element).toHaveClass('text-[var(--text-sm)]');
      expect(element).toHaveClass('bg-[var(--interactive-bg)]');
      expect(element).toHaveClass('px-1');
      expect(element).toHaveClass('rounded');
    });

    it('renders prose variant', () => {
      const { container } = render(<Text variant="prose">Prose text</Text>);
      
      const element = container.firstChild;
      expect(element).toHaveClass('text-[var(--prose-size)]');
      expect(element).toHaveClass('font-serif');
      expect(element).toHaveClass('leading-relaxed');
      expect(element).toHaveClass('max-w-[65ch]');
    });
  });

  describe('As Prop', () => {
    it('renders as p by default', () => {
      const { container } = render(<Text>Text content</Text>);
      
      const p = container.querySelector('p');
      expect(p).toBeInTheDocument();
      expect(p).toHaveTextContent('Text content');
    });

    it('renders as span when as="span"', () => {
      const { container } = render(<Text as="span">Span text</Text>);
      
      const span = container.querySelector('span');
      expect(span).toBeInTheDocument();
      expect(span).toHaveTextContent('Span text');
    });

    it('renders as div when as="div"', () => {
      const { container } = render(<Text as="div">Div content</Text>);
      
      const div = container.querySelector('div');
      expect(div).toBeInTheDocument();
    });

    it('renders as label when as="label"', () => {
      const { container } = render(<Text as="label">Label content</Text>);
      
      const label = container.querySelector('label');
      expect(label).toBeInTheDocument();
    });
  });

  describe('Combined Props', () => {
    it('combines variant and as props', () => {
      const { container } = render(
        <Text variant="small" as="span">
          Small span
        </Text>
      );
      
      const span = container.querySelector('span');
      expect(span).toBeInTheDocument();
      expect(span).toHaveClass('text-[var(--text-sm)]');
    });

    it('accepts custom className', () => {
      const { container } = render(<Text className="custom-text">Text</Text>);
      
      const element = container.firstChild;
      expect(element).toHaveClass('custom-text');
      expect(element).toHaveClass('text-[var(--text-base)]'); // Still has variant classes
    });

    it('accepts additional HTML props', () => {
      const onClick = vi.fn();
      const { container } = render(
        <Text onClick={onClick} data-testid="clickable">
          Clickable text
        </Text>
      );
      
      const element = container.firstChild as HTMLElement;
      fireEvent.click(element);
      expect(onClick).toHaveBeenCalledTimes(1);
    });
  });

  describe('Children', () => {
    it('renders text children', () => {
      render(<Text>Simple text content</Text>);
      
      expect(screen.getByText('Simple text content')).toBeInTheDocument();
    });

    it('renders JSX children', () => {
      render(
        <Text>
          Text with <em>emphasis</em> and <code>code</code>
        </Text>
      );
      
      expect(screen.getByText('Text with')).toBeInTheDocument();
      expect(screen.getByText('emphasis')).toBeInTheDocument();
      expect(screen.getByText('code')).toBeInTheDocument();
    });

    it('renders multiple children', () => {
      render(
        <Text>
          <span>First part</span>
          <span>Second part</span>
        </Text>
      );
      
      expect(screen.getByText('First part')).toBeInTheDocument();
      expect(screen.getByText('Second part')).toBeInTheDocument();
    });
  });
});
