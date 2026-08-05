import { useEffect, useRef, useState, useCallback } from 'react'
import { useEditor, EditorContent, type Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Link from '@tiptap/extension-link'
import Underline from '@tiptap/extension-underline'
import Placeholder from '@tiptap/extension-placeholder'
import TextAlign from '@tiptap/extension-text-align'
import TaskList from '@tiptap/extension-task-list'
import TaskItem from '@tiptap/extension-task-item'
import { Table } from '@tiptap/extension-table'
import { TableRow } from '@tiptap/extension-table-row'
import { TableCell } from '@tiptap/extension-table-cell'
import { TableHeader } from '@tiptap/extension-table-header'
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  List,
  ListOrdered,
  CheckSquare,
  Heading1,
  Heading2,
  Heading3,
  Quote,
  Code,
  Minus,
  Link as LinkIcon,
  Image as ImageIcon,
  Headphones,
  Video,
  Undo,
  Redo,
  Unlink,
  Text as TextIcon,
  Table as TableIcon,
} from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import { cn } from '@/lib/utils'
import { AudioNode } from './AudioNode'
import { VideoNode } from './VideoNode'
import { ImageBlockNode } from './ImageBlockNode'
import { MediaInsertDialog, type MediaKind, type MediaInsertResult } from './MediaInsertDialog'

interface ChapterTipTapEditorProps {
  content: object | null
  onChange: (json: object) => void
}

