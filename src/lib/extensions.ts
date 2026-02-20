import { Node, mergeAttributes, ReactNodeViewRenderer } from '@tiptap/react'
import { AudioPlayer } from '../components/AudioPlayer'

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

// Custom Audio extension for TipTap with "New!" badge support
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
      played: {
        default: false,
      },
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
      spotifyUri: {
        default: null,
      },
    }
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-spotify-embed]',
      },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    const spotifyUri = HTMLAttributes.spotifyUri || ''
    // Convert spotify URI or URL to embed URL
    // Handles: spotify:track:xxx, https://open.spotify.com/track/xxx
    let embedUrl = ''
    if (spotifyUri.startsWith('spotify:')) {
      // Convert URI format: spotify:track:xxx -> https://open.spotify.com/embed/track/xxx
      const parts = spotifyUri.split(':')
      if (parts.length >= 3) {
        embedUrl = `https://open.spotify.com/embed/${parts[1]}/${parts[2]}`
      }
    } else if (spotifyUri.includes('open.spotify.com')) {
      // Convert URL format: https://open.spotify.com/track/xxx -> embed version
      embedUrl = spotifyUri.replace('open.spotify.com/', 'open.spotify.com/embed/')
      // Remove any query params
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

// Type declarations for custom commands
declare module '@tiptap/react' {
  interface Commands<ReturnType> {
    video: {
      setVideo: (options: { src: string; poster?: string }) => ReturnType
    }
    audio: {
      setAudio: (options: { src: string }) => ReturnType
    }
    spotifyEmbed: {
      setSpotifyEmbed: (options: { spotifyUri: string }) => ReturnType
    }
  }
}
