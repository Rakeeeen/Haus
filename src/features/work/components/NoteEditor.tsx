import React, { useRef, useState } from 'react';
import { Extension, type Editor, type Range } from '@tiptap/core';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Markdown } from '@tiptap/markdown';
import { TaskItem, TaskList } from '@tiptap/extension-list';
import { Placeholder } from '@tiptap/extensions';
import Suggestion, { type SuggestionProps } from '@tiptap/suggestion';
import { Button } from '@/ui/Button';

/**
 * The page editor of a note: Markdown in, Markdown out, with what Notion's has — type "/" for blocks, "# " "- " "[] " "> "
 * for the usual shortcuts, bold/italic with the keys — and each block reads in its own direction, so Arabic and English
 * can follow each other on a page. It is only for typing; where the text is kept and when it is saved is the page's job.
 */

// Each block takes the direction of its own first letter (dir="auto"), as a Notion page does.
const AutoDirection = Extension.create({
  name: 'autoDirection',
  addGlobalAttributes() {
    return [{
      types: ['paragraph', 'heading', 'listItem', 'taskItem', 'blockquote'],
      attributes: { dir: { default: 'auto', parseHTML: () => 'auto', renderHTML: () => ({ dir: 'auto' }) } },
    }];
  },
});

interface SlashItem { title: string; hint: string; run: (editor: Editor, range: Range) => void }

const SLASH_ITEMS: readonly SlashItem[] = [
  { title: 'Text', hint: 'Plain paragraph', run: (e, r) => e.chain().focus().deleteRange(r).setParagraph().run() },
  { title: 'Heading 1', hint: 'Big title', run: (e, r) => e.chain().focus().deleteRange(r).setNode('heading', { level: 1 }).run() },
  { title: 'Heading 2', hint: 'Section', run: (e, r) => e.chain().focus().deleteRange(r).setNode('heading', { level: 2 }).run() },
  { title: 'Heading 3', hint: 'Small section', run: (e, r) => e.chain().focus().deleteRange(r).setNode('heading', { level: 3 }).run() },
  { title: 'Bulleted list', hint: 'A list with dots', run: (e, r) => e.chain().focus().deleteRange(r).toggleBulletList().run() },
  { title: 'Numbered list', hint: 'A list with numbers', run: (e, r) => e.chain().focus().deleteRange(r).toggleOrderedList().run() },
  { title: 'To-do list', hint: 'Things to tick', run: (e, r) => e.chain().focus().deleteRange(r).toggleTaskList().run() },
  { title: 'Quote', hint: 'Set a passage apart', run: (e, r) => e.chain().focus().deleteRange(r).toggleBlockquote().run() },
  { title: 'Code', hint: 'Monospace block', run: (e, r) => e.chain().focus().deleteRange(r).toggleCodeBlock().run() },
  { title: 'Divider', hint: 'A line across the page', run: (e, r) => e.chain().focus().deleteRange(r).setHorizontalRule().run() },
];

interface Menu { items: SlashItem[]; selected: number; left: number; top: number; command: (item: SlashItem) => void }

