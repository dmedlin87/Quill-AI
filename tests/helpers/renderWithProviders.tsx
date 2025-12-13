import React from 'react';
import { render, type RenderOptions } from '@testing-library/react';
import { UsageProvider } from '@/features/shared';
import { EditorProvider, EngineProvider, AppBrainProvider } from '@/features/core';
import { AnalysisProvider } from '@/features/analysis';

export function renderWithProviders(
  ui: React.ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>,
) {
  const Wrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
    <UsageProvider>
      <EditorProvider>
        <EngineProvider>
          <AnalysisProvider>
            <AppBrainProvider>{children}</AppBrainProvider>
          </AnalysisProvider>
        </EngineProvider>
      </EditorProvider>
    </UsageProvider>
  );

  return render(ui, { wrapper: Wrapper, ...options });
}
