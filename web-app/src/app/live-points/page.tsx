"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { User, Zap, Trophy, Shield, AlertCircle, RefreshCw, LogIn } from "lucide-react";
import { fetchUserSquad, getGameweekStatus } from "@/app/squad/actions";
import Link from "next/link";

// ─── Types ───────────────────────────────────────────────────────────────────

type EventType = "goal" | "assist" | "yellow_card" | "red_card" | "clean_sheet" | "save";

interface LiveEvent {
  id: string;
  player_id: string;
  event_type: EventType;
  points: number;
  minute?: string;
  created_at: string;
}

interface PlayerWithEvents {
  id: string;
  name: string;
  position: string;
  team_short: string;
  is_starter: boolean;
  multiplier: number;
  events: LiveEvent[];
}

// ─── Helper: Scoring ──────────────────────────────────────────────────────────

function getEventPoints(event: LiveEvent, multiplier: number): number {
  return (event.points || 0) * multiplier;
}

function calcPlayerTotal(player: PlayerWithEvents): number {
  // Sum of events applying stored database points and captain multiplier
  return player.events.reduce((sum, e) => {
    return sum + getEventPoints(e, player.multiplier);
  }, 0);
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function EventBadge({ event, multiplier }: { event: LiveEvent; multiplier: number }) {
  const pts = getEventPoints(event, multiplier);
  return (
    <span className="text-[9px] font-black tracking-wider px-1.5 py-0.5 rounded-md text-neon bg-neon/10 border border-neon/20">
      {event.event_type.toUpperCase().replace("_", " ")} {pts > 0 ? `+${pts}` : pts}
    </span>
  );
}

function PlayerRow({ player }: { player: PlayerWithEvents }) {
  const totalPts = calcPlayerTotal(player);
  const isCaptain = player.multiplier > 1;
  const hasEvents = player.events.length > 0;

  return (
    <div className={cn(
      "flex items-center gap-3 px-4 py-3.5 border-b border-white/[0.05] last:border-0 transition-all",
      hasEvents && "bg-neon/[0.02]"
    )}>
      <div className="relative shrink-0">
        <div className="w-11 h-11 rounded-full bg-[#1A2235] border-2 border-white/10 flex items-center justify-center overflow-hidden">
          <User size={20} className="text-gray-500" />
        </div>
        {isCaptain && (
          <div className="absolute -top-1 -right-1 w-5 h-5 bg-yellow-500 rounded-full flex items-center justify-center border-2 border-[#0C1220] shadow-lg">
            <span className="text-[9px] font-black text-black">C</span>
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
           <p className="text-white font-black text-sm uppercase tracking-tight truncate">{player.name}</p>
           {!player.is_starter && (
             <span className="text-[8px] font-bold bg-white/5 text-gray-500 px-1 rounded uppercase">Sub</span>
           )}
        </div>
        <p className="text-gray-500 text-[10px] font-bold uppercase tracking-widest mt-0.5">
          {player.position} • {player.team_short}
        </p>
        {hasEvents && (
          <div className="flex gap-1 mt-1.5 flex-wrap">
            {player.events.map((e) => <EventBadge key={e.id} event={e} multiplier={player.multiplier} />)}
          </div>
        )}
      </div>

      <div className="flex flex-col items-end">
        <span className={cn("text-2xl font-black tabular-nums leading-none", totalPts < 0 ? "text-red-400" : "text-white")}>
          {totalPts}
        </span>
        <span className="text-[9px] font-bold text-gray-600 uppercase tracking-widest">Points</span>
      </div>
    </div>
  );
}

function cn(...inputs: any[]) {
  return inputs.filter(Boolean).join(" ");
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function LivePointsPage() {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [players, setPlayers] = useState<PlayerWithEvents[]>([]);
  const [status, setStatus] = useState<any>(null);
  const [lastUpdated, setLastUpdated] = useState(new Date());

  const totalPts = useMemo(() => players.reduce((sum, p) => sum + calcPlayerTotal(p), 0), [players]);

  const initData = useCallback(async () => {
    try {
      setLoading(true);
      
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);

      if (!user) return;

      const squad = await fetchUserSquad();
      const gwStatus = await getGameweekStatus();
      setStatus(gwStatus);

      if (squad && squad.squad_players) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const initialPlayers = squad.squad_players.map((sp: any) => ({
          id: sp.player_id,
          name: sp.player.name,
          position: sp.player.position,
          team_short: sp.player.team?.short_name || sp.player.team_id,
          is_starter: sp.is_starter,
          multiplier: sp.points_multiplier,
          events: []
        }));
        
        // Fetch today's events from the real table
        const { data: events } = await supabase
          .from("player_live_points")
          .select("*")
          .in("player_id", initialPlayers.map((p: any) => p.id))
          .gte("created_at", today.toISOString());

        if (events) {
          initialPlayers.forEach((p: any) => {
            p.events = events.filter((e: any) => e.player_id === p.id);
          });
        }

        // Sort: Starters first
        initialPlayers.sort((a: any, b: any) => (a.is_starter === b.is_starter ? 0 : a.is_starter ? -1 : 1));

        setPlayers(initialPlayers);
      }
    } catch (err) {
      console.error("Live Points Error:", err);
    } finally {
      setLoading(false);
      setLastUpdated(new Date());
    }
  }, []);

  useEffect(() => {
    initData();

    // Listen only for relevant player events
    const channel = supabase
      .channel("live-points-v3")
      .on("postgres_changes", { 
        event: "INSERT", 
        schema: "public", 
        table: "player_live_points" 
      }, (payload) => {
        const newEvent = payload.new as LiveEvent;
        
        setPlayers((prev) => {
          // Check if this player is in our active list
          const isOurPlayer = prev.find(p => p.id === newEvent.player_id);
          if (!isOurPlayer) return prev;

          return prev.map((p) => {
            if (p.id === newEvent.player_id) {
               return { ...p, events: [...p.events, newEvent] };
            }
            return p;
          });
        });
        setLastUpdated(new Date());
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [initData]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#070B14] flex flex-col items-center justify-center gap-4 text-neon">
         <Zap className="animate-pulse" size={40} />
         <span className="text-[10px] font-black uppercase tracking-widest leading-none">Recalculating Scores</span>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center gap-6 px-10 text-center">
         <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center">
            <LogIn size={40} className="text-gray-600" />
         </div>
         <div className="flex flex-col gap-2">
            <h2 className="text-white font-black text-2xl uppercase tracking-tighter">Access Denied</h2>
            <p className="text-gray-500 text-sm">Please log in to track your squad performance in real-time.</p>
         </div>
         <Link href="/login" className="bg-neon text-black font-black px-8 py-3 rounded-2xl uppercase tracking-widest text-xs hover:scale-105 transition-all">
            Go to Login
         </Link>
      </div>
    );
  }

  if (players.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-20 text-center gap-6">
         <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center">
            <Trophy size={40} className="text-gray-700" />
         </div>
         <div className="flex flex-col gap-2">
            <h3 className="text-white font-bold text-xl uppercase tracking-tighter">Draft Missing</h3>
            <p className="text-gray-500 text-sm">Save your squad first to track live points.</p>
         </div>
         <Link href="/squad" className="text-neon text-[10px] font-black uppercase border border-neon/20 px-4 py-2 rounded-xl">Build Squad</Link>
      </div>
    );
  }

  return (
    <div className="pb-8 animate-in fade-in duration-500">
      
      {/* Active Points Hub */}
      <div className="px-5 mt-4 mb-6">
        <div className="bg-[#0F1926] rounded-[32px] border border-white/[0.06] p-6 shadow-2xl relative overflow-hidden group">
           <div className="absolute top-0 right-0 p-4 flex gap-2">
              <button 
                onClick={initData}
                className="bg-white/5 p-2 rounded-full hover:bg-neon hover:text-black transition-all"
                title="Refresh Scores"
              >
                 <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
              </button>
              <div className="bg-red-500/10 border border-red-500/30 rounded-full px-3 py-1 flex items-center gap-1.5 h-fit">
                 <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
                 <span className="text-red-500 text-[9px] font-black uppercase tracking-widest">Live</span>
              </div>
           </div>

           <div className="flex flex-col gap-1">
              <span className="text-gray-500 text-[10px] font-black uppercase tracking-widest">Your Points</span>
              <div className="flex items-baseline gap-2">
                 <span className="text-neon font-black text-6xl tracking-tighter tabular-nums">{totalPts}</span>
                 <span className="text-neon/60 text-sm font-black tracking-widest uppercase">Pts</span>
              </div>
           </div>

           <div className="mt-6 flex items-center justify-between border-t border-white/5 pt-4">
              <div className="flex flex-col">
                 <span className="text-gray-500 text-[8px] font-black uppercase">Gameweek {status?.gameweek}</span>
                 <span className="text-white text-xs font-bold uppercase tracking-tight">Active Squad Feed</span>
              </div>
              <div className="flex items-center gap-2 text-gray-500 text-[9px] font-bold uppercase">
                 <div className="w-2 h-2 rounded-full bg-neon animate-pulse" />
                 Sync: {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </div>
           </div>
        </div>
      </div>

      <div className="px-5 mb-3 flex justify-between items-center">
         <div className="flex items-center gap-2">
            <div className="w-1 h-3 bg-neon rounded-full" />
            <span className="text-white font-black text-[11px] uppercase tracking-widest">Roster Updates</span>
         </div>
         <Shield size={14} className="text-gray-600" />
      </div>

      <div className="bg-[#0C1220] mx-2 rounded-[32px] border border-white/[0.05] shadow-2xl overflow-hidden divide-y divide-white/5 mb-8">
        {players.map((player) => (
          <PlayerRow key={player.id} player={player} />
        ))}
      </div>

      {/* Info Footer */}
      <div className="flex flex-col items-center gap-2 text-center px-10">
         <p className="text-gray-600 text-[10px] font-bold uppercase leading-relaxed max-w-xs">
            Scores are calculated live. Goals: GK (10), DEF (6), MID (5), FWD (4). Captains earn double.
         </p>
      </div>

    </div>
  );
}
