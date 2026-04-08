"use client";

import { ArrowLeftRight, User } from "lucide-react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Dummy data based on the screenshot
const SQUAD = [
  { id: 1, name: "Salah", points: 12, position: "FWD", isStarter: true, hasPhoto: true },
  { id: 2, name: "Benzema", points: 8, position: "FWD", isStarter: true, hasPhoto: true },
  { id: 3, name: "El Haddad", points: 5, position: "MID", isStarter: true, hasPhoto: true },
  { id: 4, name: "De Bruyne", points: 15, position: "MID", isStarter: true, hasPhoto: true },
  { id: 5, name: "Modric", points: 4, position: "MID", isStarter: true, hasPhoto: false },
  { id: 6, name: "Pedri", points: 2, position: "MID", isStarter: true, hasPhoto: false },
  { id: 7, name: "Van Dijk", points: 6, position: "DEF", isStarter: true, hasPhoto: false },
  { id: 8, name: "Hakimi", points: 9, position: "DEF", isStarter: true, hasPhoto: false },
  { id: 9, name: "Alaba", points: 3, position: "DEF", isStarter: true, hasPhoto: false },
  { id: 10, name: "Walker", points: 1, position: "DEF", isStarter: true, hasPhoto: false },
  { id: 11, name: "Bounou", points: 7, position: "GK", isStarter: true, hasPhoto: true },
];

const BENCH = [
  { id: 12, name: "Ziyech", points: 0, position: "MID", isStarter: false, hasPhoto: false },
  { id: 13, name: "Saiss", points: 0, position: "DEF", isStarter: false, hasPhoto: false },
  { id: 14, name: "En-Nesyri", points: 0, position: "FWD", isStarter: false, hasPhoto: false },
  { id: 15, name: "Munir", points: 0, position: "GK", isStarter: false, hasPhoto: false },
];

export default function SquadPage() {
  const fwd = SQUAD.filter(p => p.position === "FWD");
  const mid = SQUAD.filter(p => p.position === "MID");
  const def = SQUAD.filter(p => p.position === "DEF");
  const gk = SQUAD.filter(p => p.position === "GK");

  const renderRow = (players: typeof SQUAD) => (
    <div className="flex justify-center items-center gap-1 sm:gap-3 w-full">
      {players.map((p) => (
        <PlayerCard key={p.id} player={p} />
      ))}
    </div>
  );

  return (
    <div className="px-5 pb-8 animate-in fade-in duration-500">
      
      {/* Header: Balance & Transfers */}
      <div className="flex justify-between items-end mb-6 mt-2">
        <div className="flex flex-col">
          <span className="text-gray-400 text-xs font-semibold tracking-wider uppercase mb-1">
            Current Balance
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-neon text-4xl font-black tracking-tighter">65.5</span>
            <span className="text-gray-300 text-sm font-medium">/ 100.0 M</span>
          </div>
          <div className="h-1.5 w-full bg-navy-light rounded-full mt-2 overflow-hidden">
            <div className="h-full bg-neon w-[65.5%] rounded-full shadow-[0_0_10px_rgba(74,222,128,0.5)]"></div>
          </div>
        </div>

        <button className="bg-neon text-[var(--background)] px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-[0_4px_14px_0_rgba(74,222,128,0.39)] hover:scale-105 transition-transform">
          <ArrowLeftRight size={18} strokeWidth={2.5} />
          Transfers
        </button>
      </div>

      {/* Pitch Area */}
      <div className="relative w-full aspect-[3/4] bg-[#0c121e] rounded-3xl border border-white/5 overflow-hidden shadow-2xl p-4 flex flex-col justify-between py-6">
        
        {/* CSS Pitch Lines Overlay */}
        <div className="absolute inset-0 pointer-events-none opacity-20">
          <div className="w-full h-full border-[1.5px] border-neon/50 rounded-lg absolute inset-0 m-4 w-[calc(100%-32px)] h-[calc(100%-32px)]"></div>
          <div className="absolute top-1/2 left-4 right-4 h-[1.5px] bg-neon/50"></div>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-20 h-20 rounded-full border-[1.5px] border-neon/50"></div>
          <div className="absolute top-4 left-1/2 -translate-x-1/2 w-40 h-24 border-[1.5px] border-neon/50 border-t-0 rounded-b-lg"></div>
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-40 h-24 border-[1.5px] border-neon/50 border-b-0 rounded-t-lg"></div>
        </div>

        {/* Players */}
        <div className="relative z-10 h-full flex flex-col justify-between">
          {renderRow(fwd)}
          {renderRow(mid)}
          {renderRow(def)}
          {renderRow(gk)}
        </div>
      </div>

      {/* Bench (Optional visual addition below pitch) */}
      <div className="mt-4 bg-[#0c121e] rounded-2xl border border-white/5 p-4">
        <h3 className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-3">Bench</h3>
        <div className="flex justify-between items-center">
          {BENCH.map(p => (
            <PlayerCard key={p.id} player={p} size="small" />
          ))}
        </div>
      </div>

    </div>
  );
}

function PlayerCard({ player, size = "normal" }: { player: { id: number; name: string; points: number; position: string; isStarter: boolean; hasPhoto: boolean }, size?: "normal" | "small" }) {

  const isSmall = size === "small";
  
  return (
    <div className="flex flex-col items-center justify-center group cursor-pointer">
      <div className={cn(
        "relative rounded-full flex items-center justify-center transition-transform group-hover:scale-105",
        isSmall ? "w-10 h-10 border border-gray-600 bg-navy-light" : "w-[52px] h-[52px] border-2 border-neon bg-navy-dark shadow-[0_0_15px_rgba(74,222,128,0.3)]"
      )}>
        {player.hasPhoto ? (
          // Simulated photo with gradient placeholder for now since we don't have images
          <div className={cn("w-full h-full rounded-full bg-gradient-to-br from-gray-700 to-navy-dark", isSmall ? "" : "border-2 border-transparent")}>
             <User className={cn("absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-gray-400", isSmall ? "w-5 h-5" : "w-6 h-6")} />
          </div>
        ) : (
          <User className={cn("text-gray-500", isSmall ? "w-5 h-5" : "w-7 h-7")} />
        )}
      </div>
      
      <div className={cn("mt-1.5 flex flex-col items-center", isSmall ? "scale-90" : "")}>
        <div className="bg-[#1A2235] px-2.5 py-1 rounded-t-md border-b border-navy text-[10px] font-bold text-white text-center min-w-[60px] truncate shadow-lg">
          {player.name}
        </div>
        <div className="bg-[#242D45] px-2.5 py-0.5 rounded-b-md text-[10px] font-extrabold text-neon text-center min-w-[60px] shadow-lg">
          {player.points} pts
        </div>
      </div>
    </div>
  );
}
