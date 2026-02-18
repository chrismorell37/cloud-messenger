interface PresenceCursorsProps {
  cursor: { x: number; y: number }
  email: string
}

export default function PresenceCursors({ cursor, email }: PresenceCursorsProps) {
  const displayName = email.split('@')[0]
  
  // Generate a consistent color based on email
  const hue = email.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % 360
  const color = `hsl(${hue}, 70%, 60%)`

  return (
    <div
      className="pointer-events-none absolute z-50 transition-all duration-75 ease-out"
      style={{
        left: cursor.x,
        top: cursor.y,
        transform: 'translate(-2px, -2px)',
      }}
    >
      {/* Cursor pointer */}
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.5))' }}
      >
        <path
          d="M5.65376 12.4565L9.12031 20.7305C9.39581 21.3914 10.3277 21.3186 10.4999 20.6233L12.2355 13.7991C12.2945 13.5643 12.4712 13.3782 12.7033 13.3086L19.6303 11.1809C20.3079 10.9666 20.3287 10.0163 19.6613 9.77267L5.95817 4.65288C5.33882 4.42649 4.7413 5.02402 4.96769 5.64337L10.0873 19.3443"
          fill={color}
        />
        <path
          d="M5.65376 12.4565L9.12031 20.7305C9.39581 21.3914 10.3277 21.3186 10.4999 20.6233L12.2355 13.7991C12.2945 13.5643 12.4712 13.3782 12.7033 13.3086L19.6303 11.1809C20.3079 10.9666 20.3287 10.0163 19.6613 9.77267L5.95817 4.65288C5.33882 4.42649 4.7413 5.02402 4.96769 5.64337L10.0873 19.3443"
          stroke="white"
          strokeWidth="1.5"
        />
      </svg>

      {/* Name label */}
      <div
        className="absolute left-4 top-4 px-2 py-1 rounded-md text-xs font-medium text-white whitespace-nowrap shadow-lg"
        style={{ backgroundColor: color }}
      >
        {displayName}
      </div>
    </div>
  )
}
