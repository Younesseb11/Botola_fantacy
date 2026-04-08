"use client";

import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { User, Zap } from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

type EventType = "goal" | "assist" | "yellow_card" | "red_card" | "clean_sheet" | "save";

interface LiveEvent {
  id: string;
  player_id: string;
  event_type: EventType;
  points: number;
  minute?: number;
  created_at: string;
}

interface Player {
  id: string;
  name: string;
  position: string;
  team: {
    name: string;
    short_name: string;
  };
  fixture?: string; // e.g. "vs WAC"
  base_points: number;
  events: LiveEvent[];
}

// ─── Point values for each event ─────────────────────────────────────────────
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

// ─── Mock starting XI ─────────────────────────────────────────────────────────
// In a real app these come from user_squads / squad_players joined with players
const MOCK_SQUAD: Omit<Player, "events">[] = [
  { id: "p1",  name: "El Khayati",   position: "GK",  team: { name: "FAR Rabat",     short_name: "FAR"  }, fixture: "vs WAC",  base_points: 6 },
  { id: "p2",  name: "Ech Chamakh",  position: "DEF", team: { name: "FAR Rabat",     short_name: "FAR"  }, fixture: "vs WAC",  base_points: 2 },
  { id: "p3",  name: "Chemlal",      position: "MID", team: { name: "OCS",           short_name: "OCS"  }, fixture: "vs RAJ",  base_points: 8 },
  { id: "p4",  name: "El Morsli",    position: "MID", team: { name: "OCS",           short_name: "OCS"  }, fixture: "vs RAJ",  base_points: 4 },
  { id: "p5",  name: "Ouhrou",       position: "MID", team: { name: "Maghreb Fez",   short_name: "MAS"  }, fixture: "vs WAC",  base_points: 3 },
  { id: "p6",  name: "Dalouzi",      position: "FWD", team: { name: "Maghreb Fez",   short_name: "MAS"  }, fixture: "vs WAC",  base_points: 5 },
  { id: "p7",  name: "Hannouri",     position: "FWD", team: { name: "Wydad AC",      short_name: "WAC"  }, fixture: "vs FAR",  base_points: 13 },
  { id: "p8",  name: "El Kaabi",     position: "FWD", team: { name: "Berkane",       short_name: "BER"  }, fixture: "vs DIF",  base_points: 11 },
  { id: "p9",  name: "Khairi",       position: "MID", team: { name: "Berkane",       short_name: "BER"  }, fixture: "vs DIF",  base_points: 2 },
  { id: "p10", name: "Lamine",       position: "FWD", team: { name: "Difaa El J.",   short_name: "DIF"  }, fixture: "vs BER",  base_points: 2 },
  { id: "p11", name: "Ghabra",       position: "FWD", team: { name: "IR Tanger",     short_name: "IR"   }, fixture: "vs FUS",  base_points: 2 },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getEventPointsDelta(event: LiveEvent): number {
  return EVENT_POINTS[event.event_type] ?? event.points;
}

function calcPlayerTotal(player: Player): number {
  return player.base_points + player.events.reduce((sum, e) => sum + getEventPointsDelta(e), 0);
}

function calcSquadTotal(players: Player[]): number {
  return players.reduce((sum, p) => sum + calcPlayerTotal(p), 0);
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function EventBadge({ event }: { event: LiveEvent }) {
  const delta = getEventPointsDelta(event);
  const isPositive = delta > 0;
  const isNegative = delta < 0;

  return (
    <span
      className={`text-[9px] font-black tracking-wider px-1.5 py-0.5 rounded-md ${
        isNegative
          ? "text-red-400 bg-red-400/10"
          : isPositive
          ? "text-neon bg-neon/10"
          : "text-gray-400 bg-gray-400/10"
      }`}
    >
      {EVENT_LABELS[event.event_type]}
    </span>
  );
}

function PointsDelta({ delta }: { delta: number }) {
  if (delta === 0) return null;
  const isPos = delta > 0;
  return (
    <span
      className={`text-[11px] font-bold tabular-nums ${
        isPos ? "text-neon" : "text-red-400"
      }`}
    >
      {isPos ? `+${delta}` : delta}
    </span>
  );
}

function PlayerRow({ player }: { player: Player }) {
  const totalPts = calcPlayerTotal(player);
  const eventDelta = player.events.reduce((s, e) => s + getEventPointsDelta(e), 0);
  const hasEvents = player.events.length > 0;

  // Most impactful event to show label
  const latestEvent = player.events.length > 0 ? player.events[player.events.length - 1] : null;
  const latestDelta = latestEvent ? getEventPointsDelta(latestEvent) : 0;

  return (
    <div
      className={`flex items-center gap-3 px-4 py-3.5 border-b border-white/[0.05] last:border-0 transition-all duration-300 ${
        hasEvents ? "bg-white/[0.02]" : ""
      }`}
    >
      {/* Avatar */}
      <div className="relative shrink-0">
        <div className="w-11 h-11 rounded-full bg-[#1A2235] border-2 border-white/10 flex items-center justify-center overflow-hidden">
          <User size={20} className="text-gray-500" />
        </div>
        {/* Position badge */}
        <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 text-[8px] font-black bg-navy-light text-gray-400 px-1.5 rounded-sm border border-white/10 whitespace-nowrap">
          {player.position}
        </span>
      </div>

      {/* Name + Fixture */}
      <div className="flex-1 min-w-0">
        <p className="text-white font-bold text-sm leading-tight truncate uppercase tracking-wide">
          {player.name}
        </p>
        <p className="text-gray-500 text-[11px] mt-0.5 truncate">
          {player.position} • {player.team.short_name} <span className="text-gray-600">•</span> {player.fixture}
        </p>
        {/* Event badges */}
        {hasEvents && (
          <div className="flex gap-1 mt-1.5 flex-wrap">
            {player.events.map((e) => (
              <EventBadge key={e.id} event={e} />
            ))}
          </div>
        )}
      </div>

      {/* Points */}
      <div className="flex flex-col items-end shrink-0 gap-0.5">
        <span className={`text-2xl font-black tabular-nums leading-none ${
          totalPts < 0 ? "text-red-400" : "text-white"
        }`}>
          {totalPts}
        </span>
        {eventDelta !== 0 && (
          <PointsDelta delta={latestDelta} />
        )}
        {latestEvent && (
          <span className={`text-[9px] font-bold tracking-widest uppercase ${
            latestDelta < 0 ? "text-red-400" : "text-neon"
          }`}>
            {EVENT_LABELS[latestEvent.event_type]}
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function LivePointsPage() {
  const [players, setPlayers] = useState<Player[]>(
    MOCK_SQUAD.map((p) => ({ ...p, events: [] }))
  );
  const [matchesInProgress] = useState(4);
  const [gameweek] = useState(12);
  const [activeRank] = useState("1,402");
  const [rankChange] = useState("+12k");
  const [lastUpdated, setLastUpdated] = useState(new Date());

  const totalPts = calcSquadTotal(players);
  const projectedPts = totalPts + 8; // simple projected heuristic

  // ── Supabase real-time subscription ────────────────────────────────────────
  const fetchInitialEvents = useCallback(async () => {
    const playerIds = MOCK_SQUAD.map((p) => p.id);
    const { data, error } = await supabase
      .from("live_events")
      .select("*")
      .in("player_id", playerIds)
      .order("created_at", { ascending: true });

    if (error) {
      console.warn("live_events table not found or error:", error.message);
      return;
    }

    if (data && data.length > 0) {
      applyEvents(data as LiveEvent[]);
    }
  }, []);

  const applyEvents = (events: LiveEvent[]) => {
    setPlayers((prev) => {
      const updated = prev.map((p) => {
        const playerEvents = events.filter((e) => e.player_id === p.id);
        return { ...p, events: playerEvents };
      });
      return updated;
    });
    setLastUpdated(new Date());
  };

  useEffect(() => {
    fetchInitialEvents();

    // Subscribe to real-time inserts on live_events
    const channel = supabase
      .channel("live-points-channel")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "live_events",
        },
        (payload) => {
          const newEvent = payload.new as LiveEvent;
          setPlayers((prev) => {
            return prev.map((p) => {
              if (p.id === newEvent.player_id) {
                return { ...p, events: [...p.events, newEvent] };
              }
              return p;
            });
          });
          setLastUpdated(new Date());
        }
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "live_events",
        },
        (payload) => {
          const deletedId = (payload.old as LiveEvent).id;
          setPlayers((prev) =>
            prev.map((p) => ({
              ...p,
              events: p.events.filter((e) => e.id !== deletedId),
            }))
          );
          setLastUpdated(new Date());
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchInitialEvents]);

  return (
    <div className="pb-8 animate-in fade-in duration-500">
      {/* ── Live Status Bar ─────────────────────────────────────────────── */}
      <div className="px-5 mt-1 mb-4">
        <div className="flex items-center gap-2.5 bg-[#0F1926] rounded-2xl px-4 py-3 border border-white/[0.06]">
          <span className="flex items-center gap-1.5">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
            </span>
            <span className="text-red-400 font-black text-xs tracking-widest">LIVE</span>
          </span>
          <span className="text-gray-500 text-xs">Gameweek {gameweek}</span>
          <span className="text-gray-600">•</span>
          <span className="text-gray-400 text-xs">
            {matchesInProgress} matches in progress
          </span>
          <span className="ml-auto text-gray-600 text-[9px]">
            {lastUpdated.toLocaleTimeString()}
          </span>
        </div>
      </div>

      {/* ── Points Header ───────────────────────────────────────────────── */}
      <div className="px-5 mb-5">
        <div className="bg-[#0F1926] rounded-3xl border border-white/[0.06] p-5 flex items-start justify-between gap-4">
          {/* Left: Points */}
          <div className="flex flex-col">
            <div className="flex items-baseline gap-2">
              <span className="text-neon font-black text-6xl leading-none tabular-nums">
                {totalPts}
              </span>
              <span className="text-neon text-sm font-black tracking-widest self-end mb-1">PTS</span>
            </div>
            <span className="text-gray-500 text-xs mt-1.5">
              Projected: <span className="text-gray-300 font-semibold">{projectedPts} pts</span>
            </span>
          </div>

          {/* Right: Active Rank */}
          <div className="flex flex-col items-end bg-[#1A2235]/80 rounded-2xl px-4 py-3 border border-white/[0.06]">
            <span className="text-gray-500 text-[9px] font-bold tracking-widest uppercase mb-1">Active Rank</span>
            <span className="text-white font-black text-xl leading-none">#{activeRank}</span>
            <span className="text-neon text-[10px] font-bold mt-1">{rankChange} positions</span>
          </div>
        </div>
      </div>

      {/* ── Starting XI Header ──────────────────────────────────────────── */}
      <div className="px-5 flex items-center justify-between mb-1">
        <span className="text-white font-bold text-[13px] tracking-wider uppercase">Starting XI</span>
        <span className="text-gray-600 text-[10px] tracking-wider uppercase">Performance Metrics</span>
      </div>

      {/* ── Player List ─────────────────────────────────────────────────── */}
      <div className="bg-[#0C1220] mx-2 rounded-3xl border border-white/[0.05] overflow-hidden shadow-2xl">
        {players.map((player) => (
          <PlayerRow key={player.id} player={player} />
        ))}
      </div>

      {/* ── Live indicator footer ────────────────────────────────────────── */}
      <div className="flex items-center justify-center gap-2 mt-4 text-gray-600 text-xs">
        <Zap size={12} className="text-neon" />
        <span>Auto-updating in real time</span>
      </div>
    </div>
  );
}
