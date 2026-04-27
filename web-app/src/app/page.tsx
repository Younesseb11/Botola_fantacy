import { createClient } from '@/utils/supabase/server';
import { ArrowRight, ArrowRightLeft, Medal, BarChart3, TrendingUp, ChevronRight } from 'lucide-react';
import Link from 'next/link';

// Helpers
function formatKickoff(isoString: string | null) {
  if (!isoString) return "TBD";
  try {
    const date = new Date(isoString);
    const day = date.toLocaleDateString('en-GB', { weekday: 'short' }).toUpperCase();
    const time = date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
    return `${day} ${time}`;
  } catch (e) {
    return "TBD";
  }
}

function getAbbr(name: string | null) {
  if (!name) return "???";
  const mapping: Record<string, string> = {
    "FAR Rabat": "FAR",
    "Wydad AC": "WAC",
    "Raja Casablanca": "RAJ",
    "Maghreb Fez": "MAS",
    "Olympique de Safi": "OCS",
    "Berkane": "BER",
    "Difaa El Jadidi": "DIF",
    "Hassania Agadir": "HUSA",
    "IR Tanger": "IRT",
    "FUS Rabat": "FUS",
    "Renaissance Zemamra": "RCAZ",
    "Yacoub El Mansour": "YAC",
    "Union Touarga": "UTS",
    "COD Meknes": "CODM",
    "Kawkab Marrakech": "KACM"
  };
  return mapping[name] || name.split(' ')[0].substring(0, 4).toUpperCase();
}

