## 2025-12-12 - [Tiptap Serialization Deferral]
**Learning:** Tiptap's `editor.storage.markdown.getMarkdown()` is synchronous and expensive as it serializes the entire ProseMirror document model. Calling this inside a debounced wrapper's *trigger* (on every keystroke) negates the benefit of debouncing.
**Action:** When debouncing heavy computations derived from editor state, pass the editor instance (or a lightweight reference) to the debounced function and perform the expensive computation *inside* the delayed callback, not before it.
