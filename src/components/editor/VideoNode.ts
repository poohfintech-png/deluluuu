import { Node, mergeAttributes } from '@tiptap/core'
import { ReactNodeViewRenderer } from '@tiptap/react'
import { VideoBlockView } from './VideoBlockView'

export interface VideoNodeAttrs {
  url: string
  title: string
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    video: {
      insertVideo: (attrs: VideoNodeAttrs) => ReturnType
    }
  }
}

export const VideoNode = Node.create({
  name: 'video',
  group: 'block',
  atom: true,
  draggable: true,
  selectable: true,

  addAttributes() {
    return {
      url: { default: '' },
      title: { default: '' },
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-type="video"]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'video' })]
  },

  addCommands() {
    return {
      insertVideo:
        (attrs) =>
        ({ commands }) => {
          return commands.insertContent({ type: 'video', attrs })
        },
    }
  },

  addNodeView() {
    return ReactNodeViewRenderer(VideoBlockView)
  },
})
