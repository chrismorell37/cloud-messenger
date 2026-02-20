import { NodeViewWrapper } from '@tiptap/react'
import type { NodeViewProps } from '@tiptap/react'
import { useRef } from 'react'

export function AudioPlayer({ node, updateAttributes }: NodeViewProps) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const { src, played } = node.attrs

  const handlePlay = () => {
    if (!played) {
      updateAttributes({ played: true })
    }
  }

  return (
    <NodeViewWrapper className="audio-player-wrapper">
      <div className="relative">
        {!played && (
          <span className="audio-new-badge">
            New!
          </span>
        )}
        <audio
          ref={audioRef}
          src={src}
          controls
          preload="metadata"
          onPlay={handlePlay}
          className="w-full rounded-lg"
        />
      </div>
    </NodeViewWrapper>
  )
}
