import { Node, mergeAttributes, ReactNodeViewRenderer } from '@tiptap/react'
import { InstagramNode } from '../components/InstagramNode'

const mediaInteractionAttributes = {
  reactions: {
    default: {},
    parseHTML: (element: HTMLElement) => {
      const data = element.getAttribute('data-reactions')
      return data ? JSON.parse(data) : {}
    },
    renderHTML: (attributes: { reactions?: Record<string, string[]> }) => {
      if (!attributes.reactions || Object.keys(attributes.reactions).length === 0) {
        return {}
      }
      return { 'data-reactions': JSON.stringify(attributes.reactions) }
    },
  },
  replies: {
    default: [],
    parseHTML: (element: HTMLElement) => {
      const data = element.getAttribute('data-replies')
      return data ? JSON.parse(data) : []
    },
    renderHTML: (attributes: { replies?: unknown[] }) => {
      if (!attributes.replies || attributes.replies.length === 0) {
        return {}
      }
      return { 'data-replies': JSON.stringify(attributes.replies) }
    },
  },
  createdAt: {
    default: null,
    parseHTML: (element: HTMLElement) => element.getAttribute('data-created-at'),
    renderHTML: (attributes: { createdAt?: string | null }) => {
      if (!attributes.createdAt) return {}
      return { 'data-created-at': attributes.createdAt }
    },
  },
}

export function getInstagramEmbedUrl(url: string): string {
  const cleanUrl = url.split('?')[0].replace(/\/$/, '')
  return `${cleanUrl}/embed/`
}

export function extractInstagramUrl(text: string): string | null {
  const match = text.match(
    /https?:\/\/(www\.)?instagram\.com\/(p|reel|reels)\/([a-zA-Z0-9_-]+)/
  )
  return match ? match[0] : null
}

export function getInstagramContentType(url: string): 'post' | 'reel' {
  if (url.includes('/reel/') || url.includes('/reels/')) {
    return 'reel'
  }
  return 'post'
}

export const InstagramEmbed = Node.create({
  name: 'instagramEmbed',
  group: 'block',
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      instagramUrl: { default: null },
      ...mediaInteractionAttributes,
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-instagram-embed]' }]
  },

  renderHTML({ HTMLAttributes }) {
    const instagramUrl = HTMLAttributes.instagramUrl || ''
    const embedUrl = getInstagramEmbedUrl(instagramUrl)

    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-instagram-embed': 'true',
        style: 'width: 100%; margin: 1rem 0;',
      }),
      [
        'iframe',
        {
          src: embedUrl,
          width: '100%',
          height: '500',
          frameBorder: '0',
          scrolling: 'no',
          allowtransparency: 'true',
          loading: 'lazy',
          style: 'border-radius: 12px; border: 1px solid #dbdbdb;',
        },
      ],
    ]
  },

  addNodeView() {
    return ReactNodeViewRenderer(InstagramNode)
  },

  addCommands() {
    return {
      setInstagramEmbed:
        (options: { instagramUrl: string }) =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: options,
          })
        },
    }
  },
})

declare module '@tiptap/react' {
  interface Commands<ReturnType> {
    instagramEmbed: {
      setInstagramEmbed: (options: { instagramUrl: string }) => ReturnType
    }
  }
}
