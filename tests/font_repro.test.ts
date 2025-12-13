import { describe, it, expect } from 'vitest';
import { Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import TextStyle from '@tiptap/extension-text-style';

const tryLoadFontFamilyExtension = async () => {
  try {
    const moduleName = '@tiptap/extension-font-family';
    const mod = await import(moduleName);
    return (mod as any).default ?? mod;
  } catch {
    return null;
  }
};

// Mocking the editor setup to see what happens with HTML paste
describe('Editor Font Handling', () => {
  it('strips font-family by default with StarterKit only', () => {
    const editor = new Editor({
      extensions: [StarterKit],
      content: '<p style="font-family: Arial">Hello World</p>',
    });

    const json = editor.getJSON();
    // We expect no "textStyle" or "fontFamily" marks
    const para = json.content?.[0];
    expect(para?.attrs).toBeUndefined(); // Paragraphs shouldn't have font attrs
    // Check if marks exist on text node
    const textNode = para?.content?.[0];
    expect(textNode?.marks).toBeUndefined();
  });

  it('preserves font-family if extensions are added', async () => {
    const FontFamily = await tryLoadFontFamilyExtension();
    if (!FontFamily) {
      // Optional dependency: repo doesn't always install this extension.
      return;
    }

    const editor = new Editor({
      extensions: [StarterKit, TextStyle, FontFamily],
      content: '<p><span style="font-family: Arial">Hello World</span></p>',
    });

    const json = editor.getJSON();
    const textNode = json.content?.[0].content?.[0];
    expect(textNode?.marks).toBeDefined();
    expect(textNode?.marks?.[0].type).toBe('textStyle');
    expect(textNode?.marks?.[0].attrs?.fontFamily).toBe('Arial');
  });
});
