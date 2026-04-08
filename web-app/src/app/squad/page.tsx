"use client";

import { useEffect, useState } from "react";
import { ArrowLeftRight, User, Search, Filter, Loader2 } from "lucide-react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { supabase } from "@/lib/supabase";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface Player {
  id: string;
  name: string;
  team_id: string;
  position: string;
  price: number;
}

interface Team {
  id: string;
  name?: string;
  short_name: string;
}

export default function SquadPage() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [teamMap, setTeamMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        
        // 1. Fetch Teams for mapping
        const { data: teamsData } = await supabase.from("teams").select("id, name, short_name");
        const mapping: Record<string, string> = {};
        teamsData?.forEach((t: Team) => {
          mapping[t.id] = t.short_name;
        });
        setTeamMap(mapping);

        // 2. Fetch Players
        const { data: playersData } = await supabase
          .from("players")
          .select("id, name, team_id, position, price")
          .order("price", { ascending: false });
        
        if (playersData) setPlayers(playersData);
      } catch (err) {
        console.error("Error fetching squad data:", err);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  const filteredPlayers = players.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.position.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Split into positions for the pitch (Empty for now until we build selection logic)
  const fwd: any[] = [];
  const mid: any[] = [];
  const def: any[] = [];
  const gk: any[] = [];

  const renderRow = (players: any[]) => (
    <div className="flex justify-center items-center gap-1 sm:gap-3 w-full min-h-[80px]">
      {players.length > 0 ? (
        players.map((p) => <PlayerCard key={p.id} player={p} />)
      ) : (
        <div className="w-14 h-14 rounded-full border-2 border-dashed border-white/10 flex items-center justify-center">
          <User className="text-white/5" size={24} />
        </div>
      )}
    </div>
  );

  return (
    <div className="px-5 pb-8 animate-in fade-in duration-500 flex flex-col lg:flex-row gap-8 mt-2">
      
      {/* Left Column: Pitch & Overview */}
      <div className="flex-1 flex flex-col gap-6">
        {/* Header: Balance & Transfers */}
        <div className="flex justify-between items-end">
          <div className="flex flex-col">
            <span className="text-gray-400 text-xs font-semibold tracking-wider uppercase mb-1">
              Current Balance
            </span>
            <div className="flex items-baseline gap-2">
              <span className="text-neon text-4xl font-black tracking-tighter">100.0</span>
              <span className="text-gray-300 text-sm font-medium">/ 100.0 M</span>
            </div>
            <div className="h-1.5 w-48 bg-[#1A2235] rounded-full mt-2 overflow-hidden">
              <div className="h-full bg-neon w-[100%] rounded-full shadow-[0_0_10px_rgba(74,222,128,0.5)]"></div>
            </div>
          </div>

          <button className="bg-neon text-[var(--background)] px-5 py-2.5 rounded-xl font-bold flex items-center gap-2 shadow-[0_4px_14px_0_rgba(74,222,128,0.39)] hover:scale-105 transition-transform">
            <ArrowLeftRight size={18} strokeWidth={2.5} />
            Transfers
          </button>
        </div>

        {/* Pitch Area */}
        <div className="relative w-full aspect-[3/4] bg-[#0c121e] rounded-3xl border border-white/5 overflow-hidden shadow-2xl p-4 flex flex-col justify-between py-6">
          <div className="absolute inset-0 pointer-events-none opacity-20">
            <div className="w-full h-full border-[1.5px] border-neon/50 rounded-lg absolute inset-0 m-4 w-[calc(100%-32px)] h-[calc(100%-32px)]"></div>
            <div className="absolute top-1/2 left-4 right-4 h-[1.5px] bg-neon/50"></div>
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-20 h-20 rounded-full border-[1.5px] border-neon/50"></div>
            <div className="absolute top-4 left-1/2 -translate-x-1/2 w-40 h-24 border-[1.5px] border-neon/50 border-t-0 rounded-b-lg"></div>
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-40 h-24 border-[1.5px] border-neon/50 border-b-0 rounded-t-lg"></div>
          </div>

          <div className="relative z-10 h-full flex flex-col justify-between">
            {renderRow(fwd)}
            {renderRow(mid)}
            {renderRow(def)}
            {renderRow(gk)}
          </div>
        </div>
      </div>

      {/* Right Column: Player Market List */}
      <div className="w-full lg:w-[400px] flex flex-col gap-4">
        <div className="flex items-center justify-between">
            <h3 className="text-white font-bold text-lg">Player Market</h3>
            <span className="text-gray-400 text-xs font-bold uppercase">{loading ? "" : `${filteredPlayers.length} Players`}</span>
        </div>

        {/* Search & Filter */}
        <div className="flex gap-2">
            <div className="relative flex-1">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                <input 
                    type="text" 
                    placeholder="Search name or pos..." 
                    className="w-full bg-[#121A2B] border border-white/5 rounded-xl py-2.5 pl-10 pr-4 text-sm text-white focus:outline-none focus:border-neon/30 transition-colors"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>
            <button className="bg-[#121A2B] border border-white/5 p-2.5 rounded-xl text-white">
                <Filter size={20} />
            </button>
        </div>

        {/* List Header */}
        <div className="grid grid-cols-[40px,1fr,60px,60px] px-4 py-2 text-[10px] font-black tracking-widest text-gray-400 uppercase border-b border-white/5">
            <span>POS</span>
            <span>PLAYER</span>
            <span className="text-right">TEAM</span>
            <span className="text-right text-neon">PRICE</span>
        </div>

        {/* Scrollable Container */}
        <div className="bg-[#121A2B] rounded-3xl border border-white/5 overflow-hidden flex-1 min-h-[400px] lg:max-h-[600px] relative">
            {loading ? (
                <div className="absolute inset-0 flex items-center justify-center gap-2 text-gray-500">
                    <Loader2 className="animate-spin text-neon" size={20} />
                    <span className="text-xs font-bold uppercase tracking-widest">Loading Market...</span>
                </div>
            ) : (
                <div className="overflow-y-auto h-full p-2 custom-scrollbar">
                    {filteredPlayers.map((player) => (
                        <div 
                            key={player.id} 
                            className="grid grid-cols-[40px,1fr,60px,60px] items-center p-3 rounded-2xl hover:bg-white/[0.03] transition-colors group cursor-pointer"
                        >
                            <span className="text-[10px] font-bold text-gray-500 bg-[#1A2235] w-fit px-1.5 py-0.5 rounded uppercase">{player.position}</span>
                            <span className="text-sm font-bold text-white truncate pl-2">{player.name}</span>
                            <span className="text-[10px] font-bold text-gray-300 text-right uppercase">{teamMap[player.team_id] || "???"}</span>
                            <span className="text-sm font-black text-neon text-right">{player.price}M</span>
                        </div>
                    ))}
                    {filteredPlayers.length === 0 && (
                        <div className="p-8 text-center text-gray-500 text-sm italic">No players found matching your search</div>
                    )}
                </div>
            )}
        </div>
      </div>

    </div>
  );
}

function PlayerCard({ player }: { player: any }) {
  return (
    <div className="flex flex-col items-center justify-center group cursor-pointer animate-in zoom-in duration-300">
      <div className="relative w-[52px] h-[52px] rounded-full border-2 border-neon bg-navy-dark shadow-[0_0_15px_rgba(74,222,128,0.3)] flex items-center justify-center transition-transform group-hover:scale-105">
        <User className="text-gray-400" size={24} />
      </div>
      
      <div className="mt-1.5 flex flex-col items-center">
        <div className="bg-[#1A2235] px-2.5 py-1 rounded-t-md border-b border-navy text-[10px] font-bold text-white text-center min-w-[60px] truncate shadow-lg">
          {player.name}
        </div>
        <div className="bg-[#242D45] px-2.5 py-0.5 rounded-b-md text-[10px] font-extrabold text-neon text-center min-w-[60px] shadow-lg">
          {player.points || 0} pts
        </div>
      </div>
    </div>
  );
}