export const NoteEditor: React.FC<{ markdown: string; onChange: (markdown: string) => void }> = ({ markdown, onChange }) => {
  const [menu, setMenu] = useState<Menu | null>(null);
  // The suggestion plugin calls back from outside React; it reads the latest menu through this.
  const menuRef = useRef<Menu | null>(null);
  const show = (props: SuggestionProps<SlashItem, SlashItem>, selected = 0) => {
    const rect = props.clientRect?.();
    const next = props.items.length && rect
      ? { items: props.items, selected: Math.min(selected, props.items.length - 1), left: rect.left, top: rect.bottom + 6, command: props.command }
      : null;
    menuRef.current = next;
    setMenu(next);
  };

  const SlashCommand = useRef(Extension.create({
    name: 'slashCommand',
    addProseMirrorPlugins() {
      return [Suggestion<SlashItem, SlashItem>({
        editor: this.editor,
        char: '/',
        items: ({ query }) => SLASH_ITEMS.filter((i) => i.title.toLowerCase().includes(query.toLowerCase())),
        command: ({ editor, range, props }) => props.run(editor, range),
        render: () => ({
          onStart: (props) => show(props),
          onUpdate: (props) => show(props, menuRef.current?.selected ?? 0),
          onKeyDown: ({ event }) => {
            const current = menuRef.current;
            if (!current) return false;
            if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
              const step = event.key === 'ArrowDown' ? 1 : -1;
              const next = { ...current, selected: (current.selected + step + current.items.length) % current.items.length };
              menuRef.current = next;
              setMenu(next);
              return true;
            }
            if (event.key === 'Enter') { current.command(current.items[current.selected]); return true; }
            if (event.key === 'Escape') { menuRef.current = null; setMenu(null); return true; }
            return false;
          },
          onExit: () => { menuRef.current = null; setMenu(null); },
        }),
      })];
    },
  })).current;

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ link: { openOnClick: false } }),
      Markdown,
      TaskList,
      TaskItem.configure({ nested: true }),
      Placeholder.configure({ placeholder: 'Write, or type / for blocks…' }),
      AutoDirection,
      SlashCommand,
    ],
    content: markdown,
    contentType: 'markdown',
    editorProps: { attributes: { class: 'note-editor', spellcheck: 'false' } },
    onUpdate: ({ editor: e }) => onChange(e.getMarkdown()),
  });

  const tool = (label: string, active: boolean, run: () => void, tip: string) => (
    <Button key={label} size="sm" tone={active ? 'ink' : 'ghost'} data-tip={tip} onMouseDown={(e) => e.preventDefault()} onClick={run}>{label}</Button>
  );

  return (
    <div>
      {editor && (
        <div className="spring-group flex flex-wrap gap-1.5 mb-4 pb-3 border-b border-ink/10">
          {tool('B', editor.isActive('bold'), () => editor.chain().focus().toggleBold().run(), 'Bold')}
          {tool('I', editor.isActive('italic'), () => editor.chain().focus().toggleItalic().run(), 'Italic')}
          {tool('S', editor.isActive('strike'), () => editor.chain().focus().toggleStrike().run(), 'Strikethrough')}
          {tool('H1', editor.isActive('heading', { level: 1 }), () => editor.chain().focus().toggleHeading({ level: 1 }).run(), 'Heading 1')}
          {tool('H2', editor.isActive('heading', { level: 2 }), () => editor.chain().focus().toggleHeading({ level: 2 }).run(), 'Heading 2')}
          {tool('•', editor.isActive('bulletList'), () => editor.chain().focus().toggleBulletList().run(), 'Bulleted list')}
          {tool('1.', editor.isActive('orderedList'), () => editor.chain().focus().toggleOrderedList().run(), 'Numbered list')}
          {tool('☐', editor.isActive('taskList'), () => editor.chain().focus().toggleTaskList().run(), 'To-do list')}
          {tool('❝', editor.isActive('blockquote'), () => editor.chain().focus().toggleBlockquote().run(), 'Quote')}
          {tool('</>', editor.isActive('codeBlock'), () => editor.chain().focus().toggleCodeBlock().run(), 'Code')}
        </div>
      )}
      <EditorContent editor={editor} />
      {menu && (
        <ul
          role="listbox"
          className="fixed z-[10000] w-60 max-h-72 overflow-y-auto bg-paper-dark border border-ink/14 rounded-box p-1"
          style={{ left: Math.min(menu.left, window.innerWidth - 250), top: menu.top }}
        >
          {menu.items.map((item, i) => (
            <li key={item.title} role="option" aria-selected={i === menu.selected}>
              <button
                type="button"
                onMouseDown={(e) => { e.preventDefault(); menu.command(item); }}
                className={`w-full text-left px-3 py-2 rounded-[8px] transition-colors ${i === menu.selected ? 'bg-ink/10' : 'hover:bg-ink/6'}`}
              >
                <span className="block font-sans-main text-[13px] font-semibold">{item.title}</span>
                <span className="block font-mono-main text-[9px] uppercase tracking-wider text-ink/40">{item.hint}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
