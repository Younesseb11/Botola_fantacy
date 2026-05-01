"use client";

import { useState } from "react";
import { User, Shield, Info, Star } from "lucide-react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface Player {
  id: string;
  name: string;
  position: string;
  team?: { 
    short_name: string;
    logo_url?: string | null;
  };
}

interface SquadPlayer {
  id: string;
  player_id: string;
  is_starter: boolean;
  bench_order: number | null;
  points_multiplier: number;
  player: Player;
}

interface PitchViewProps {
  players: SquadPlayer[];
  onSwap: (playerAId: string, playerBId: string) => void;
  onSetCaptain: (playerId: string) => void;
  isLocked: boolean;
  pointsMap?: Record<string, number>;
  onError?: (msg: string) => void;
}

export function PitchView({ players, onSwap, onSetCaptain, isLocked, pointsMap = {}, onError }: PitchViewProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const starters = players.filter((p) => p.is_starter);
  const bench = players
    .filter((p) => !p.is_starter)
    .sort((a, b) => (a.bench_order || 0) - (b.bench_order || 0));

  const gks = starters.filter((p) => p.player.position === "GK");
  const defs = starters.filter((p) => p.player.position === "DEF");
  const mids = starters.filter((p) => p.player.position === "MID");
  const fwds = starters.filter((p) => p.player.position === "FWD");

  const formationStr = `${defs.length}-${mids.length}-${fwds.length}`;

  const handlePlayerClick = (p: SquadPlayer) => {
    if (isLocked) return;

    if (!selectedId) {
      setSelectedId(p.player_id);
    } else {
      if (selectedId === p.player_id) {
        setSelectedId(null);
      } else {
        const p1 = players.find(x => x.player_id === selectedId);
        const p2 = p;

        if (p1 && p2) {
          // Rule: Max 1 GK in starters
          // If we are swapping a bench GK into a starter slot, the target MUST be the starting GK.
          const swappingInGK = (p1.player.position === "GK" && !p1.is_starter) || (p2.player.position === "GK" && !p2.is_starter);
          const bothGKs = p1.player.position === "GK" && p2.player.position === "GK";

          if (swappingInGK && !bothGKs) {
             // Block the swap (e.g., trying to swap bench GK with a Defender)
             if (onError) {
               onError("Only one Goalkeeper allowed in the starting XI!");
             }
             setSelectedId(null);
             return;
          }

          if (p1.is_starter !== p2.is_starter) {
            onSwap(p1.player_id, p2.player_id);
          }
        }
        setSelectedId(null);
      }
    }
  };

  const PlayerCard = ({ p, isBench = false }: { p: SquadPlayer; isBench?: boolean }) => {
    const isSelected = selectedId === p.player_id;
    const isCaptain = p.points_multiplier > 1;
    const teamName = p.player.team?.short_name || "TEAM";
    const teamLogo = p.player.team?.logo_url;

    return (
      <div 
        onClick={() => handlePlayerClick(p)}
        className={cn(
          "flex flex-col items-center gap-1 transition-all cursor-pointer relative group",
          isSelected ? "scale-110 z-10" : "hover:scale-105",
          isLocked && "cursor-not-allowed opacity-80"
        )}
      >
        <div className={cn(
          "w-12 h-12 sm:w-14 sm:h-14 rounded-xl flex items-center justify-center relative border-2 transition-all",
          isSelected ? "border-neon bg-neon/20 shadow-[0_0_15px_rgba(74,222,128,0.4)]" : "border-white/10 bg-[#1A2235]",
          isBench ? "rounded-lg" : "rounded-2xl"
        )}>
          <User className={cn(isSelected ? "text-neon" : "text-gray-400")} size={24} />
          
          {/* Position Badge */}
          <div className="absolute -top-2 -left-2 bg-navy-light px-1.5 py-0.5 rounded-md border border-white/10 shadow-lg">
             <span className="text-[8px] font-black text-gray-400">{p.player.position}</span>
          </div>

          {isCaptain && (
            <div className="absolute -top-2 -right-2 w-6 h-6 bg-yellow-500 rounded-full flex items-center justify-center border-2 border-[#070B14] shadow-lg">
              <span className="text-[10px] font-black text-black">C</span>
            </div>
          )}

          {!isLocked && !isBench && (
            <button 
              onClick={(e) => {
                e.stopPropagation();
                onSetCaptain(p.player_id);
              }}
              className={cn(
                "absolute -bottom-1 -right-1 hover:bg-neon hover:text-black p-1 rounded-md transition-all z-20",
                isCaptain ? "bg-yellow-500/20 text-yellow-500 opacity-100" : "bg-white/10 text-white opacity-40"
              )}
              title="Set as Captain"
            >
              <Star size={10} fill={isCaptain ? "currentColor" : "none"} />
            </button>
          )}
        </div>
        
        <div className="flex flex-col items-center max-w-[70px]">
          <span className="text-white text-[10px] sm:text-xs font-bold truncate w-full text-center tracking-tight">
            {p.player.name.split(' ').pop()}
          </span>
          <div className="flex items-center gap-1">
            {teamLogo && (
              <img src={teamLogo} alt="" className="w-2.5 h-2.5 object-contain opacity-70" />
            )}
            <span className="text-[8px] font-black text-neon/60 uppercase">
               {teamName}
            </span>
            <span className="text-[8px] font-black text-neon">
               {pointsMap[p.player_id] || 0}P
            </span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-6 animate-in fade-in duration-500">
      
      {/* Pitch Info Header */}
      <div className="flex justify-between items-center px-2">
         <div className="flex flex-col">
            <span className="text-gray-500 text-[10px] font-black uppercase tracking-widest leading-none mb-1">Current Formation</span>
            <span className="text-white text-2xl font-black tracking-tighter">{formationStr}</span>
         </div>
         {isLocked && (
           <div className="bg-red-500/10 border border-red-500/20 rounded-full px-4 py-1.5 flex items-center gap-2">
              <Shield size={14} className="text-red-500" />
              <span className="text-red-500 text-[10px] font-black uppercase">Squad Locked</span>
           </div>
         )}
      </div>

      {/* Virtual Pitch */}
      <div className="relative aspect-[3/4] w-full bg-[#0F172A] rounded-[40px] border-4 border-white/5 overflow-hidden shadow-2xl p-6 flex flex-col justify-between">
        <div className="absolute inset-x-0 top-1/2 h-px bg-white/5 -translate-y-1/2" />
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-24 h-24 border border-white/5 rounded-full" />
        
        {/* Forward Row */}
        <div className="flex justify-center gap-8 items-center h-1/4">
          {fwds.map(p => <PlayerCard key={p.id} p={p} />)}
        </div>

        {/* Midfield Row */}
        <div className="flex justify-center gap-4 items-center h-1/4">
          {mids.map(p => <PlayerCard key={p.id} p={p} />)}
        </div>

        {/* Defense Row */}
        <div className="flex justify-center gap-4 items-center h-1/4">
          {defs.map(p => <PlayerCard key={p.id} p={p} />)}
        </div>

        {/* Goalkeeper Row */}
        <div className="flex justify-center items-center h-1/4">
          {gks.map(p => <PlayerCard key={p.id} p={p} />)}
        </div>
      </div>

      {/* Bench Section */}
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2 px-2">
          <Info size={14} className="text-gray-500" />
          <span className="text-gray-500 text-[10px] font-black uppercase tracking-widest">Substitutes</span>
        </div>
        <div className="bg-[#121A2B] border border-white/5 rounded-[32px] p-4 flex justify-around items-center">
            {bench.map(p => <PlayerCard key={p.id} p={p} isBench />)}
        </div>
      </div>

    </div>
  );
}
