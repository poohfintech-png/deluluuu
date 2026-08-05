import { Node, mergeAttributes, type NodeViewProps } from '@tiptap/core'
import { ReactNodeViewRenderer, type NodeViewWrapper } from '@tiptap/react'
import { AudioBlockView } from './AudioBlockView'

export interface AudioNodeAttrs {
  url: string
  title: string
  duration: string
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    audio: {
      insertAudio: (attrs: AudioNodeAttrs) => ReturnType
    }
  }
}

export const AudioNode = Node.create({
  name: 'audio',
  group: 'block',
  atom: true,
  draggable: true,
  selectable: true,

  addAttributes() {
    return {
      url: { default: '' },
      title: { default: '' },
      duration: { default: '' },
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-type="audio"]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'audio' })]
  },

  addCommands() {
    return {
      insertAudio:
        (attrs) =>
        ({ commands }) => {
          return commands.insertContent({ type: 'audio', attrs })
        },
    }
  },

  addNodeView() {
    return ReactNodeViewRenderer(AudioBlockView)
  },
})