// Server component to fetch data
export default async function HomePage() {
  const supabase = createClient();
  
  // 1. Auth & User Squad Data
  const { data: { user } } = await supabase.auth.getUser();
  
  let squadData: any = null;
  let captainInfo: { name: string; points: number } | null = null;
  
  if (user) {
    const { data: squad } = await supabase
      .from('user_squads')
      .select(`
        *,
        squad_players (
          player_id,
          points_multiplier
        )
      `)
      .eq('user_id', user.id)
      .order('gameweek', { ascending: false })
      .limit(1)
      .single();
      
    if (squad) {
      squadData = squad;

      // 2. Real-time Point Calculation
      const playerIds = squad.squad_players?.map((p: any) => p.player_id) || [];
      if (playerIds.length > 0) {
        // Fetch all points for these players from today
        const today = new Date().toISOString().split('T')[0];
        const { data: livePoints } = await supabase
          .from('player_live_points')
          .select('player_id, points')
          .in('player_id', playerIds)
          .gte('created_at', today);

        if (livePoints) {
          // Map multipliers for easy access
          const multiplierMap: Record<string, number> = {};
          squad.squad_players.forEach((p: any) => {
            multiplierMap[p.player_id] = p.points_multiplier;
          });

          // Calculate total sum
          let calculatedTotal = 0;
          livePoints.forEach((lp: any) => {
            calculatedTotal += (lp.points * (multiplierMap[lp.player_id] || 1));
          });
          
          // Override the static totalPoints
          squadData.calculatedTotal = calculatedTotal;

          // Also get captain specific points for the UI pill
          if (squad.captain_player_id) {
            const { data: captainPlayer } = await supabase
              .from('players')
              .select('name')
              .eq('id', squad.captain_player_id)
              .single();
              
            const captainPoints = livePoints
              .filter((lp: any) => lp.player_id === squad.captain_player_id)
              .reduce((sum: number, lp: any) => sum + (lp.points * 2), 0);

            captainInfo = {
              name: captainPlayer?.name || "Captain",
              points: captainPoints
            };
          }
        }
      }
    }
  }

  // 3. Fetch next fixture (Global)
  let nextFixtureWithLogos = null;
  const { data: fixture } = await supabase
    .from('next_fixture')
    .select('*')
    .eq('id', 1)
    .single();
    
  if (fixture) {
    // Fetch logos for these teams
    const { data: teamLogos } = await supabase
      .from('teams')
      .select('name, logo_url')
      .in('name', [fixture.home_team, fixture.away_team]);

    const logoMap: Record<string, string | null> = {};
    teamLogos?.forEach(t => { logoMap[t.name] = t.logo_url; });

    nextFixtureWithLogos = {
      ...fixture,
      home_logo: logoMap[fixture.home_team],
      away_logo: logoMap[fixture.away_team]
    };
  }

  // Fallbacks
  const totalPoints = squadData?.calculatedTotal ?? squadData?.total_points ?? 0;
  const overallRank = squadData?.overall_rank ? squadData.overall_rank.toLocaleString() : "1,422";
  const teamName = squadData?.team_name || "Botola Masters League";
  const freeTransfers = squadData?.free_transfers ?? 2;
  
  const displayCaptainName = captainInfo?.name || "R. SLIM";
  const displayCaptainPoints = captainInfo?.points ?? 0;

  return (
    <div className="px-5 pb-8 animate-in fade-in duration-500 flex flex-col gap-5">
      
      {/* Matchday Pill */}
      <div className="flex justify-center mt-2">
        <div className="bg-[#1A2235] rounded-full pl-0 pr-4 py-1.5 flex items-center font-bold text-[10px] tracking-widest text-gray-300 shadow-md border border-white/5 relative overflow-hidden">
          <div className="w-1 h-full bg-neon absolute left-0 rounded-l-full"></div>
          <span className="pl-4 uppercase tracking-[0.3em]">Matchday {squadData?.gameweek || 28}</span>
        </div>
      </div>

      {/* Main Total Points Card */}
      <div className="relative bg-[#121A2B] rounded-[32px] p-6 flex flex-col items-center shadow-2xl border border-white/5 overflow-hidden group">
        <div className="absolute -right-10 -bottom-10 w-48 h-48 border-[20px] border-white/[0.02] rounded-full pointer-events-none group-hover:border-neon/[0.03] transition-colors"></div>
        <div className="absolute right-10 bottom-10 w-24 h-24 border-[10px] border-white/[0.02] rounded-full pointer-events-none"></div>
        
        <h3 className="text-neon text-[10px] font-black tracking-[0.2em] mb-2 z-10">TOTAL POINTS</h3>
        
        <div className="flex items-baseline gap-1 z-10 mb-4">
          <span className="text-white text-7xl font-bold tracking-tighter leading-none">{totalPoints}</span>
          <span className="text-neon text-sm font-black tracking-widest uppercase">Pts</span>
        </div>

        <div className="flex flex-col items-center gap-1.5 z-10 mb-6">
          <div className="flex items-center gap-2 text-white">
            <TrendingUp size={16} className="text-gray-400" />
            <span className="text-lg font-bold">Rank: {overallRank}</span>
          </div>
          <span className="text-gray-400 text-[10px] font-black uppercase tracking-widest">Global Standings</span>
        </div>

        <Link href="/squad" className="w-[85%] bg-neon text-[var(--background)] py-4 rounded-2xl font-black flex items-center justify-center gap-2 shadow-[0_4px_20px_0_rgba(74,222,128,0.3)] hover:scale-105 transition-all z-10 uppercase text-xs tracking-widest">
          Manage Squad
          <ArrowRight size={16} strokeWidth={3} />
        </Link>
      </div>

      {/* Action Cards Grid */}
      <div className="grid grid-cols-2 gap-4">
        {/* Transfers Card */}
        <Link href="/squad" className="bg-[#121A2B] rounded-3xl p-5 border border-white/5 flex flex-col items-start shadow-lg group hover:border-neon/20 transition-all">
          <div className="bg-[#1A2235] p-2.5 rounded-2xl mb-4 group-hover:bg-neon group-hover:text-black transition-all">
            <ArrowRightLeft className="text-neon group-hover:text-black" size={20} />
          </div>
          <h4 className="text-white font-bold text-sm mb-0.5">Transfers</h4>
          <span className="text-gray-400 text-[10px] pb-2 font-bold uppercase tracking-wider">{freeTransfers} Free available</span>
          <div className="w-full flex justify-end mt-auto pt-2">
             <ChevronRight className="text-gray-600 group-hover:text-neon transition-colors" size={16} />
          </div>
        </Link>

        {/* Captain Card */}
        <div className="bg-[#121A2B] rounded-3xl p-5 border border-white/5 flex flex-col items-start shadow-lg relative overflow-hidden group">
           <div className="absolute -right-4 -bottom-4 w-20 h-20 bg-neon/5 rounded-full blur-xl group-hover:bg-neon/10 transition-colors"></div>
           
          <div className="bg-[#1A2235] p-2.5 rounded-2xl mb-4">
            <Medal className="text-yellow-500" size={20} />
          </div>
          <h4 className="text-white font-bold text-sm mb-0.5 z-10">Captain</h4>
          <span className="text-gray-300 text-xs font-black z-10 uppercase tracking-tight">
            {displayCaptainName} <span className="text-neon/60 font-black">({displayCaptainPoints}pts)</span>
          </span>
        </div>
      </div>

      {/* League Card */}
      <Link href="/leagues" className="bg-[#121A2B] rounded-[24px] p-4 border border-white/5 flex items-center justify-between shadow-lg group hover:border-white/10 transition-colors">
        <div className="flex items-center gap-4">
          <div className="bg-[#1A2235] p-3 rounded-2xl">
            <BarChart3 className="text-neon" size={20} />
          </div>
          <div className="flex flex-col">
            <h4 className="text-white font-black text-[13px] uppercase tracking-tight">{teamName}</h4>
            <span className="text-gray-400 text-[10px] font-bold uppercase tracking-wider">Top Tier League</span>
          </div>
        </div>
        <div className="flex items-center gap-1 group-hover:translate-x-1 transition-transform">
           <span className="text-neon text-[9px] font-black tracking-widest uppercase">Leaderboard</span>
           <ChevronRight size={12} className="text-neon" />
        </div>
      </Link>

      {/* Next Match Section */}
      <div className="mt-2 flex flex-col gap-3">
        <div className="flex justify-between items-end px-2">
          <h3 className="text-white font-black text-lg uppercase tracking-tighter">Next Match</h3>
          <span className="text-neon text-[10px] font-black tracking-widest uppercase cursor-pointer">View Schedule</span>
        </div>

        <div className="bg-[#121A2B] rounded-[32px] py-7 px-4 border border-white/5 shadow-xl flex justify-around items-center relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-neon/5 to-transparent pointer-events-none opacity-50" />
          
          {/* Home Team */}
          <div className="flex flex-col items-center gap-3 w-20 z-10">
            <div className="w-16 h-16 bg-[#1A2235] rounded-full border border-white/10 flex items-center justify-center p-2 shadow-inner overflow-hidden">
               {nextFixtureWithLogos?.home_logo ? (
                 <img src={nextFixtureWithLogos.home_logo} alt="" className="w-full h-full object-contain" />
               ) : (
                 <div className="w-full h-full bg-gradient-to-tr from-gray-700 to-gray-500 rounded-full" />
               )}
            </div>
            <span className="text-white font-black text-[11px] uppercase tracking-widest text-center leading-tight h-8 flex items-center">
              {getAbbr(nextFixtureWithLogos?.home_team)}
            </span>
          </div>

          {/* VS info */}
          <div className="flex flex-col items-center gap-1 z-10">
            <div className="bg-white/5 px-3 py-1 rounded-full border border-white/10">
               <span className="text-white font-black text-xs">VS</span>
            </div>
            <span className="text-neon text-[9px] font-black tracking-widest uppercase mt-2">
              {formatKickoff(nextFixtureWithLogos?.kickoff_time)}
            </span>
          </div>

          {/* Away Team */}
          <div className="flex flex-col items-center gap-3 w-20 z-10">
            <div className="w-16 h-16 bg-[#1A2235] rounded-full border border-white/10 flex items-center justify-center p-2 shadow-inner overflow-hidden">
               {nextFixtureWithLogos?.away_logo ? (
                 <img src={nextFixtureWithLogos.away_logo} alt="" className="w-full h-full object-contain" />
               ) : (
                 <div className="w-full h-full bg-gradient-to-tr from-gray-700 to-gray-500 rounded-full" />
               )}
            </div>
            <span className="text-white font-black text-[11px] uppercase tracking-widest text-center leading-tight h-8 flex items-center">
              {getAbbr(nextFixtureWithLogos?.away_team)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
