import * as LayoutFeature from '@/features/layout';

describe('features/layout index', () => {
  it('exports layout components and store', () => {
    expect(LayoutFeature.MainLayout).toBeDefined();
    expect(LayoutFeature.Workspace).toBeDefined();
    expect(LayoutFeature.EditorLayout).toBeDefined();
    expect(LayoutFeature.UploadLayout).toBeDefined();
    expect(LayoutFeature.NavigationRail).toBeDefined();
    expect(LayoutFeature.EditorHeader).toBeDefined();
    expect(LayoutFeature.ToolsPanel).toBeDefined();
    expect(LayoutFeature.ZenModeOverlay).toBeDefined();
    expect(LayoutFeature.useLayoutStore).toBeDefined();
  });
});
