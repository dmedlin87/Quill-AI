import * as DebugFeature from '@/features/debug';

describe('features/debug index', () => {
  it('exports BrainActivityMonitor', () => {
    expect(DebugFeature.BrainActivityMonitor).toBeDefined();
  });
});
