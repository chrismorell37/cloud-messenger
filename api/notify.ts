import type { VercelRequest, VercelResponse } from '@vercel/node'

const RESEND_API_KEY = process.env.RESEND_API_KEY
const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY
const NOTIFICATION_EMAIL = 'ctmorell@gmail.com'
const RATE_LIMIT_MINUTES = 20

// ESPN RSS feeds for different sports
const RSS_FEEDS = [
  'https://www.espn.com/espn/rss/news',
  'https://www.espn.com/espn/rss/nba/news',
  'https://www.espn.com/espn/rss/mlb/news',
  'https://www.espn.com/espn/rss/nfl/news',
]

// Fallback sports facts if RSS fails
const FALLBACK_FACTS = [
  "LeBron James has played more playoff minutes than any player in NBA history.",
  "The New York Yankees have won 27 World Series titles, the most in MLB history.",
  "Stephen Curry revolutionized basketball with his three-point shooting.",
  "Patrick Mahomes became the youngest QB to win Super Bowl MVP.",
  "Shohei Ohtani is the first player to be a two-way All-Star since Babe Ruth.",
]

interface Article {
  title: string
  link: string
  description: string
}

async function fetchSportsNews(): Promise<Article | null> {
  // Try each RSS feed until we get articles
  for (const feedUrl of RSS_FEEDS) {
    try {
      const response = await fetch(feedUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0' }
      })
      
      if (!response.ok) continue
      
      const xml = await response.text()
      
      // Parse RSS items using regex (simple approach for serverless)
      const items: Article[] = []
      const itemRegex = /<item>([\s\S]*?)<\/item>/g
      let match
      
      while ((match = itemRegex.exec(xml)) !== null) {
        const itemXml = match[1]
        
        const titleMatch = /<title><!\[CDATA\[(.*?)\]\]><\/title>|<title>(.*?)<\/title>/s.exec(itemXml)
        const linkMatch = /<link>(.*?)<\/link>/s.exec(itemXml)
        const descMatch = /<description><!\[CDATA\[(.*?)\]\]><\/description>|<description>(.*?)<\/description>/s.exec(itemXml)
        
        const title = titleMatch?.[1] || titleMatch?.[2] || ''
        const link = linkMatch?.[1] || ''
        const description = descMatch?.[1] || descMatch?.[2] || ''
        
        if (title && link) {
          items.push({ 
            title: title.trim(), 
            link: link.trim(), 
            description: description.replace(/<[^>]*>/g, '').trim().slice(0, 300)
          })
        }
      }
      
      if (items.length > 0) {
        // Pick a random article from top 10
        const topItems = items.slice(0, 10)
        return topItems[Math.floor(Math.random() * topItems.length)]
      }
    } catch (err) {
      console.error(`Failed to fetch ${feedUrl}:`, err)
      continue
    }
  }
  
  return null
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  if (!RESEND_API_KEY || !SUPABASE_URL || !SUPABASE_KEY) {
    console.error('Missing environment variables')
    return res.status(500).json({ error: 'Server configuration error' })
  }

  try {
    // Check rate limiting - get last sent time from Supabase
    const checkResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/notification_state?id=eq.default&select=last_sent_at`,
      {
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
        },
      }
    )

    if (!checkResponse.ok) {
      throw new Error('Failed to check notification state')
    }

    const stateData = await checkResponse.json()
    const lastSentAt = stateData[0]?.last_sent_at ? new Date(stateData[0].last_sent_at) : null

    // Check if we're within the rate limit window
    if (lastSentAt) {
      const minutesSinceLastEmail = (Date.now() - lastSentAt.getTime()) / (1000 * 60)
      if (minutesSinceLastEmail < RATE_LIMIT_MINUTES) {
        return res.status(200).json({ 
          sent: false, 
          reason: 'Rate limited',
          minutesRemaining: Math.ceil(RATE_LIMIT_MINUTES - minutesSinceLastEmail)
        })
      }
    }

    // Fetch a sports news article
    const article = await fetchSportsNews()
    
    let htmlContent: string
    let textContent: string
    
    // Use consistent subject line for email threading
    const subject = 'Your ongoing sports news rollup'
    
    if (article) {
      // Send article as email
      htmlContent = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #1a1a1a; margin-bottom: 15px;">${article.title}</h2>
          ${article.description ? `<p style="font-size: 16px; line-height: 1.6; color: #333; margin-bottom: 20px;">${article.description}...</p>` : ''}
          <a href="${article.link}" target="_blank" rel="noopener noreferrer" style="display: inline-block; background: #0066cc; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 500;">Read Full Story</a>
          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;" />
          <p style="font-size: 12px; color: #999;">Sports news from ESPN</p>
          <p style="font-size: 11px; color: #bbb; margin-top: 10px;">Unsubscribe</p>
        </div>
      `
      textContent = `${article.title}\n\n${article.description || ''}\n\nRead more: ${article.link}\n\n---\nUnsubscribe`
    } else {
      // Fallback to a sports fact
      const randomFact = FALLBACK_FACTS[Math.floor(Math.random() * FALLBACK_FACTS.length)]
      htmlContent = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #1a1a1a; margin-bottom: 20px;">Did you know?</h2>
          <p style="font-size: 18px; line-height: 1.6; color: #333;">${randomFact}</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;" />
          <p style="font-size: 12px; color: #999;">Sports fact of the day</p>
          <p style="font-size: 11px; color: #bbb; margin-top: 10px;">Unsubscribe</p>
        </div>
      `
      textContent = `Did you know?\n\n${randomFact}\n\n---\nUnsubscribe`
    }

    // Send email via Resend
    const emailResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Sports News <onboarding@resend.dev>',
        to: [NOTIFICATION_EMAIL],
        subject,
        html: htmlContent,
        text: textContent,
      }),
    })

    if (!emailResponse.ok) {
      const errorData = await emailResponse.json()
      console.error('Resend API error:', errorData)
      throw new Error('Failed to send email')
    }

    // Update last sent time in Supabase
    const updateResponse = await fetch(
      `${SUPABASE_URL}/rest/v1/notification_state?id=eq.default`,
      {
        method: 'PATCH',
        headers: {
          'apikey': SUPABASE_KEY,
          'Authorization': `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal',
        },
        body: JSON.stringify({
          last_sent_at: new Date().toISOString(),
        }),
      }
    )

    if (!updateResponse.ok) {
      console.error('Failed to update notification state')
    }

    return res.status(200).json({ 
      sent: true, 
      article: article ? { title: article.title, link: article.link } : null 
    })
  } catch (error) {
    console.error('Notification error:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
