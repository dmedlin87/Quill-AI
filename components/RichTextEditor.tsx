import React, { useEffect, useMemo, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Highlight from '@tiptap/extension-highlight';
import { Markdown } from 'tiptap-markdown';
import { Plugin, PluginKey } from 'prosemirror-state';
import { Decoration, DecorationSet } from 'prosemirror-view';

interface HighlightItem {
    start: number;
    end: number;
    color: string;
    title?: string;
}

interface RichTextEditorProps {
  content: string;
  onUpdate: (text: string) => void;
  onSelectionChange: (selection: { start: number; end: number; text: string } | null, pos: { top: number; left: number } | null) => void;
  setEditorRef: (editor: any) => void;
  activeHighlight: { start: number; end: number; type: string } | null;
  analysisHighlights?: HighlightItem[];
}

export const RichTextEditor: React.FC<RichTextEditorProps> = ({ 
  content, 
  onUpdate, 
  onSelectionChange, 
  setEditorRef,
  activeHighlight,
  analysisHighlights = []
}) => {
  const [isFocused, setIsFocused] = useState(false);

  const AnalysisDecorations = useMemo(() => {
    return new Plugin({
      key: new PluginKey('analysis-decorations'),
      props: {
        decorations(state) {
          const { doc } = state;
          const decorations: Decoration[] = [];
          analysisHighlights.forEach(h => {
             if (h.start < h.end && h.end <= doc.content.size) {
                 decorations.push(
                     Decoration.inline(h.start, h.end, {
                         style: `background-color: ${h.color}20; border-bottom: 2px solid ${h.color}; cursor: help;`,
                         title: h.title || ''
                     })
                 );
             }
          });
          return DecorationSet.create(doc, decorations);
        }
      }
    });
  }, [analysisHighlights]);

  const editor = useEditor({
    extensions: [
      StarterKit,
      Highlight.configure({ multicolor: true }),
      Markdown.configure({ html: false, transformPastedText: true, transformCopiedText: true }),
    ],
    content: content, 
    editorProps: {
      attributes: {
        class: 'prose max-w-none focus:outline-none min-h-[60vh] outline-none',
        style: 'font-family: "Crimson Pro", serif; font-size: 1.125rem; line-height: 2; color: var(--ink-800);'
      },
    },
    onFocus: () => setIsFocused(true),
    onBlur: () => setIsFocused(false),
    onUpdate: ({ editor }) => {
      const markdown = (editor.storage as any).markdown.getMarkdown();
      onUpdate(markdown);
    },
    onSelectionUpdate: ({ editor }) => {
      const { from, to, empty } = editor.state.selection;
      if (empty) {
        onSelectionChange(null, null);
        return;
      }
      const text = editor.state.doc.textBetween(from, to, ' ');
      const startPos = editor.view.coordsAtPos(from);
      const endPos = editor.view.coordsAtPos(to);
      const top = startPos.top;
      const left = (startPos.left + endPos.left) / 2;
      onSelectionChange({ start: from, end: to, text }, { top, left });
    },
  });

  useEffect(() => {
    if (editor && content !== undefined) {
       const currentMarkdown = (editor.storage as any).markdown.getMarkdown();
       if (currentMarkdown !== content && !editor.isFocused) {
           editor.commands.setContent(content);
       }
    }
  }, [content, editor]);

  useEffect(() => {
    if (editor && !editor.isDestroyed) {
        const newState = editor.state.reconfigure({ 
            plugins: editor.state.plugins
                .filter(p => (p.spec.key as any)?.key !== 'analysis-decorations')
                .concat([AnalysisDecorations]) 
        });
        editor.view.updateState(newState);
    }
  }, [editor, AnalysisDecorations]);

  useEffect(() => {
    setEditorRef(editor);
  }, [editor, setEditorRef]);

  return (
    <div 
      className={`bg-[var(--parchment-50)] min-h-[80vh] rounded-sm relative overflow-hidden transition-all duration-700 ease-out-expo animate-fade-in ${
        isFocused 
          ? 'scale-[1.01] shadow-[var(--shadow-xl)] z-10' 
          : 'scale-100 shadow-[var(--shadow-lg)] z-0'
      }`}
    >
        {/* Paper Noise Texture */}
        <div 
          className="absolute inset-0 pointer-events-none opacity-[0.03]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`
          }}
        />
        <div className="relative z-10 p-16">
           <EditorContent editor={editor} />
        </div>
    </div>
  );
};