'use client'

import { useState, useEffect, useMemo } from 'react'
import { supabase } from '@/lib/supabase'
import { 
  Trophy, Zap, Shield, User, Timer, AlertCircle, 
  ChevronRight, ArrowRightLeft, Loader2, Play
} from 'lucide-react'
import Link from 'next/link'
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// --- Types ---

interface Team {
  id: string
  name: string
  short_name: string
  logo_url?: string | null
}

interface Fixture {
  id: string
  home_team_id: string
  away_team_id: string
  match_date: string
  status: 'Upcoming' | 'Live' | 'Finished'
  gameweek: number
  home?: Team
  away?: Team
}

interface LiveEvent {
  id: string
  player_id: string
  player_name: string
  team_name: string
  event_type: string
  points: number
  minute: string
  match_home_team: string
  match_away_team: string
  match_side: 'home' | 'away' | null
  created_at: string
}

interface SquadPlayer {
  player_id: string
  is_starter: boolean
  points_multiplier: number
  player: {
    name: string
    position: string
    team: {
      short_name: string
      logo_url?: string | null
    }
  }
}

interface LivePointsClientProps {
  initialUser: any
  initialSquad: any
  initialGameweekStatus: any
  initialLiveMatches: Fixture[]
  initialEvents: LiveEvent[]
}

// --- Helpers ---

/**
 * Normalize a team name for fuzzy comparison.
 * Strips common suffixes and lowercases for reliable matching
 * between Flashscore names ("Wydad Athletic") and DB names ("Wydad AC").
 */
function normalizeTeamName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/\b(ac|athletic|sc|fc|club|cf)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
}

function teamsMatch(a: string, b: string): boolean {
  const na = normalizeTeamName(a)
  const nb = normalizeTeamName(b)
  return na === nb || na.includes(nb) || nb.includes(na)
}

// --- Icons Helper ---
const EventIcon = ({ type }: { type: string }) => {
  switch (type) {
    case 'goal': return <div className="w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center shadow-lg shadow-emerald-500/20"><Zap size={10} className="text-white fill-white" /></div>
    case 'yellow_card': return <div className="w-5 h-5 bg-yellow-400 rounded-sm shadow-lg shadow-yellow-500/20" />
    case 'red_card': return <div className="w-5 h-5 bg-red-500 rounded-sm shadow-lg shadow-red-500/20" />
    case 'substitution': return <ArrowRightLeft size={16} className="text-blue-400" />
    default: return <Timer size={16} className="text-gray-500" />
  }
}

