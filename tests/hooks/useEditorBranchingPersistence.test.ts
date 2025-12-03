import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Integration-style test to verify branching state persists via Dexie and
 * rehydrates when the active chapter is loaded.
 */
describe('useEditorBranching persistence', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.doUnmock('@/features/project/store/useProjectStore');
    vi.doUnmock('@/features/project');
  });

  it('persists branches and active branch through the project store', async () => {
    const { useEditorBranching } = await import('@/features/editor/hooks/useEditorBranching');
    const { useProjectStore } = await import('@/features/project/store/useProjectStore');

    const updateText = vi.fn();

    await act(async () => {
      await useProjectStore.getState().createProject('Persistent Project');
    });

    const initialChapter = useProjectStore.getState().getActiveChapter?.();
    expect(initialChapter).toBeDefined();

    let currentText = initialChapter?.content ?? '';

    const { result, rerender } = renderHook(
      ({ chapter, text }) =>
        useEditorBranching(chapter, text, (textUpdate) => {
          currentText = textUpdate;
          updateText(textUpdate);
        }),
      { initialProps: { chapter: initialChapter, text: currentText } },
    );

    let branchId = '';
    await act(async () => {
      result.current.createBranch('Saved Branch');
      await Promise.resolve();
    });

    branchId =
      useProjectStore.getState().chapters[0]?.branches?.[0]?.id ??
      result.current.branches[0]?.id ??
      '';

    expect(branchId).not.toBe('');

    act(() => {
      result.current.switchBranch(branchId);
    });

    currentText = 'Branch draft text';
    await act(async () => {
      rerender({ chapter: initialChapter, text: currentText });
      await Promise.resolve();
    });

    expect(result.current.branches[0]).toMatchObject({
      id: branchId,
      content: 'Branch draft text',
    });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });

    const projectId = useProjectStore.getState().currentProject?.id ?? '';

    await act(async () => {
      await useProjectStore.getState().loadProject(projectId);
    });

    const rehydratedChapter = useProjectStore.getState().getActiveChapter?.();

    expect(rehydratedChapter?.branches?.[0]).toMatchObject({
      id: branchId,
      name: 'Saved Branch',
      content: 'Branch draft text',
    });
    expect(rehydratedChapter?.activeBranchId).toBe(branchId);
  });
});
