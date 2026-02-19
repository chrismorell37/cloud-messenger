import type { VercelRequest, VercelResponse } from '@vercel/node'

const RESEND_API_KEY = process.env.RESEND_API_KEY
const SUPABASE_URL = process.env.VITE_SUPABASE_URL
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY
const NOTIFICATION_EMAIL = 'ctmorell@gmail.com'
const RATE_LIMIT_MINUTES = 20

const SPORTS_FACTS = [
  "Michael Jordan was cut from his high school varsity basketball team as a sophomore.",
  "Babe Ruth started his MLB career as a pitcher for the Boston Red Sox before becoming a legendary hitter.",
  "The NBA three-point line is 23 feet 9 inches from the basket at the top of the arc.",
  "Wilt Chamberlain scored 100 points in a single NBA game on March 2, 1962.",
  "The longest MLB game lasted 8 hours and 6 minutes between the White Sox and Brewers in 1984.",
  "LeBron James has played more playoff minutes than any player in NBA history.",
  "Nolan Ryan holds the record for most career strikeouts with 5,714.",
  "The Boston Celtics have won 17 NBA championships, tied with the Lakers for the most.",
  "Jackie Robinson broke MLB's color barrier on April 15, 1947, playing for the Brooklyn Dodgers.",
  "Kareem Abdul-Jabbar's skyhook is considered the most unstoppable shot in NBA history.",
  "Cal Ripken Jr. played 2,632 consecutive games, known as 'The Iron Man' streak.",
  "The NBA shot clock is 24 seconds, introduced in 1954 to speed up the game.",
  "Hank Aaron hit 755 home runs, a record that stood for 33 years until Barry Bonds broke it.",
  "Bill Russell won 11 NBA championships in 13 seasons with the Celtics.",
  "The first World Series was played in 1903 between the Boston Americans and Pittsburgh Pirates.",
  "Shaquille O'Neal made only one three-pointer in his entire 19-year NBA career.",
  "Cy Young won 511 games, a record that will likely never be broken.",
  "The NBA basketball weighs between 20-22 ounces and has a circumference of 29.5 inches.",
  "Pete Rose has the most career hits in MLB history with 4,256.",
  "Magic Johnson announced his HIV diagnosis in 1991 and briefly returned to win the All-Star MVP.",
  "The MLB season has 162 games, while the NBA has 82 regular season games.",
  "Dennis Rodman won 7 consecutive rebounding titles from 1992-1998.",
  "Joe DiMaggio's 56-game hitting streak in 1941 is considered baseball's most unbreakable record.",
  "The tallest NBA player ever was Gheorghe Muresan at 7'7\".",
  "Ted Williams was the last player to hit .400, batting .406 in 1941.",
  "Stephen Curry revolutionized basketball with his three-point shooting, making 3,000+ career threes.",
  "The fastest pitch ever recorded in MLB was 105.8 mph by Aroldis Chapman.",
  "Kobe Bryant scored 81 points against the Raptors in 2006, the second-highest single-game total.",
  "The New York Yankees have won 27 World Series titles, the most in MLB history.",
  "Oscar Robertson averaged a triple-double for an entire season in 1961-62.",
  "The MLB strike zone is from the midpoint between shoulders and belt to just below the kneecap.",
  "Tim Duncan won 5 NBA championships while playing his entire 19-year career with the Spurs.",
  "Barry Bonds holds the single-season home run record with 73 in 2001.",
  "The NBA draft lottery was introduced in 1985 to discourage tanking.",
  "Greg Maddux won 4 consecutive Cy Young Awards from 1992-1995.",
  "The Miami Heat won 27 consecutive games in 2013, the second-longest streak in NBA history.",
  "Lou Gehrig's 'Luckiest Man' speech is one of the most famous moments in sports history.",
  "Hakeem Olajuwon is the only player to win MVP, Finals MVP, and Defensive Player of the Year in one season.",
  "The designated hitter rule was adopted by the American League in 1973.",
  "The 1995-96 Chicago Bulls went 72-10, a record broken by the 2015-16 Warriors (73-9).",
  "Mariano Rivera is the all-time saves leader with 652 career saves.",
  "Dirk Nowitzki played 21 seasons with the Dallas Mavericks, the longest tenure with one team.",
  "The MLB uses about 900,000 baseballs per season.",
  "John Stockton holds the NBA record for career assists (15,806) and steals (3,265).",
  "The 'Miracle Mets' won the 1969 World Series after being 100-1 underdogs.",
  "The NBA Finals MVP trophy is named after Bill Russell.",
  "Randy Johnson once hit a bird with a pitch during a spring training game in 2001.",
  "The Golden State Warriors blew a 3-1 lead in the 2016 NBA Finals.",
  "Rickey Henderson stole 1,406 bases in his career, far more than anyone else.",
  "Kevin Durant is the only player to score 30+ points in 4 different Finals series."
]

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

    // Pick a random sports fact
    const randomFact = SPORTS_FACTS[Math.floor(Math.random() * SPORTS_FACTS.length)]

    // Send email via Resend
    const emailResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'Sports Facts <onboarding@resend.dev>',
        to: [NOTIFICATION_EMAIL],
        subject: 'Your daily fun sports fact',
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #1a1a1a; margin-bottom: 20px;">Did you know?</h2>
            <p style="font-size: 18px; line-height: 1.6; color: #333;">${randomFact}</p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;" />
            <p style="font-size: 12px; color: #999;">You're receiving this because you subscribed to daily sports facts.</p>
          </div>
        `,
        text: `Did you know?\n\n${randomFact}\n\n---\nYou're receiving this because you subscribed to daily sports facts.`,
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

    return res.status(200).json({ sent: true, fact: randomFact })
  } catch (error) {
    console.error('Notification error:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
