import { useCallback, useEffect, useRef, useState } from 'react'
import { useChatStore } from '../../stores/chatStore'

export function ChatPhotoLightbox() {
  const { lightboxImage, setLightboxImage } = useChatStore()
  const [scale, setScale] = useState(1)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const imageRef = useRef<HTMLImageElement>(null)
  const lastTouchRef = useRef<{ x: number; y: number } | null>(null)
  const initialPinchDistanceRef = useRef<number | null>(null)
  const initialScaleRef = useRef(1)

  const resetView = useCallback(() => {
    setScale(1)
    setPosition({ x: 0, y: 0 })
  }, [])

  const handleClose = useCallback(() => {
    setLightboxImage(null)
    resetView()
  }, [setLightboxImage, resetView])

  const handleBackdropClick = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (e.target === containerRef.current) {
      handleClose()
    }
  }, [handleClose])

  const getTouchDistance = (touches: React.TouchList) => {
    if (touches.length < 2) return 0
    const dx = touches[0].clientX - touches[1].clientX
    const dy = touches[0].clientY - touches[1].clientY
    return Math.sqrt(dx * dx + dy * dy)
  }

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      e.preventDefault()
      initialPinchDistanceRef.current = getTouchDistance(e.touches)
      initialScaleRef.current = scale
    } else if (e.touches.length === 1 && scale > 1) {
      setIsDragging(true)
      lastTouchRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
    }
  }, [scale])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (e.touches.length === 2 && initialPinchDistanceRef.current !== null) {
      e.preventDefault()
      const currentDistance = getTouchDistance(e.touches)
      const scaleChange = currentDistance / initialPinchDistanceRef.current
      const newScale = Math.min(Math.max(initialScaleRef.current * scaleChange, 1), 5)
      setScale(newScale)
      
      if (newScale === 1) {
        setPosition({ x: 0, y: 0 })
      }
    } else if (e.touches.length === 1 && isDragging && lastTouchRef.current && scale > 1) {
      const deltaX = e.touches[0].clientX - lastTouchRef.current.x
      const deltaY = e.touches[0].clientY - lastTouchRef.current.y
      
      setPosition(prev => ({
        x: prev.x + deltaX,
        y: prev.y + deltaY,
      }))
      
      lastTouchRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY }
    }
  }, [isDragging, scale])

  const handleTouchEnd = useCallback(() => {
    initialPinchDistanceRef.current = null
    setIsDragging(false)
    lastTouchRef.current = null
  }, [])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose()
      }
    }

    if (lightboxImage) {
      document.addEventListener('keydown', handleKeyDown)
      document.body.style.overflow = 'hidden'
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = ''
    }
  }, [lightboxImage, handleClose])

  if (!lightboxImage) return null

  return (
    <div
      ref={containerRef}
      className="lightbox-backdrop"
      onClick={handleBackdropClick}
      onTouchEnd={(e) => {
        if (e.target === containerRef.current && !isDragging && scale === 1) {
          handleClose()
        }
      }}
    >
      <button
        onClick={handleClose}
        className="lightbox-close"
        aria-label="Close"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>

      <div 
        className="lightbox-image-container"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <img
          ref={imageRef}
          src={lightboxImage}
          alt="Full size"
          className="lightbox-image"
          style={{
            transform: `scale(${scale}) translate(${position.x / scale}px, ${position.y / scale}px)`,
          }}
          draggable={false}
        />
      </div>

      {scale > 1 && (
        <button
          onClick={resetView}
          className="lightbox-reset"
        >
          Reset zoom
        </button>
      )}
    </div>
  )
}
