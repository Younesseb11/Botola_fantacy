import { createClient } from '@/utils/supabase/server'
import { getGameweekStatus, fetchUserSquad } from '@/app/squad/actions'
import { LivePointsClient } from './LivePointsClient'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

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
  // We join with teams to get names and short names for the scoreboard.
  const { data: liveMatches } = await supabase
    .from('fixtures')
    .select(`
      *,
      home:teams!home_team_id (id, name, short_name),
      away:teams!away_team_id (id, name, short_name)
    `)
    .eq('status', 'Live')
    .order('match_date', { ascending: true })

  // 4. Fetch All Events for Today
  // This powers the global timeline and the score calculation.
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  
  const { data: events } = await supabase
    .from('player_live_points')
    .select('*')
    .gte('created_at', today.toISOString())
    .order('created_at', { ascending: false })

  return (
    <LivePointsClient 
      initialUser={user}
      initialSquad={squad}
      initialGameweekStatus={gwStatus}
      initialLiveMatches={(liveMatches as any[]) || []}
      initialEvents={(events as any[]) || []}
    />
  )
}
