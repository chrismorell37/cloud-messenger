import { FFmpeg } from '@ffmpeg/ffmpeg'
import { fetchFile, toBlobURL } from '@ffmpeg/util'

const MAX_SIZE_BYTES = 75 * 1024 * 1024 // 75MB
const BASE_URL = 'https://unpkg.com/@ffmpeg/core@0.12.6/dist/esm'

let ffmpeg: FFmpeg | null = null
let ffmpegLoaded = false

async function loadFFmpeg(onProgress?: (progress: number) => void): Promise<FFmpeg> {
  if (ffmpeg && ffmpegLoaded) {
    return ffmpeg
  }

  ffmpeg = new FFmpeg()

  ffmpeg.on('progress', ({ progress }) => {
    if (onProgress) {
      // Progress is 0-1, convert to percentage for compression phase
      onProgress(Math.round(progress * 100))
    }
  })

  // Load ffmpeg core from CDN
  await ffmpeg.load({
    coreURL: await toBlobURL(`${BASE_URL}/ffmpeg-core.js`, 'text/javascript'),
    wasmURL: await toBlobURL(`${BASE_URL}/ffmpeg-core.wasm`, 'application/wasm'),
  })

  ffmpegLoaded = true
  return ffmpeg
}

export async function compressVideoIfNeeded(
  file: File,
  onProgress?: (progress: number) => void
): Promise<File> {
  // Check if compression is needed
  if (file.size <= MAX_SIZE_BYTES) {
    console.log(`Video size ${(file.size / 1024 / 1024).toFixed(1)}MB is under ${MAX_SIZE_BYTES / 1024 / 1024}MB limit, skipping compression`)
    return file
  }

  console.log(`Video size ${(file.size / 1024 / 1024).toFixed(1)}MB exceeds ${MAX_SIZE_BYTES / 1024 / 1024}MB limit, compressing...`)

  try {
    // Load ffmpeg (lazy loading - only loads on first use)
    const ff = await loadFFmpeg(onProgress)

    // Get file extension
    const inputName = 'input' + getExtension(file.name)
    const outputName = 'output.mp4'

    // Write input file to ffmpeg virtual filesystem
    await ff.writeFile(inputName, await fetchFile(file))

    // Compress video to 720p with reasonable quality
    // -vf scale=-2:720 : Scale to 720p height, width auto-calculated to maintain aspect ratio
    // -c:v libx264 : Use H.264 codec (widely compatible)
    // -crf 28 : Constant Rate Factor (18-28 is good, higher = smaller file)
    // -preset fast : Encoding speed/quality tradeoff
    // -c:a aac -b:a 128k : Audio codec and bitrate
    // -movflags +faststart : Optimize for web streaming
    await ff.exec([
      '-i', inputName,
      '-vf', 'scale=-2:720',
      '-c:v', 'libx264',
      '-crf', '28',
      '-preset', 'fast',
      '-c:a', 'aac',
      '-b:a', '128k',
      '-movflags', '+faststart',
      '-y',
      outputName
    ])

    // Read the output file
    const data = await ff.readFile(outputName)

    // Clean up virtual filesystem
    await ff.deleteFile(inputName)
    await ff.deleteFile(outputName)

    // Create new File from compressed data
    // Copy to a regular ArrayBuffer to avoid SharedArrayBuffer compatibility issues
    const uint8Array = new Uint8Array(data as Uint8Array)
    const arrayBuffer = uint8Array.buffer.slice(uint8Array.byteOffset, uint8Array.byteOffset + uint8Array.byteLength)
    const compressedBlob = new Blob([arrayBuffer], { type: 'video/mp4' })
    const compressedFile = new File(
      [compressedBlob],
      file.name.replace(/\.[^/.]+$/, '') + '_compressed.mp4',
      { type: 'video/mp4' }
    )

    console.log(`Compression complete: ${(file.size / 1024 / 1024).toFixed(1)}MB → ${(compressedFile.size / 1024 / 1024).toFixed(1)}MB (${Math.round((1 - compressedFile.size / file.size) * 100)}% reduction)`)

    return compressedFile
  } catch (error) {
    console.error('Video compression failed:', error)
    // Return original file if compression fails
    return file
  }
}

function getExtension(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase()
  if (ext && ['mp4', 'mov', 'webm', 'avi', 'mkv', 'm4v'].includes(ext)) {
    return '.' + ext
  }
  return '.mp4'
}

export function isVideoFile(file: File): boolean {
  return file.type.startsWith('video/')
}

export function getFileSizeMB(file: File): number {
  return file.size / 1024 / 1024
}

export const MAX_SIZE_MB = MAX_SIZE_BYTES / 1024 / 1024
