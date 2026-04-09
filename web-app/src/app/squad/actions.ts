'use server'

import { revalidatePath } from 'next/cache'
import { createClient } from '@/utils/supabase/server'

export type SquadStatus = {
  locked: boolean
  deadline: string | null
  gameweek: number
}

/**
 * Determines the current gameweek and its deadline.
 */
export async function getGameweekStatus(): Promise<SquadStatus> {
  const supabase = createClient()
  
  // Find the first upcoming gameweek match
  const { data: fixtures, error } = await supabase
    .from('fixtures')
    .select('gameweek, match_date')
    .eq('status', 'Upcoming')
    .order('match_date', { ascending: true })
    .limit(1)

  if (error || !fixtures || fixtures.length === 0) {
    // If no upcoming fixtures exist, assume we are in pre-season or seeding phase and allow drafting.
    return { locked: false, deadline: null, gameweek: 1 }
  }

  const nextMatch = fixtures[0]
  const deadline = new Date(nextMatch.match_date)
  const isLocked = new Date() > deadline

  return {
    locked: isLocked,
    deadline: nextMatch.match_date,
    gameweek: nextMatch.gameweek
  }
}

/**
 * Saves a brand new 15-player squad draft.
 * Automatically assigns a 4-4-2 starting XI.
 */
export async function saveInitialSquad(playerIds: string[]) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { gameweek, locked } = await getGameweekStatus()
  if (locked) throw new Error('Gameweek is already locked.')

  // Fetch full player data to assign positions
  const { data: players } = await supabase
    .from('players')
    .select('id, position, price')
    .in('id', playerIds)

  if (!players || players.length !== 15) throw new Error('Invalid squad size')

  // Transactionally upsert user_squads
  const { data: squad, error: squadErr } = await supabase
    .from('user_squads')
    .upsert({
      user_id: user.id,
      gameweek: gameweek,
      formation: '4-4-2',
      team_name: `${user.email?.split('@')[0]}'s Squad`,
      budget_remaining: 100.0 - (players.reduce((acc, p) => acc + p.price, 0)),
    }, { onConflict: 'user_id, gameweek' })
    .select()
    .single()

  if (squadErr) throw new Error(squadErr.message)

  // Auto-assign 4-4-2 Starters
  // Needs: 1 GK, 4 DEF, 4 MID, 2 FWD
  const starters: string[] = []
  const bench: string[] = []

  const gks = players.filter(p => p.position === 'GK')
  const defs = players.filter(p => p.position === 'DEF')
  const mids = players.filter(p => p.position === 'MID')
  const fwds = players.filter(p => p.position === 'FWD')

  // Pick Starters
  starters.push(gks[0].id)
  starters.push(...defs.slice(0, 4).map(p => p.id))
  starters.push(...mids.slice(0, 4).map(p => p.id))
  starters.push(...fwds.slice(0, 2).map(p => p.id))

  // Everyone else is bench
  const starterSet = new Set(starters)
  players.forEach(p => {
    if (!starterSet.has(p.id)) bench.push(p.id)
  })

  // Prepare squad_players rows
  const squadPlayers = players.map(p => {
    const isStarter = starterSet.has(p.id)
    return {
      squad_id: squad.id,
      player_id: p.id,
      is_starter: isStarter,
      bench_order: isStarter ? null : bench.indexOf(p.id) + 1,
      points_multiplier: starters[0] === p.id ? 2 : 1 // Auto-captain the GK for now
    }
  })

  // Clear existing and insert new
  await supabase.from('squad_players').delete().eq('squad_id', squad.id)
  const { error: insertErr } = await supabase.from('squad_players').insert(squadPlayers)
  
  if (insertErr) throw new Error(insertErr.message)

  revalidatePath('/squad')
  return { success: true }
}

/**
 * Updates the arrangement (XI vs Bench) and Captaincy.
 */
export async function updateSquadArrangement(
  squadId: string, 
  arrangement: { id: string; is_starter: boolean; bench_order: number | null; points_multiplier: number }[]
) {
  const supabase = createClient()
  
  const { locked } = await getGameweekStatus()
  if (locked) throw new Error('Deadline passed. Squad locked.')

  // Detect formation string
  const starters = arrangement.filter(a => a.is_starter)
  // To get positions, we might need a quick join or the caller knows them.
  // For simplicity, we'll assume the caller passes positions or we fetch here.
  const { data: players } = await supabase.from('players').select('id, position').in('id', starters.map(s => s.id))
  
  const dCount = players?.filter(p => p.position === 'DEF').length || 0
  const mCount = players?.filter(p => p.position === 'MID').length || 0
  const fCount = players?.filter(p => p.position === 'FWD').length || 0
  const formationStr = `${dCount}-${mCount}-${fCount}`

  // Update Formation in user_squads
  await supabase.from('user_squads').update({ formation: formationStr }).eq('id', squadId)

  // Bulk update squad_players
  // Note: Supabase/PostgREST doesn't support bulk update easily without a custom RPC or loop.
  // For 15 players, a loop of individual updates is acceptable or a large upsert.
  for (const item of arrangement) {
    await supabase
      .from('squad_players')
      .update({
        is_starter: item.is_starter,
        bench_order: item.bench_order,
        points_multiplier: item.points_multiplier
      })
      .eq('squad_id', squadId)
      .eq('player_id', item.id)
  }

  revalidatePath('/squad')
  return { success: true }
}

/**
 * Fetches the current user's squad for the current gameweek.
 */
export async function fetchUserSquad() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { gameweek } = await getGameweekStatus()

  const { data: squad } = await supabase
    .from('user_squads')
    .select(`
      *,
      squad_players (
        *,
        player:players (
          *,
          team:teams (short_name)
        )
      )
    `)
    .eq('user_id', user.id)
    .eq('gameweek', gameweek)
    .single()

  return squad
}
