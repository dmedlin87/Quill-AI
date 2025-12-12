import * as CoreFeature from '@/features/core';

describe('features/core index', () => {
  it('exports core providers and hooks', () => {
    expect(CoreFeature.EditorProvider).toBeDefined();
    expect(CoreFeature.useEditor).toBeDefined();
    expect(CoreFeature.useEditorState).toBeDefined();
    expect(CoreFeature.useEditorActions).toBeDefined();
    expect(CoreFeature.useManuscript).toBeDefined();
    expect(CoreFeature.ManuscriptProvider).toBeDefined();

    expect(CoreFeature.EngineProvider).toBeDefined();
    expect(CoreFeature.useEngine).toBeDefined();

    expect(CoreFeature.AppBrainProvider).toBeDefined();
    expect(CoreFeature.useAppBrain).toBeDefined();
    expect(CoreFeature.useAppBrainState).toBeDefined();
    expect(CoreFeature.useAppBrainActions).toBeDefined();
    expect(CoreFeature.useAppBrainContext).toBeDefined();
  });
});
