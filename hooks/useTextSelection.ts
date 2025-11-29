// This hook is deprecated as selection logic has moved to Tiptap's internal state management
// inside EditorContext and RichTextEditor.
// Keeping a minimal stub to prevent import errors during refactor if any residual files exist.

export function useTextSelection(_ref: any) {
  return {
    selection: null,
    position: null,
    cursorPosition: 0,
    handleSelectionChange: () => {},
    handleMouseUp: () => {},
    handleKeyUp: () => {},
    handleBlur: () => {},
    clearSelection: () => {},
    invalidateIfStale: () => {},
  };
}