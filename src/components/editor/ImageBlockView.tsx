import { useState, useRef, useCallback } from 'react'
import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react'
import { X, Pencil, ImagePlus, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

export function ImageBlockView({ node, updateAttributes, selected, deleteNode, editor }: NodeViewProps) {
  const src = node.attrs.src as string
  const alt = node.attrs.alt as string
  const caption = node.attrs.caption as string
  const isEditable = editor?.isEditable ?? false

  const [editingCaption, setEditingCaption] = useState(false)
  const [captionInput, setCaptionInput] = useState(caption)

  const saveCaption = useCallback(() => {
    updateAttributes({ caption: captionInput.trim() })
    setEditingCaption(false)
  }, [captionInput, updateAttributes])

  if (!src) {
    return (
      <NodeViewWrapper>
        <div className="my-4 flex items-center gap-3 rounded-lg border border-dashed border-border p-8">
          <ImagePlus className="h-6 w-6 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Image block (no source set)</span>
        </div>
      </NodeViewWrapper>
    )
  }

  return (
    <NodeViewWrapper>
      <figure className={cn('my-4 relative group', selected && 'ring-2 ring-primary/20 rounded-lg')}>
        <img
          src={src}
          alt={alt || caption || ''}
          className="w-full rounded-lg"
          loading="lazy"
        />
        {isEditable && (
          <button
            type="button"
            contentEditable={false}
            onClick={deleteNode}
            className="absolute top-2 right-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive"
          >
            <X className="h-4 w-4" />
          </button>
        )}
        {(caption || isEditable) && (
          <figcaption className="flex items-center gap-2 mt-2 px-1">
            {editingCaption && isEditable ? (
              <input
                type="text"
                value={captionInput}
                onChange={(e) => setCaptionInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') saveCaption(); if (e.key === 'Escape') setEditingCaption(false) }}
                onBlur={saveCaption}
                contentEditable={false}
                autoFocus
                placeholder="Add a caption..."
                className="flex-1 bg-transparent border-b border-primary text-xs text-muted-foreground outline-none"
              />
            ) : (
              <>
                <p className="text-xs text-muted-foreground italic flex-1 text-center">
                  {caption || 'No caption'}
                </p>
                {isEditable && (
                  <button
                    type="button"
                    contentEditable={false}
                    onClick={() => { setCaptionInput(caption); setEditingCaption(true) }}
                    className="text-muted-foreground/50 hover:text-foreground transition-colors"
                  >
                    <Pencil className="h-3 w-3" />
                  </button>
                )}
              </>
            )}
          </figcaption>
        )}
      </figure>
    </NodeViewWrapper>
  )
}
