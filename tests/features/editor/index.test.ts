import * as EditorFeature from '@/features/editor';

describe('features/editor index', () => {
  it('exports editor components, hooks, and extensions', () => {
    expect(EditorFeature.RichTextEditor).toBeDefined();
    expect(EditorFeature.MagicBar).toBeDefined();
    expect(EditorFeature.FindReplaceModal).toBeDefined();
    expect(EditorFeature.VisualDiff).toBeDefined();
    expect(EditorFeature.DiffViewer).toBeDefined();
    expect(EditorFeature.EditorWorkspace).toBeDefined();
    expect(EditorFeature.CommentCard).toBeDefined();
    expect(EditorFeature.VersionControlPanel).toBeDefined();
    expect(EditorFeature.StoryVersionsPanel).toBeDefined();

    expect(EditorFeature.useMagicEditor).toBeDefined();
    expect(EditorFeature.useAutoResize).toBeDefined();
    expect(EditorFeature.useBranching).toBeDefined();
    expect(EditorFeature.useInlineComments).toBeDefined();
    expect(EditorFeature.useDocumentHistory).toBeDefined();
    expect(EditorFeature.useEditorSelection).toBeDefined();
    expect(EditorFeature.useEditorComments).toBeDefined();
    expect(EditorFeature.useEditorBranching).toBeDefined();
    expect(EditorFeature.useChunkIndex).toBeDefined();
    expect(EditorFeature.useChunkIndexSync).toBeDefined();
    expect(EditorFeature.useTiptapSync).toBeDefined();
    expect(EditorFeature.useDebouncedUpdate).toBeDefined();

    expect(EditorFeature.CommentMark).toBeDefined();
  });
});
