import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { term } = req.query

  if (!term || typeof term !== 'string') {
    return res.status(400).json({ error: 'Missing term parameter' })
  }

  try {
    const params = new URLSearchParams({
      term,
      media: 'music',
      entity: 'song',
      limit: '10',
    })

    const response = await fetch(
      `https://itunes.apple.com/search?${params.toString()}`
    )

    if (!response.ok) {
      return res.status(response.status).json({ error: 'iTunes API error' })
    }

    const data = await response.json()
    return res.status(200).json(data)
  } catch (error) {
    console.error('Error searching iTunes:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
