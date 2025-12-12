import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { vi } from 'vitest';

import { CritiqueIntensitySelector, IntensityBadge } from '@/features/settings/components/CritiqueIntensitySelector';
import { CRITIQUE_PRESETS, CritiqueIntensity } from '@/types/critiqueSettings';

type SettingsState = {
  critiqueIntensity: CritiqueIntensity;
  setCritiqueIntensity: (id: CritiqueIntensity) => void;
};

const { mockState, mockUseSettingsStore } = vi.hoisted(() => {
  const state: SettingsState = {
    // Default to a valid literal; tests will override as needed
    critiqueIntensity: 'standard' as CritiqueIntensity,
    setCritiqueIntensity: vi.fn(),
  };

  const useStore = vi.fn(<T,>(selector?: (s: SettingsState) => T): T | SettingsState => {
    if (typeof selector === 'function') {
      return selector(state);
    }
    return state;
  });

  return { mockState: state, mockUseSettingsStore: useStore };
});

const presets = Object.values(CRITIQUE_PRESETS);

vi.mock('@/features/settings/store/useSettingsStore', () => ({
  useSettingsStore: mockUseSettingsStore,
}));

// Mock framer-motion to avoid animation issues in JSDOM
vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
      <div {...props}>{children}</div>
    ),
    button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
      <button {...props}>{children}</button>
    ),
  },
}));

describe('CritiqueIntensitySelector', () => {

  const setupStore = (overrides?: Partial<SettingsState>) => {
    const setCritiqueIntensity = vi.fn();
    mockState.critiqueIntensity = presets[0].id as CritiqueIntensity;
    mockState.setCritiqueIntensity = setCritiqueIntensity;
    Object.assign(mockState, overrides);
    return { setCritiqueIntensity };
  };

  const getCompactButtonByPreset = (preset: (typeof presets)[number]) =>
    screen.getByTitle(preset.description);

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseSettingsStore.mockClear();
    mockState.critiqueIntensity = presets[0].id as CritiqueIntensity;
    mockState.setCritiqueIntensity = vi.fn();
  });

  it('renders all presets in compact mode using titles', () => {
    setupStore({ critiqueIntensity: presets[1].id });

    render(<CritiqueIntensitySelector compact />);

    presets.forEach((preset) => {
      expect(screen.getByTitle(preset.description)).toBeInTheDocument();
    });

    // Compact mode should not render the textual labels
    presets.forEach((preset) => {
      expect(screen.queryByText(preset.label)).not.toBeInTheDocument();
    });
  });

  it('clicking a non-active compact preset calls setCritiqueIntensity with the correct id', () => {
    const active = presets[0];
    const target = presets[1];
    const { setCritiqueIntensity } = setupStore({
      critiqueIntensity: active.id,
    });

    render(<CritiqueIntensitySelector compact />);

    fireEvent.click(getCompactButtonByPreset(target));

    expect(setCritiqueIntensity).toHaveBeenCalledWith(target.id as CritiqueIntensity);
  });

  it('applies active styling in compact mode', () => {
    const active = presets[0];
    const inactive = presets[1];

    setupStore({ critiqueIntensity: active.id });

    render(<CritiqueIntensitySelector compact />);

    const activeButton = getCompactButtonByPreset(active);
    const inactiveButton = getCompactButtonByPreset(inactive);

    expect(activeButton).toHaveClass('text-white');
    expect(inactiveButton).toHaveClass('text-slate-400');
  });

  it('renders labels and descriptions in full mode', () => {
    setupStore();

    render(<CritiqueIntensitySelector />);

    presets.forEach((preset) => {
      expect(screen.getByText(preset.label)).toBeInTheDocument();
      expect(screen.getByText(preset.description)).toBeInTheDocument();
    });
  });

  it('clicking a non-active full mode preset updates the store', () => {
    const active = presets[0];
    const target = presets[1];
    const { setCritiqueIntensity } = setupStore({
      critiqueIntensity: active.id,
    });

    render(<CritiqueIntensitySelector />);

    const targetLabel = screen.getByText(target.label);
    const targetButton = targetLabel.closest('button');

    expect(targetButton).toBeTruthy();

    fireEvent.click(targetButton!);

    expect(setCritiqueIntensity).toHaveBeenCalledWith(target.id as CritiqueIntensity);
  });

  it('marks the active preset as visually distinguished in full mode', () => {
    const active = presets[0];
    mockState.critiqueIntensity = active.id as CritiqueIntensity;
    mockState.setCritiqueIntensity = vi.fn();

    render(<CritiqueIntensitySelector />);

    const activeLabel = screen.getByText(active.label);
    const activeButton = activeLabel.closest('button');

    expect(activeButton).toBeTruthy();

    // Active badge text
    expect(screen.getByText('Active')).toBeInTheDocument();

    // Inline styles for border/background use the preset color
    expect(activeButton).toHaveStyle({ borderColor: active.color });
  });

  it('renders IntensityBadge using the current store intensity', () => {
    const active = presets[1];
    setupStore({ critiqueIntensity: active.id });

    render(<IntensityBadge className="my-badge" />);

    const badge = screen.getByTitle(`Critique mode: ${active.label} - ${active.description}`);
    expect(badge).toHaveClass('my-badge');
    expect(screen.getByText(active.icon)).toBeInTheDocument();
    expect(screen.getByText(active.label)).toBeInTheDocument();
  });
});
