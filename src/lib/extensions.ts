import { Node, mergeAttributes, ReactNodeViewRenderer } from '@tiptap/react'
import { AudioPlayer } from '../components/AudioPlayer'
import { ImageNode } from '../components/ImageNode'
import { VideoNode } from '../components/VideoNode'
import { SpotifyNode } from '../components/SpotifyNode'
import { ImageGalleryNode } from '../components/ImageGalleryNode'

// Shared attributes for reactions and replies
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
}

// Custom Image extension with reactions and replies
export const CustomImage = Node.create({
  name: 'image',
  group: 'block',
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      src: { default: null },
      alt: { default: null },
      title: { default: null },
      ...mediaInteractionAttributes,
    }
  },

  parseHTML() {
    return [{ tag: 'img[src]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['img', mergeAttributes(HTMLAttributes, {
      style: 'width: 100%; height: auto; border-radius: 0.5rem;',
    })]
  },

  addNodeView() {
    return ReactNodeViewRenderer(ImageNode)
  },

  addCommands() {
    return {
      setImage:
        (options: { src: string; alt?: string; title?: string }) =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: options,
          })
        },
    }
  },
})

// Custom Video extension for TipTap
export const Video = Node.create({
  name: 'video',
  group: 'block',
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      src: { default: null },
      poster: { default: null },
      ...mediaInteractionAttributes,
    }
  },

  parseHTML() {
    return [{ tag: 'video' }]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'video',
      mergeAttributes(HTMLAttributes, {
        controls: true,
        playsinline: true,
        'webkit-playsinline': true,
        preload: 'metadata',
        autoplay: false,
        loop: false,
        style: 'width: 100%; height: auto; border-radius: 0.5rem; object-fit: contain;',
      }),
    ]
  },

  addNodeView() {
    return ReactNodeViewRenderer(VideoNode)
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

// Custom Audio extension for TipTap with "New!" badge support
export const Audio = Node.create({
  name: 'audio',
  group: 'block',
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      src: { default: null },
      played: { default: false },
      transcription: { default: null },
      ...mediaInteractionAttributes,
    }
  },

  parseHTML() {
    return [
      {
        tag: 'audio',
        getAttrs: (node) => {
          if (typeof node === 'string') return {}
          return {
            src: node.getAttribute('src'),
            played: node.getAttribute('data-played') === 'true',
            transcription: node.getAttribute('data-transcription') || null,
          }
        },
      },
      {
        tag: 'div[data-audio-player]',
        getAttrs: (node) => {
          if (typeof node === 'string') return {}
          const audio = node.querySelector('audio')
          return {
            src: audio?.getAttribute('src') || null,
            played: node.getAttribute('data-played') === 'true',
          }
        },
      },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes({
        'data-audio-player': 'true',
        'data-played': HTMLAttributes.played ? 'true' : 'false',
      }),
      [
        'audio',
        {
          src: HTMLAttributes.src,
          controls: true,
          preload: 'metadata',
          style: 'width: 100%; border-radius: 0.5rem;',
        },
      ],
    ]
  },

  addNodeView() {
    return ReactNodeViewRenderer(AudioPlayer)
  },

  addCommands() {
    return {
      setAudio:
        (options: { src: string }) =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: { ...options, played: false },
          })
        },
    }
  },
})

// Custom Spotify Embed extension for TipTap
export const SpotifyEmbed = Node.create({
  name: 'spotifyEmbed',
  group: 'block',
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      spotifyUri: { default: null },
      ...mediaInteractionAttributes,
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-spotify-embed]' }]
  },

  renderHTML({ HTMLAttributes }) {
    const spotifyUri = HTMLAttributes.spotifyUri || ''
    let embedUrl = ''
    if (spotifyUri.startsWith('spotify:')) {
      const parts = spotifyUri.split(':')
      if (parts.length >= 3) {
        embedUrl = `https://open.spotify.com/embed/${parts[1]}/${parts[2]}`
      }
    } else if (spotifyUri.includes('open.spotify.com')) {
      embedUrl = spotifyUri.replace('open.spotify.com/', 'open.spotify.com/embed/')
      embedUrl = embedUrl.split('?')[0]
    }

    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-spotify-embed': 'true',
        style: 'width: 100%; margin: 1rem 0;',
      }),
      [
        'iframe',
        {
          src: embedUrl,
          width: '100%',
          height: '80',
          frameBorder: '0',
          allow: 'autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture',
          loading: 'lazy',
          style: 'border-radius: 12px;',
        },
      ],
    ]
  },

  addNodeView() {
    return ReactNodeViewRenderer(SpotifyNode)
  },

  addCommands() {
    return {
      setSpotifyEmbed:
        (options: { spotifyUri: string }) =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: options,
          })
        },
    }
  },
})

// Custom Image Gallery extension for carousel/album display
export const ImageGallery = Node.create({
  name: 'imageGallery',
  group: 'block',
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      images: {
        default: [],
        parseHTML: (element: HTMLElement) => {
          const data = element.getAttribute('data-images')
          return data ? JSON.parse(data) : []
        },
        renderHTML: (attributes: { images?: string[] }) => {
          if (!attributes.images || attributes.images.length === 0) {
            return {}
          }
          return { 'data-images': JSON.stringify(attributes.images) }
        },
      },
      ...mediaInteractionAttributes,
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-image-gallery]' }]
  },

  renderHTML({ HTMLAttributes }) {
    const images = HTMLAttributes.images || []
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-image-gallery': 'true',
        style: 'width: 100%; margin: 1rem 0;',
      }),
      ...images.map((src: string) => [
        'img',
        {
          src,
          style: 'width: 100%; height: auto; border-radius: 0.5rem;',
        },
      ]),
    ]
  },

  addNodeView() {
    return ReactNodeViewRenderer(ImageGalleryNode)
  },

  addCommands() {
    return {
      setImageGallery:
        (options: { images: string[] }) =>
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
    image: {
      setImage: (options: { src: string; alt?: string; title?: string }) => ReturnType
    }
    video: {
      setVideo: (options: { src: string; poster?: string }) => ReturnType
    }
    audio: {
      setAudio: (options: { src: string }) => ReturnType
    }
    spotifyEmbed: {
      setSpotifyEmbed: (options: { spotifyUri: string }) => ReturnType
    }
    imageGallery: {
      setImageGallery: (options: { images: string[] }) => ReturnType
    }
  }
}
