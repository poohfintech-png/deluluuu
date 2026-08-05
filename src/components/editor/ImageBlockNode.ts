import { Node, mergeAttributes } from '@tiptap/core'
import { ReactNodeViewRenderer } from '@tiptap/react'
import { ImageBlockView } from './ImageBlockView'

export interface ImageNodeAttrs {
  src: string
  alt: string
  caption: string
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    imageBlock: {
      insertImageBlock: (attrs: ImageNodeAttrs) => ReturnType
    }
  }
}

export const ImageBlockNode = Node.create({
  name: 'imageBlock',
  group: 'block',
  atom: true,
  draggable: true,
  selectable: true,

  addAttributes() {
    return {
      src: { default: '' },
      alt: { default: '' },
      caption: { default: '' },
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-type="image-block"]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'image-block' })]
  },

  addCommands() {
    return {
      insertImageBlock:
        (attrs) =>
        ({ commands }) => {
          return commands.insertContent({ type: 'imageBlock', attrs })
        },
    }
  },

  addNodeView() {
    return ReactNodeViewRenderer(ImageBlockView)
  },
})
