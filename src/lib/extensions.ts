import { Node, mergeAttributes } from '@tiptap/react'

// Custom Video extension for TipTap
export const Video = Node.create({
  name: 'video',
  group: 'block',
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      src: {
        default: null,
      },
      controls: {
        default: true,
      },
      autoplay: {
        default: false,
      },
      loop: {
        default: false,
      },
      muted: {
        default: false,
      },
      playsinline: {
        default: true, // Important for iOS
      },
      poster: {
        default: null,
      },
      width: {
        default: '100%',
      },
    }
  },

  parseHTML() {
    return [
      {
        tag: 'video',
      },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'video',
      mergeAttributes(HTMLAttributes, {
        controls: true,
        playsinline: true,
        'webkit-playsinline': true,
        preload: 'metadata',
        style: 'width: 100%; height: auto; border-radius: 0.5rem; object-fit: contain;',
      }),
    ]
  },

  addCommands() {
    return {
      setVideo:
        (options: { src: string; poster?: string }) =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: options,
          })
        },
    }
  },
})

// Custom Audio extension for TipTap
export const Audio = Node.create({
  name: 'audio',
  group: 'block',
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      src: {
        default: null,
      },
      controls: {
        default: true,
      },
      preload: {
        default: 'metadata',
      },
    }
  },

  parseHTML() {
    return [
      {
        tag: 'audio',
      },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'audio',
      mergeAttributes(HTMLAttributes, {
        controls: true,
        preload: 'metadata',
        style: 'width: 100%; border-radius: 0.5rem;',
      }),
    ]
  },

  addCommands() {
    return {
      setAudio:
        (options: { src: string }) =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: options,
          })
        },
    }
  },
})

// Type declarations for custom commands
declare module '@tiptap/react' {
  interface Commands<ReturnType> {
    video: {
      setVideo: (options: { src: string; poster?: string }) => ReturnType
    }
    audio: {
      setAudio: (options: { src: string }) => ReturnType
    }
  }
}