export function LivePointsClient({ 
  initialUser, 
  initialSquad, 
  initialGameweekStatus,
  initialLiveMatches,
  initialEvents
}: LivePointsClientProps) {
  const [events, setEvents] = useState<LiveEvent[]>(initialEvents)
  const [highlightedPlayers, setHighlightedPlayers] = useState<Set<string>>(new Set())

  // Stable set of squad player IDs — avoids stale closure in realtime callback
  const squadPlayerIds = useMemo(() => {
    return new Set<string>(
      initialSquad?.squad_players?.map((sp: any) => sp.player_id).filter(Boolean) || []
    )
  }, [initialSquad])

  // Stable set of squad player names — for fallback matching when player_id is null
  const squadPlayerNames = useMemo(() => {
    return new Set<string>(
      initialSquad?.squad_players?.map((sp: any) => sp.player?.name?.toLowerCase()).filter(Boolean) || []
    )
  }, [initialSquad])

  // --- Realtime Subscription ---
  useEffect(() => {
    const channel = supabase
      .channel('live-match-center')
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'player_live_points' 
      }, (payload) => {
        const newEvent = payload.new as LiveEvent
        setEvents(prev => [newEvent, ...prev])

        // Trigger glow for user's squad — use stable sets instead of initialSquad closure
        const isUserPlayer = 
          (newEvent.player_id && squadPlayerIds.has(newEvent.player_id)) ||
          (newEvent.player_name && squadPlayerNames.has(newEvent.player_name.toLowerCase()))

        if (isUserPlayer) {
          const highlightKey = newEvent.player_id || newEvent.player_name
          setHighlightedPlayers(prev => new Set(prev).add(highlightKey))
          setTimeout(() => {
            setHighlightedPlayers(prev => {
              const next = new Set(prev)
              next.delete(highlightKey)
              return next
            })
          }, 3000)
        }
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [squadPlayerIds, squadPlayerNames])

  // --- Derived State: Active Match logic ---
  const activeMatch = useMemo(() => {
    if (initialLiveMatches.length === 0) return null
    
    const matchesWithCounts = initialLiveMatches.map(m => {
      // Count squad players whose team matches this fixture's home or away.
      // .trim() both sides to handle trailing spaces in seed data (e.g. "IR ").
      const homeTeam = (m.home?.short_name || '').trim()
      const awayTeam = (m.away?.short_name || '').trim()
      
      const count = initialSquad?.squad_players?.filter((sp: any) => {
        const spTeam = (sp.player?.team?.short_name || '').trim()
        return spTeam === homeTeam || spTeam === awayTeam
      }).length || 0

      return { ...m, playerCount: count }
    })

    // Sort by player count descending, then by match_date ascending
    matchesWithCounts.sort((a, b) => {
      if (b.playerCount !== a.playerCount) return b.playerCount - a.playerCount
      return new Date(a.match_date).getTime() - new Date(b.match_date).getTime()
    })

    return matchesWithCounts[0]
  }, [initialLiveMatches, initialSquad])

  // --- Derived State: Score Calculation ---
  const liveScores = useMemo(() => {
    const scores: Record<string, { home: number; away: number }> = {}
    
    initialLiveMatches.forEach(m => {
      const homeName = m.home?.name || ''
      const awayName = m.away?.name || ''
      const homeShort = (m.home?.short_name || '').trim()
      const awayShort = (m.away?.short_name || '').trim()

      // Match events to this fixture using normalized team name comparison
      const matchEvents = events.filter(e => {
        const eHome = e.match_home_team || ''
        const eAway = e.match_away_team || ''
        return (
          (teamsMatch(eHome, homeName) && teamsMatch(eAway, awayName)) ||
          (teamsMatch(eHome, homeShort) && teamsMatch(eAway, awayShort))
        )
      })

      let homeScore = 0
      let awayScore = 0

      matchEvents.forEach(e => {
        // Prefer match_side from DB (set by scraper), fall back to fuzzy team comparison
        let isHomeSide: boolean
        let isAwaySide: boolean
        if (e.match_side) {
          isHomeSide = e.match_side === 'home'
          isAwaySide = e.match_side === 'away'
        } else {
          const eventTeam = e.team_name || ''
          isHomeSide = teamsMatch(eventTeam, homeName) || teamsMatch(eventTeam, homeShort)
          isAwaySide = teamsMatch(eventTeam, awayName) || teamsMatch(eventTeam, awayShort)
        }

        if (e.event_type === 'goal') {
          if (isHomeSide) homeScore++
          else if (isAwaySide) awayScore++
        } else if (e.event_type === 'own_goal') {
          // OG by home player = away goal, and vice versa
          if (isHomeSide) awayScore++
          else if (isAwaySide) homeScore++
        }
      })

      scores[m.id] = { home: homeScore, away: awayScore }
    })

    return scores
  }, [events, initialLiveMatches])

  // --- Derived State: Player Points ---
  const playerPoints = useMemo(() => {
    const pts: Record<string, number> = {}
    initialSquad?.squad_players?.forEach((sp: any) => {
      const spName = (sp.player?.name || '').toLowerCase()
      const playerEvents = events.filter(e => {
        // Primary: match by player_id when available
        if (e.player_id && e.player_id === sp.player_id) return true
        // Fallback: match by player_name (handles null player_id from failed fuzzy match)
        if (e.player_name && spName) {
          const eName = e.player_name.toLowerCase()
          return eName.includes(spName) || spName.includes(eName)
        }
        return false
      })
      const total = playerEvents.reduce((sum, e) => sum + (e.points * sp.points_multiplier), 0)
      pts[sp.player_id] = total
    })
    return pts
  }, [events, initialSquad])

  const totalPoints = useMemo(() => {
    return Object.values(playerPoints).reduce((sum, p) => sum + p, 0)
  }, [playerPoints])

  if (!initialUser) return <AuthPrompt />
  if (!initialSquad) return <NoSquadPrompt />

  return (
    <div className="min-h-screen bg-[#070B14] text-white pb-20 overflow-x-hidden">
      
      {/* 1. TOP SECTION: Match Scoreboard */}
      <section className="px-4 pt-6 pb-4">
        {activeMatch ? (
          <div className="bg-gradient-to-br from-[#121A2B] to-[#0A0F1A] rounded-[32px] border border-white/5 p-6 shadow-2xl relative overflow-hidden group">
            {/* Background pattern */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-neon/5 blur-[80px] rounded-full -mr-16 -mt-16" />
            
            <div className="flex flex-col items-center gap-6">
              {/* Header: Live Badge & Match Count */}
              <div className="flex justify-between items-center w-full">
                <div className="bg-red-500/10 border border-red-500/30 rounded-full px-3 py-1 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
                  <span className="text-red-500 text-[10px] font-black uppercase tracking-widest">Live</span>
                </div>
                
                {initialLiveMatches.length > 1 && (
                  <div className="flex items-center gap-2 text-gray-500 text-[10px] font-black uppercase tracking-widest bg-white/5 px-3 py-1 rounded-full">
                    Match 1 of {initialLiveMatches.length}
                    <ChevronRight size={12} className="text-gray-700" />
                  </div>
                )}
              </div>

              {/* Central Score Area */}
              <div className="flex items-center justify-between w-full gap-4">
                <div className="flex-1 flex flex-col items-center gap-3">
                  <div className="w-20 h-20 bg-white/5 rounded-3xl border border-white/10 flex items-center justify-center shadow-inner overflow-hidden relative p-2">
                    {activeMatch.home?.logo_url ? (
                      <img src={activeMatch.home.logo_url} alt={activeMatch.home.name} className="w-full h-full object-contain" />
                    ) : (
                      <Shield size={32} className="text-white/20" />
                    )}
                  </div>
                  <span className="text-xs font-black uppercase tracking-tight text-center leading-tight h-8 flex items-center">{activeMatch.home?.name}</span>
                </div>

                <div className="flex flex-col items-center gap-1">
                  <div className="flex items-center gap-4">
                    <span className="text-5xl font-black tracking-tighter tabular-nums">{liveScores[activeMatch.id]?.home || 0}</span>
                    <span className="text-white/20 text-3xl font-black">:</span>
                    <span className="text-5xl font-black tracking-tighter tabular-nums">{liveScores[activeMatch.id]?.away || 0}</span>
                  </div>
                  <div className="bg-white/5 px-2 py-0.5 rounded text-[10px] font-bold text-neon tracking-widest">64&apos;</div>
                </div>

                <div className="flex-1 flex flex-col items-center gap-3">
                  <div className="w-20 h-20 bg-white/5 rounded-3xl border border-white/10 flex items-center justify-center shadow-inner overflow-hidden relative p-2">
                    {activeMatch.away?.logo_url ? (
                      <img src={activeMatch.away.logo_url} alt={activeMatch.away.name} className="w-full h-full object-contain" />
                    ) : (
                      <Shield size={32} className="text-white/20" />
                    )}
                  </div>
                  <span className="text-xs font-black uppercase tracking-tight text-center leading-tight h-8 flex items-center">{activeMatch.away?.name}</span>
                </div>
              </div>

              {/* User Impact Summary */}
              <div className="w-full bg-white/5 rounded-2xl p-3 flex items-center justify-between border border-white/5">
                <div className="flex items-center gap-2">
                  <div className="bg-neon/10 p-1.5 rounded-lg">
                    <Zap size={14} className="text-neon" />
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Your Players Active</span>
                </div>
                <span className="text-sm font-black text-white">{activeMatch.playerCount} Roster Members</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-[#121A2B] rounded-[32px] p-8 border border-white/5 flex flex-col items-center text-center gap-4">
            <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center">
              <Timer size={32} className="text-gray-700" />
            </div>
            <div className="flex flex-col">
              <h3 className="text-lg font-black uppercase tracking-tight">No Live Matches</h3>
              <p className="text-gray-500 text-xs">Waiting for today&apos;s Botola kick-off.</p>
            </div>
          </div>
        )}
      </section>

      {/* 2. MIDDLE SECTION: Match Events Timeline */}
      <section className="mb-6">
        <div className="px-5 mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-1 h-3 bg-neon rounded-full" />
            <span className="text-white font-black text-[11px] uppercase tracking-widest uppercase">Match Timeline</span>
          </div>
          <span className="text-gray-600 text-[10px] font-black px-2 py-0.5 border border-white/5 rounded-lg">LIVE FEED</span>
        </div>

        <div className="flex gap-3 overflow-x-auto px-5 pb-4 no-scrollbar">
          {events.length > 0 ? (
            events.slice(0, 10).map((event) => (
              <div key={event.id} className="shrink-0 w-40 bg-[#121A2B] rounded-2xl border border-white/5 p-3 flex flex-col gap-2 relative shadow-lg">
                <div className="flex items-center justify-between">
                  <EventIcon type={event.event_type} />
                  <span className="text-[10px] font-black text-neon">{event.minute}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[11px] font-bold text-white truncate">{event.player_name || 'Unknown Player'}</span>
                  <div className="flex items-center gap-1">
                    <span className="text-[9px] font-black text-gray-500 uppercase tracking-tight">{event.event_type.replace('_', ' ')}</span>
                    {event.team_name && (
                      <span className="text-[8px] font-bold text-gray-600">· {event.team_name}</span>
                    )}
                  </div>
                </div>
                {event.points > 0 && (
                  <div className="absolute top-2 right-2 flex items-center gap-0.5">
                    <span className="text-[9px] font-black text-emerald-400">+{event.points}</span>
                  </div>
                )}
              </div>
            ))
          ) : (
            <div className="w-full py-8 flex flex-col items-center justify-center text-gray-700 gap-2 border-2 border-dashed border-white/5 rounded-[32px]">
               <Loader2 size={24} className="animate-spin opacity-20" />
               <span className="text-[10px] font-black uppercase tracking-widest">Waiting for events...</span>
            </div>
          )}
        </div>
      </section>

      {/* 3. BOTTOM SECTION: Compact Squad Leaderboard */}
      <section className="px-4">
        <div className="bg-[#121A2B] rounded-[32px] border border-white/5 overflow-hidden shadow-2xl">
          {/* Dashboard Header */}
          <div className="p-5 border-b border-white/5 flex items-center justify-between bg-white/[0.02]">
             <div className="flex flex-col">
               <span className="text-gray-500 text-[9px] font-black uppercase tracking-widest leading-none mb-1">Squad Points</span>
               <span className="text-3xl font-black tracking-tighter text-neon tabular-nums">{totalPoints}</span>
             </div>
             <Trophy size={24} className="text-gray-700" />
          </div>

          {/* Grouped Players */}
          <div className="divide-y divide-white/5">
            {['GK', 'DEF', 'MID', 'FWD'].map(pos => {
              const posPlayers = initialSquad.squad_players?.filter((sp: any) => sp.player.position === pos) || []
              if (posPlayers.length === 0) return null

              return (
                <div key={pos} className="flex flex-col">
                  <div className="px-5 py-2 bg-white/[0.01] flex items-center justify-between">
                     <span className="text-[9px] font-black text-white/30 tracking-[0.2em]">{pos}</span>
                     <span className="text-[9px] font-black text-white/10">{posPlayers.length} Active</span>
                  </div>
                  {posPlayers.map((sp: SquadPlayer) => {
                    const points = playerPoints[sp.player_id] || 0
                    const isHighlighted = highlightedPlayers.has(sp.player_id) || highlightedPlayers.has(sp.player?.name)
                    const isCaptain = sp.points_multiplier > 1

                    return (
                      <div 
                        key={sp.player_id} 
                        className={cn(
                          "px-5 py-2.5 flex items-center justify-between transition-all duration-500",
                          isHighlighted && "animate-point-glow"
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <div className="relative">
                            <div className="w-8 h-8 rounded-full bg-[#1A2235] border border-white/10 flex items-center justify-center overflow-hidden">
                               <User size={14} className="text-gray-600" />
                            </div>
                            {isCaptain && (
                              <div className="absolute -top-1 -right-1 w-4 h-4 bg-yellow-500 rounded-full flex items-center justify-center text-[7px] font-black text-black border border-[#070B14]">C</div>
                            )}
                          </div>
                          <div className="flex flex-col min-w-0">
                            <span className="text-xs font-black text-white uppercase tracking-tight truncate">{sp.player.name}</span>
                            <div className="flex items-center gap-1">
                               {sp.player.team.logo_url && (
                                 <img src={sp.player.team.logo_url} alt="" className="w-3 h-3 object-contain opacity-60" />
                               )}
                               <span className="text-[8px] font-bold text-gray-500 uppercase tracking-widest leading-none">{sp.player.team.short_name}</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-col items-end">
                          <span className={cn(
                            "text-lg font-black tabular-nums leading-none",
                            points > 0 ? "text-neon" : (points < 0 ? "text-red-500" : "text-white/40")
                          )}>
                            {points > 0 ? `+${points}` : points}
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* Footer Info */}
      <footer className="mt-8 px-10 text-center flex flex-col items-center gap-2 pb-12 opacity-40">
        <AlertCircle size={16} className="text-gray-600" />
        <p className="text-[9px] font-black uppercase text-gray-600 tracking-widest leading-relaxed">
          Real-time Feed powered by Botola Live Engine. Captains earn 2x points.
        </p>
      </footer>
    </div>
  )
}

function AuthPrompt() {
  return (
    <div className="min-h-screen bg-[#070B14] flex flex-col items-center justify-center p-10 text-center gap-8">
      <div className="w-24 h-24 bg-white/5 rounded-full flex items-center justify-center border border-white/5">
        <User size={48} className="text-white/20" />
      </div>
      <div className="flex flex-col gap-2">
        <h2 className="text-2xl font-black uppercase tracking-tighter">Arena Access Required</h2>
        <p className="text-gray-500 text-sm">Join the league to track live match points and climb the rankings.</p>
      </div>
      <Link href="/login" className="bg-neon text-black font-black px-10 py-4 rounded-2xl uppercase tracking-widest text-xs hover:scale-105 active:scale-95 transition-all shadow-xl shadow-neon/10">
        Sign In to Arena
      </Link>
    </div>
  )
}

function NoSquadPrompt() {
  return (
    <div className="min-h-screen bg-[#070B14] flex flex-col items-center justify-center p-10 text-center gap-8">
      <div className="w-24 h-24 bg-white/5 rounded-full flex items-center justify-center border border-white/5 animate-pulse">
        <Trophy size={48} className="text-white/20" />
      </div>
      <div className="flex flex-col gap-2">
        <h2 className="text-2xl font-black uppercase tracking-tighter">Squad Not Found</h2>
        <p className="text-gray-500 text-sm">You haven&apos;t drafted a squad for this gameweek yet.</p>
      </div>
      <Link href="/squad" className="bg-neon text-black font-black px-10 py-4 rounded-2xl uppercase tracking-widest text-xs hover:scale-105 active:scale-95 transition-all shadow-xl shadow-neon/10">
        Build Your Squad
      </Link>
    </div>
  )
}
