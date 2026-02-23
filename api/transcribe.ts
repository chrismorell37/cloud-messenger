import type { VercelRequest, VercelResponse } from '@vercel/node'

const OPENAI_API_KEY = process.env.OPENAI_API_KEY

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  if (!OPENAI_API_KEY) {
    console.error('Missing OPENAI_API_KEY environment variable')
    return res.status(500).json({ error: 'Server configuration error' })
  }

  const { audioUrl } = req.body

  if (!audioUrl) {
    return res.status(400).json({ error: 'audioUrl is required' })
  }

  try {
    // Download the audio file from Supabase storage
    const audioResponse = await fetch(audioUrl)
    if (!audioResponse.ok) {
      throw new Error(`Failed to fetch audio: ${audioResponse.status}`)
    }

    const audioBlob = await audioResponse.blob()
    
    // Determine file extension from content-type
    const contentType = audioResponse.headers.get('content-type') || 'audio/webm'
    const extMap: Record<string, string> = {
      'audio/webm': 'webm',
      'audio/mp4': 'm4a',
      'audio/x-m4a': 'm4a',
      'audio/m4a': 'm4a',
      'audio/mpeg': 'mp3',
      'audio/wav': 'wav',
      'audio/ogg': 'ogg',
      'audio/aac': 'aac',
      'audio/x-aac': 'aac',
    }
    let ext = extMap[contentType] || 'webm'
    
    // Fallback: try to get extension from URL if content-type is generic
    if (ext === 'webm' && audioUrl.includes('.')) {
      const urlExt = audioUrl.split('.').pop()?.split('?')[0]?.toLowerCase()
      if (urlExt && ['m4a', 'mp3', 'wav', 'ogg', 'aac'].includes(urlExt)) {
        ext = urlExt
      }
    }

    // Create FormData for OpenAI API
    const formData = new FormData()
    formData.append('file', audioBlob, `audio.${ext}`)
    formData.append('model', 'whisper-1')
    formData.append('response_format', 'text')

    // Call OpenAI Whisper API
    const whisperResponse = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: formData,
    })

    if (!whisperResponse.ok) {
      const errorData = await whisperResponse.text()
      console.error('OpenAI Whisper API error:', errorData)
      throw new Error(`Whisper API error: ${whisperResponse.status}`)
    }

    const transcription = await whisperResponse.text()

    return res.status(200).json({ transcription: transcription.trim() })
  } catch (error) {
    console.error('Transcription error:', error)
    return res.status(500).json({ error: 'Failed to transcribe audio' })
  }
}
