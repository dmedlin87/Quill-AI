import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import {
  ZenIcon,
  ExitIcon,
  HomeIcon,
  AnalysisIcon,
  AgentIcon,
  HistoryIcon,
  MicIcon,
  WandIcon,
  GraphIcon,
  BookIcon,
  MemoryIcon,
  BoardIcon,
  SunIcon,
  MoonIcon,
  SettingsIcon,
  Icons,
  type IconName,
} from '@/features/shared/components/Icons';

describe('Icons', () => {
  describe('Individual icon components', () => {
    it('renders ZenIcon without crashing', () => {
      const { container } = render(<ZenIcon />);
      expect(container.querySelector('svg')).toBeInTheDocument();
    });

    it('renders ExitIcon without crashing', () => {
      const { container } = render(<ExitIcon />);
      expect(container.querySelector('svg')).toBeInTheDocument();
    });

    it('renders HomeIcon without crashing', () => {
      const { container } = render(<HomeIcon />);
      expect(container.querySelector('svg')).toBeInTheDocument();
    });

    it('renders AnalysisIcon without crashing', () => {
      const { container } = render(<AnalysisIcon />);
      expect(container.querySelector('svg')).toBeInTheDocument();
    });

    it('renders AgentIcon without crashing', () => {
      const { container } = render(<AgentIcon />);
      expect(container.querySelector('svg')).toBeInTheDocument();
    });

    it('renders HistoryIcon without crashing', () => {
      const { container } = render(<HistoryIcon />);
      expect(container.querySelector('svg')).toBeInTheDocument();
    });

    it('renders MicIcon without crashing', () => {
      const { container } = render(<MicIcon />);
      expect(container.querySelector('svg')).toBeInTheDocument();
    });

    it('renders WandIcon without crashing', () => {
      const { container } = render(<WandIcon />);
      expect(container.querySelector('svg')).toBeInTheDocument();
    });

    it('renders GraphIcon without crashing', () => {
      const { container } = render(<GraphIcon />);
      expect(container.querySelector('svg')).toBeInTheDocument();
    });

    it('renders BookIcon without crashing', () => {
      const { container } = render(<BookIcon />);
      expect(container.querySelector('svg')).toBeInTheDocument();
    });

    it('renders MemoryIcon without crashing', () => {
      const { container } = render(<MemoryIcon />);
      expect(container.querySelector('svg')).toBeInTheDocument();
    });

    it('renders BoardIcon without crashing', () => {
      const { container } = render(<BoardIcon />);
      expect(container.querySelector('svg')).toBeInTheDocument();
    });

    it('renders SunIcon without crashing', () => {
      const { container } = render(<SunIcon />);
      expect(container.querySelector('svg')).toBeInTheDocument();
    });

    it('renders MoonIcon without crashing', () => {
      const { container } = render(<MoonIcon />);
      expect(container.querySelector('svg')).toBeInTheDocument();
    });

    it('renders SettingsIcon without crashing', () => {
      const { container } = render(<SettingsIcon />);
      expect(container.querySelector('svg')).toBeInTheDocument();
    });
  });

  describe('Icons with className prop', () => {
    it('applies className to ZenIcon', () => {
      const { container } = render(<ZenIcon className="test-class" />);
      expect(container.querySelector('svg')).toHaveClass('test-class');
    });

    it('applies className to MicIcon', () => {
      const { container } = render(<MicIcon className="custom-icon" />);
      expect(container.querySelector('svg')).toHaveClass('custom-icon');
    });
  });

  describe('Icons namespace object', () => {
    it('exports all icons via Icons object', () => {
      expect(Icons.Zen).toBe(ZenIcon);
      expect(Icons.Exit).toBe(ExitIcon);
      expect(Icons.Home).toBe(HomeIcon);
      expect(Icons.Analysis).toBe(AnalysisIcon);
      expect(Icons.Agent).toBe(AgentIcon);
      expect(Icons.History).toBe(HistoryIcon);
      expect(Icons.Mic).toBe(MicIcon);
      expect(Icons.Wand).toBe(WandIcon);
      expect(Icons.Graph).toBe(GraphIcon);
      expect(Icons.Book).toBe(BookIcon);
      expect(Icons.Memory).toBe(MemoryIcon);
      expect(Icons.Board).toBe(BoardIcon);
      expect(Icons.Sun).toBe(SunIcon);
      expect(Icons.Moon).toBe(MoonIcon);
      expect(Icons.Settings).toBe(SettingsIcon);
    });

    it('has correct number of icons', () => {
      expect(Object.keys(Icons)).toHaveLength(15);
    });
  });

  describe('IconName type', () => {
    it('IconName corresponds to Icons keys', () => {
      const iconNames: IconName[] = [
        'Zen',
        'Exit',
        'Home',
        'Analysis',
        'Agent',
        'History',
        'Mic',
        'Wand',
        'Graph',
        'Book',
        'Memory',
        'Board',
        'Sun',
        'Moon',
        'Settings',
      ];
      
      iconNames.forEach((name) => {
        expect(Icons[name]).toBeDefined();
      });
    });
  });

  describe('SVG structure', () => {
    it('ZenIcon has expected SVG attributes', () => {
      const { container } = render(<ZenIcon />);
      const svg = container.querySelector('svg');
      expect(svg).toHaveAttribute('width', '20');
      expect(svg).toHaveAttribute('height', '20');
      expect(svg).toHaveAttribute('viewBox', '0 0 24 24');
      expect(svg).toHaveAttribute('fill', 'none');
      expect(svg).toHaveAttribute('stroke', 'currentColor');
    });

    it('ExitIcon has expected SVG attributes', () => {
      const { container } = render(<ExitIcon />);
      const svg = container.querySelector('svg');
      expect(svg).toHaveAttribute('width', '16');
      expect(svg).toHaveAttribute('height', '16');
    });
  });
});