export function ChapterTipTapEditor({ content, onChange }: ChapterTipTapEditorProps) {
  const { user } = useAuth()
  const { toast } = useToast()
  const [slashMenu, setSlashMenu] = useState<{ top: number; left: number } | null>(null)
  const [floatingToolbar, setFloatingToolbar] = useState<{ top: number; left: number } | null>(null)
  const [mediaDialog, setMediaDialog] = useState<MediaKind | null>(null)
  const [uploadingImage, setUploadingImage] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const skipNextUpdate = useRef(false)

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: { class: 'text-primary underline' },
      }),
      Underline,
      Placeholder.configure({
        placeholder: 'Write your story, or type / for commands...',
      }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Table.configure({ resizable: true }),
      TableRow,
      TableCell,
      TableHeader,
      AudioNode,
      VideoNode,
      ImageBlockNode,
    ],
    content: content || { type: 'doc', content: [{ type: 'paragraph' }] },
    onUpdate: ({ editor }) => {
      if (skipNextUpdate.current) {
        skipNextUpdate.current = false
        return
      }
      onChange(editor.getJSON())
    },
    editorProps: {
      attributes: {
        class: 'tiptap-editor-content min-h-[500px] max-w-none focus:outline-none px-6 py-4',
      },
      handleDrop: (view, event) => {
        const files = event.dataTransfer?.files
        if (!files || files.length === 0) return false
        const imageFile = Array.from(files).find((f) => f.type.startsWith('image/'))
        if (imageFile) {
          event.preventDefault()
          handleImageUpload(imageFile)
          return true
        }
        return false
      },
      handlePaste: (view, event) => {
        const items = event.clipboardData?.items
        if (!items) return false
        for (const item of items) {
          if (item.type.startsWith('image/')) {
            const file = item.getAsFile()
            if (file) {
              event.preventDefault()
              handleImageUpload(file)
              return true
            }
          }
        }
        return false
      },
    },
  })

  // Sync external content changes (when loading a chapter)
  useEffect(() => {
    if (editor && content) {
      skipNextUpdate.current = true
      editor.commands.setContent(content)
    }
  }, [content, editor])

  // Slash command + floating toolbar detection
  useEffect(() => {
    if (!editor) return

    const handleUpdate = () => {
      const { state } = editor
      const { selection } = state
      const $from = selection.$from
      const textBefore = $from.parent.textContent.slice(0, $from.parentOffset)

      // Slash menu
      if (textBefore === '/') {
        const coords = editor.view.coordsAtPos(selection.from)
        const rect = containerRef.current?.getBoundingClientRect()
        if (rect) {
          setSlashMenu({ top: coords.bottom - rect.top, left: coords.left - rect.left })
        }
      } else {
        setSlashMenu(null)
      }

      // Floating toolbar
      if (!selection.empty && !editor.isActive('code') && selection.from !== selection.to) {
        const coords = editor.view.coordsAtPos(selection.from)
        const rect = containerRef.current?.getBoundingClientRect()
        if (rect) {
          setFloatingToolbar({ top: coords.top - rect.top - 52, left: coords.left - rect.left })
        }
      } else {
        setFloatingToolbar(null)
      }
    }

    const handleBlur = () => {
      setTimeout(() => {
        setSlashMenu(null)
        setFloatingToolbar(null)
      }, 200)
    }

    editor.on('selectionUpdate', handleUpdate)
    editor.on('update', handleUpdate)
    editor.on('blur', handleBlur)

    return () => {
      editor.off('selectionUpdate', handleUpdate)
      editor.off('update', handleUpdate)
      editor.off('blur', handleBlur)
    }
  }, [editor])

  const handleImageUpload = async (file: File) => {
    if (!user || !editor) return
    if (!file.type.match(/image\/(jpeg|jpg|png|webp|gif)/)) {
      toast('Only JPG, PNG, WebP, and GIF images are supported', 'error')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      toast('Image must be under 5MB', 'error')
      return
    }

    setUploadingImage(true)
    const ext = file.name.split('.').pop() ?? 'png'
    const path = `${user.id}/${Date.now()}.${ext}`
    const { error } = await supabase.storage.from('content-media').upload(path, file)
    if (error) {
      toast('Image upload failed: ' + error.message, 'error')
      setUploadingImage(false)
      return
    }
    const { data } = supabase.storage.from('content-media').getPublicUrl(path)
    editor.chain().focus().insertContent({ type: 'imageBlock', attrs: { src: data.publicUrl, alt: '', caption: '' } }).run()
    toast('Image inserted', 'success')
    setUploadingImage(false)
  }

  const openMediaDialog = useCallback((kind: MediaKind) => {
    if (kind === 'image') {
      fileInputRef.current?.click()
      return
    }
    setMediaDialog(kind)
  }, [])

  const handleMediaInsert = useCallback(
    (result: MediaInsertResult) => {
      if (!editor) return
      if (mediaDialog === 'audio') {
        editor.chain().focus().insertContent({
          type: 'audio',
          attrs: { url: result.url, title: result.title, duration: result.duration ?? '' },
        }).run()
      } else if (mediaDialog === 'video') {
        editor.chain().focus().insertContent({
          type: 'video',
          attrs: { url: result.url, title: result.title },
        }).run()
      }
      setMediaDialog(null)
    },
    [editor, mediaDialog],
  )

  const setLink = useCallback(() => {
    if (!editor) return
    const prev = editor.getAttributes('link').href ?? ''
    const url = window.prompt('Enter URL', prev)
    if (url === null) return
    if (url === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run()
      return
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
  }, [editor])

  if (!editor) {
    return (
      <div className="rounded-lg border border-border bg-background p-4 min-h-[500px] flex items-center justify-center">
        <div className="h-8 w-8 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
      </div>
    )
  }

  const slashCommands = [
    { label: 'Text', icon: TextIcon, action: () => editor.chain().focus().setParagraph().run() },
    { label: 'Heading 1', icon: Heading1, action: () => editor.chain().focus().toggleHeading({ level: 1 }).run() },
    { label: 'Heading 2', icon: Heading2, action: () => editor.chain().focus().toggleHeading({ level: 2 }).run() },
    { label: 'Heading 3', icon: Heading3, action: () => editor.chain().focus().toggleHeading({ level: 3 }).run() },
    { label: 'Bullet List', icon: List, action: () => editor.chain().focus().toggleBulletList().run() },
    { label: 'Numbered List', icon: ListOrdered, action: () => editor.chain().focus().toggleOrderedList().run() },
    { label: 'Checklist', icon: CheckSquare, action: () => editor.chain().focus().toggleTaskList().run() },
    { label: 'Quote', icon: Quote, action: () => editor.chain().focus().toggleBlockquote().run() },
    { label: 'Code Block', icon: Code, action: () => editor.chain().focus().toggleCodeBlock().run() },
    { label: 'Divider', icon: Minus, action: () => editor.chain().focus().setHorizontalRule().run() },
    { label: 'Table', icon: TableIcon, action: () => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run() },
    { label: 'Image', icon: ImageIcon, action: () => openMediaDialog('image') },
    { label: 'Audio', icon: Headphones, action: () => openMediaDialog('audio') },
    { label: 'Video', icon: Video, action: () => openMediaDialog('video') },
  ]

  return (
    <div ref={containerRef} className="relative">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) handleImageUpload(f)
          e.target.value = ''
        }}
      />

      {/* Top toolbar */}
      <div className="sticky top-0 z-20 flex items-center gap-0.5 flex-wrap rounded-t-lg border border-b-0 border-border bg-secondary/30 p-1.5">
        <TBtn icon={Undo} onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} />
        <TBtn icon={Redo} onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} />
        <Sep />
        <TBtn icon={Heading1} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} active={editor.isActive('heading', { level: 1 })} />
        <TBtn icon={Heading2} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive('heading', { level: 2 })} />
        <TBtn icon={Heading3} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive('heading', { level: 3 })} />
        <Sep />
        <TBtn icon={Bold} onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')} />
        <TBtn icon={Italic} onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')} />
        <TBtn icon={UnderlineIcon} onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive('underline')} />
        <TBtn icon={Strikethrough} onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive('strike')} />
        <Sep />
        <TBtn icon={List} onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive('bulletList')} />
        <TBtn icon={ListOrdered} onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive('orderedList')} />
        <TBtn icon={CheckSquare} onClick={() => editor.chain().focus().toggleTaskList().run()} active={editor.isActive('taskList')} />
        <TBtn icon={Quote} onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive('blockquote')} />
        <TBtn icon={Code} onClick={() => editor.chain().focus().toggleCodeBlock().run()} active={editor.isActive('codeBlock')} />
        <Sep />
        <TBtn icon={Minus} onClick={() => editor.chain().focus().setHorizontalRule().run()} />
        <TBtn icon={TableIcon} onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()} />
        <TBtn icon={LinkIcon} onClick={setLink} active={editor.isActive('link')} />
        <TBtn icon={Unlink} onClick={() => editor.chain().focus().unsetLink().run()} disabled={!editor.isActive('link')} />
        <Sep />
        <TBtn icon={ImageIcon} onClick={() => openMediaDialog('image')} />
        <TBtn icon={Headphones} onClick={() => openMediaDialog('audio')} />
        <TBtn icon={Video} onClick={() => openMediaDialog('video')} />
      </div>

      {/* Editor area */}
      <div className="rounded-b-lg border border-border bg-background">
        <EditorContent editor={editor} />
      </div>

      {/* Floating toolbar */}
      {floatingToolbar && (
        <div
          className="absolute z-30 flex items-center gap-0.5 rounded-lg border border-border bg-popover p-1 shadow-lg animate-scale-in"
          style={{ top: floatingToolbar.top, left: floatingToolbar.left }}
          onMouseDown={(e) => e.preventDefault()}
        >
          <FBtn icon={Bold} onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive('bold')} />
          <FBtn icon={Italic} onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive('italic')} />
          <FBtn icon={UnderlineIcon} onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive('underline')} />
          <FBtn icon={Strikethrough} onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive('strike')} />
          <Sep />
          <FBtn icon={Heading1} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} active={editor.isActive('heading', { level: 1 })} />
          <FBtn icon={Heading2} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive('heading', { level: 2 })} />
          <FBtn icon={Heading3} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive('heading', { level: 3 })} />
          <Sep />
          <FBtn icon={LinkIcon} onClick={setLink} active={editor.isActive('link')} />
          <FBtn icon={Quote} onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive('blockquote')} />
          <FBtn icon={Code} onClick={() => editor.chain().focus().toggleCode().run()} active={editor.isActive('code')} />
        </div>
      )}

      {/* Slash menu */}
      {slashMenu && (
        <div
          className="absolute z-30 w-64 max-h-80 overflow-y-auto rounded-lg border border-border bg-popover p-1.5 shadow-xl animate-scale-in scrollbar-thin"
          style={{ top: slashMenu.top, left: slashMenu.left }}
          onMouseDown={(e) => e.preventDefault()}
        >
          <p className="px-2 py-1 text-[10px] text-muted-foreground uppercase tracking-wide">Blocks</p>
          {slashCommands.map((cmd) => {
            const Icon = cmd.icon
            return (
              <button
                key={cmd.label}
                onClick={() => {
                  cmd.action()
                  setSlashMenu(null)
                  editor.chain().focus().deleteRange({ from: editor.state.selection.from - 1, to: editor.state.selection.from }).run()
                }}
                className="flex items-center gap-3 w-full px-2 py-1.5 rounded-md text-sm hover:bg-secondary transition-colors text-left"
              >
                <div className="flex h-7 w-7 items-center justify-center rounded-md bg-secondary/60">
                  <Icon className="h-3.5 w-3.5" />
                </div>
                {cmd.label}
              </button>
            )
          })}
        </div>
      )}

      {/* Image upload overlay */}
      {uploadingImage && (
        <div className="absolute inset-0 bg-background/60 backdrop-blur-sm flex items-center justify-center rounded-lg z-40">
          <div className="flex flex-col items-center gap-2">
            <div className="h-8 w-8 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
            <p className="text-xs text-muted-foreground">Uploading image...</p>
          </div>
        </div>
      )}

      {/* Media insert dialog */}
      {mediaDialog && (
        <MediaInsertDialog
          kind={mediaDialog}
          onClose={() => setMediaDialog(null)}
          onInsert={handleMediaInsert}
        />
      )}
    </div>
  )
}

function TBtn({ icon: Icon, onClick, active, disabled }: { icon: typeof Bold; onClick: () => void; active?: boolean; disabled?: boolean }) {
  return (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'flex items-center justify-center h-7 w-7 rounded text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors disabled:opacity-30 disabled:cursor-not-allowed',
        active && 'bg-primary/15 text-primary',
      )}
    >
      <Icon className="h-3.5 w-3.5" />
    </button>
  )
}

function FBtn({ icon: Icon, onClick, active }: { icon: typeof Bold; onClick: () => void; active?: boolean }) {
  return (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={cn(
        'flex items-center justify-center h-7 w-7 rounded text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors',
        active && 'bg-primary/15 text-primary',
      )}
    >
      <Icon className="h-3.5 w-3.5" />
    </button>
  )
}

function Sep() {
  return <div className="w-px h-5 bg-border mx-0.5" />
}
