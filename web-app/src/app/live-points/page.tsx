"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { User, Zap, Trophy, Shield, AlertCircle } from "lucide-react";
import { fetchUserSquad, getGameweekStatus } from "@/app/squad/actions";

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

// ─── Point values for each event (consistent with live.py) ────────────────────
const EVENT_POINTS: Record<EventType, number> = {
  goal: 5,
  assist: 3,
  yellow_card: -1,
  red_card: -3,
  clean_sheet: 4,
  save: 1,
};

const EVENT_LABELS: Record<EventType, string> = {
  goal: "GOAL",
  assist: "ASSIST",
  yellow_card: "YELLOW",
  red_card: "RED",
  clean_sheet: "CS",
  save: "SAVE",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getEventPointsDelta(event: LiveEvent, multiplier: number): number {
  return (EVENT_POINTS[event.event_type] ?? event.points) * multiplier;
}

function calcPlayerTotal(player: PlayerWithEvents): number {
  // Appearance points (placeholder +2) + sum of events
  const appearancePoints = (player.is_starter ? 2 : 1) * player.multiplier; 
  return appearancePoints + player.events.reduce((sum, e) => sum + getEventPointsDelta(e, player.multiplier), 0);
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function EventBadge({ event }: { event: LiveEvent }) {
  return (
    <span className="text-[9px] font-black tracking-wider px-1.5 py-0.5 rounded-md text-neon bg-neon/10 border border-neon/20">
      {EVENT_LABELS[event.event_type]}
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
          <div className="absolute -top-1 -right-1 w-5 h-5 bg-yellow-500 rounded-full flex items-center justify-center border-2 border-[#0C1220]">
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
            {player.events.map((e) => <EventBadge key={e.id} event={e} />)}
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
  const [players, setPlayers] = useState<PlayerWithEvents[]>([]);
  const [status, setStatus] = useState<any>(null);
  const [lastUpdated, setLastUpdated] = useState(new Date());

  const totalPts = useMemo(() => players.reduce((sum, p) => sum + calcPlayerTotal(p), 0), [players]);

  const initData = useCallback(async () => {
    try {
      setLoading(true);
      const squad = await fetchUserSquad();
      const gwStatus = await getGameweekStatus();
      setStatus(gwStatus);

      if (squad && squad.squad_players) {
        const initialPlayers = squad.squad_players.map((sp: any) => ({
          id: sp.player_id,
          name: sp.player.name,
          position: sp.player.position,
          team_short: sp.player.team_id, // needs better mapping but placeholder
          is_starter: sp.is_starter,
          multiplier: sp.points_multiplier,
          events: []
        }));
        
        // Fetch initial events
        const { data: events } = await supabase
          .from("player_live_points")
          .select("*")
          .in("player_id", initialPlayers.map((p: any) => p.id));

        if (events) {
          initialPlayers.forEach((p: any) => {
            p.events = events.filter((e: any) => e.player_id === p.id);
          });
        }

        setPlayers(initialPlayers);
      }
    } catch (err) {
      console.error("Live Points Init Error:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    initData();

    const channel = supabase
      .channel("live-points-v2")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "player_live_points" }, (payload) => {
        const newEvent = payload.new as LiveEvent;
        setPlayers((prev) => prev.map((p) => {
          if (p.id === newEvent.player_id) return { ...p, events: [...p.events, newEvent] };
          return p;
        }));
        setLastUpdated(new Date());
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [initData]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#070B14] flex flex-col items-center justify-center gap-4 text-neon">
         <Loader2 className="animate-spin" size={32} />
         <span className="text-[10px] font-black uppercase tracking-widest">Gathering Live Feed</span>
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
            <h3 className="text-white font-bold text-xl">Squad Empty</h3>
            <p className="text-gray-500 text-sm">Save your squad first to track your points in real-time!</p>
         </div>
      </div>
    );
  }

  return (
    <div className="pb-8 animate-in fade-in duration-500">
      
      {/* Active Points Hub */}
      <div className="px-5 mt-4 mb-6">
        <div className="bg-[#0F1926] rounded-[32px] border border-white/[0.06] p-6 shadow-2xl relative overflow-hidden">
           <div className="absolute top-0 right-0 p-4">
              <div className="bg-red-500/10 border border-red-500/30 rounded-full px-3 py-1 flex items-center gap-1.5">
                 <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse" />
                 <span className="text-red-500 text-[9px] font-black uppercase tracking-widest">Live</span>
              </div>
           </div>

           <div className="flex flex-col gap-1">
              <span className="text-gray-500 text-[10px] font-black uppercase tracking-widest">Total Points</span>
              <div className="flex items-baseline gap-2">
                 <span className="text-neon font-black text-6xl tracking-tighter tabular-nums">{totalPts}</span>
                 <span className="text-neon/60 text-sm font-black tracking-widest uppercase">Pts</span>
              </div>
           </div>

           <div className="mt-6 flex items-center justify-between border-t border-white/5 pt-4">
              <div className="flex flex-col">
                 <span className="text-gray-500 text-[8px] font-black uppercase">Gameweek {status?.gameweek}</span>
                 <span className="text-white text-xs font-bold">Botola Pro 23/24</span>
              </div>
              <div className="flex items-center gap-2 text-gray-500 text-[9px] font-bold uppercase">
                 <Zap size={10} className="text-neon" />
                 Last Sync: {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </div>
           </div>
        </div>
      </div>

      <div className="px-5 mb-3 flex justify-between items-center">
         <span className="text-white font-black text-[11px] uppercase tracking-widest">Squad Performance</span>
         <Shield size={14} className="text-gray-600" />
      </div>

      <div className="bg-[#0C1220] mx-2 rounded-[32px] border border-white/[0.05] shadow-2xl overflow-hidden divide-y divide-white/5 mb-8">
        {players.map((player) => (
          <PlayerRow key={player.id} player={player} />
        ))}
      </div>

    </div>
  );
}

function Loader2({ className, size }: { className?: string, size?: number }) {
  return <Zap className={cn("animate-pulse", className)} size={size} />;
}
