import { createClient } from '@/utils/supabase/server'
import { getGameweekStatus, fetchUserSquad } from '@/app/squad/actions'
import { LivePointsClient } from './LivePointsClient'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

// Shared select for fixture + team joins (includes logo_url for scoreboard)
const FIXTURE_SELECT = `
  *,
  home:teams!home_team_id (id, name, short_name, logo_url),
  away:teams!away_team_id (id, name, short_name, logo_url)
`

export default async function LivePointsPage() {
  const supabase = createClient()

  // 1. Auth check
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    // We could redirect to /login here, but the client component handles 
    // the "AuthPrompt" UI which feels nicer for a dashboard.
    // However, for data fetching, we better know if we have a user.
  }

  // 2. Fetch Gameweek & Squad (Server-side actions)
  const gwStatus = await getGameweekStatus()
  const squad = user ? await fetchUserSquad() : null

  // 3. Fetch All LIVE Matches from Fixtures
  // We join with teams to get names, short names, and logo_url for the scoreboard.
  const { data: liveMatches } = await supabase
    .from('fixtures')
    .select(FIXTURE_SELECT)
    .eq('status', 'Live')
    .order('match_date', { ascending: true })

  // 3b. Fallback: if no Live fixtures, also look for Upcoming fixtures
  // whose match_date is within the last 3 hours. This handles testing with
  // historical/debug matches where the fixture status hasn't been updated.
  let matches = (liveMatches as any[]) || []
  if (matches.length === 0) {
    const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString()
    const { data: recentUpcoming } = await supabase
      .from('fixtures')
      .select(FIXTURE_SELECT)
      .eq('status', 'Upcoming')
      .gte('match_date', threeHoursAgo)
      .order('match_date', { ascending: true })

    matches = (recentUpcoming as any[]) || []
  }

  // 4. Fetch All Events from the last 24 hours
  // Uses a 24h lookback instead of midnight UTC to avoid timezone mismatch
  // (server may be UTC but Morocco is UTC+1, which would exclude the first hour).
  const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  
  const { data: events } = await supabase
    .from('player_live_points')
    .select('*')
    .gte('created_at', last24h)
    .order('created_at', { ascending: false })

  return (
    <LivePointsClient 
      initialUser={user}
      initialSquad={squad}
      initialGameweekStatus={gwStatus}
      initialLiveMatches={matches}
      initialEvents={(events as any[]) || []}
    />
  )
}
