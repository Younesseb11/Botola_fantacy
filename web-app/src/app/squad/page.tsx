"use client";

import { useEffect, useState, useMemo } from "react";
import { 
  Plus, Trash2, Coins, Users, User, ChevronUp, ChevronDown, 
  AlertCircle, CheckCircle2, Loader2, Shield, Zap, Info, Bug, RefreshCcw
} from "lucide-react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { supabase } from "@/lib/supabase";
import { 
  getGameweekStatus, 
  saveInitialSquad, 
  fetchUserSquad, 
  updateSquadArrangement,
  type SquadStatus
} from "./actions";
import { PitchView } from "@/components/PitchView";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Configuration
const BUDGET_TOTAL = 100.0;
const LIMITS: Record<string, number> = {
  GK: 2,
  DEF: 5,
  MID: 5,
  FWD: 3
};

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
  // Data State
  const [players, setPlayers] = useState<Player[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [teamMap, setTeamMap] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Persistence State
  const [squadStatus, setSquadStatus] = useState<SquadStatus | null>(null);
  const [persistedSquad, setPersistedSquad] = useState<any>(null);

  // Draft/UI State
  const [draft, setDraft] = useState<Player[]>([]);
  const [draftPoints, setDraftPoints] = useState<Record<string, number>>({});
  const [currentTab, setCurrentTab] = useState<"market" | "draft" | "pitch">("market");
  const [searchTerm, setSearchTerm] = useState("");
  const [posFilter, setPosFilter] = useState<string>("ALL");
  const [teamFilter, setTeamFilter] = useState<string>("ALL");
  const [sortDir, setSortDir] = useState<"desc" | "asc">("desc");

  // Test Mode
  const [testMode, setTestMode] = useState(false);

  // Feedback State
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    async function init() {
      try {
        setLoading(true);
        
        // 1. Fetch metadata
        const { data: teamsData } = await supabase.from("teams").select("id, name, short_name").order('name');
        if (teamsData) setTeams(teamsData);
        const mapping: Record<string, string> = {};
        teamsData?.forEach((t: Team) => { mapping[t.id] = t.short_name; });
        setTeamMap(mapping);

        const { data: playersData } = await supabase.from("players").select("id, name, team_id, position, price");
        if (playersData) setPlayers(playersData);

        // 2. Auth & Squad Check
        const status = await getGameweekStatus();
        setSquadStatus(status);

        const squad = await fetchUserSquad();
        if (squad) {
          setPersistedSquad(squad);
          setCurrentTab("pitch"); // Show team if already drafted
        }
      } catch (err) {
        console.error("Initialization error:", err);
      } finally {
        setLoading(false);
      }
    }
    init();
  }, []);

  // Fetch points for draft and persisted players
  useEffect(() => {
    async function fetchPoints() {
      const targetIds = new Set<string>();
      draft.forEach(p => targetIds.add(p.id));
      if (persistedSquad?.squad_players) {
        persistedSquad.squad_players.forEach((sp: any) => targetIds.add(sp.player_id));
      }

      if (targetIds.size === 0) return;

      const today = new Date().toISOString().split('T')[0];

      const { data } = await supabase
        .from("player_live_points")
        .select("player_id, points")
        .in("player_id", Array.from(targetIds))
        .gte("created_at", today);

      const pointsMapping: Record<string, number> = {};
      data?.forEach(e => {
        pointsMapping[e.player_id] = (pointsMapping[e.player_id] || 0) + e.points;
      });
      setDraftPoints(pointsMapping);
    }
    fetchPoints();
  }, [draft, persistedSquad]);

  // Derived State
  const spent = useMemo(() => draft.reduce((acc, p) => acc + p.price, 0), [draft]);
  const remainingBudget = Number((BUDGET_TOTAL - spent).toFixed(1));
  
  const counts = useMemo(() => {
    const c: Record<string, number> = { GK: 0, DEF: 0, MID: 0, FWD: 0 };
    draft.forEach(p => { c[p.position]++; });
    return c;
  }, [draft]);

  const filteredPlayers = useMemo(() => {
    return players
      .filter(p => {
        const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesPos = posFilter === "ALL" || p.position === posFilter;
        const matchesTeam = teamFilter === "ALL" || p.team_id === teamFilter;
        return matchesSearch && matchesPos && matchesTeam;
      })
      .sort((a, b) => sortDir === "desc" ? b.price - a.price : a.price - b.price);
  }, [players, searchTerm, posFilter, teamFilter, sortDir]);

  // Logic
  const addPlayer = (player: Player) => {
    if (draft.find(p => p.id === player.id)) return showError("Already in draft!");
    
    if (!testMode) {
      if (remainingBudget < player.price) return showError("Insufficient budget!");
      if (counts[player.position] >= LIMITS[player.position]) return showError(`${player.position} limit reached!`);
    }
    
    if (draft.length >= 15) return showError("Draft is full!");

    setDraft([...draft, player]);
  };

  const removePlayer = (playerId: string) => {
    setDraft(draft.filter(p => p.id !== playerId));
  };

  const handleConfirmSquad = async () => {
    if (draft.length < 15) return;
    try {
      setSaving(true);
      // Logic in actions.ts handles the 11/4 split automatically in the version we just updated
      await saveInitialSquad(draft.map(p => p.id));
      const squad = await fetchUserSquad();
      setPersistedSquad(squad);
      setCurrentTab("pitch");
      showSuccess("Squad Saved Successfully!");
    } catch (err: any) {
      console.error("Save error:", err);
      const msg = err.message || "Failed to save squad.";
      showError(msg);
    } finally {
      setSaving(false);
    }
  };

  const handleSwap = async (p1Id: string, p2Id: string) => {
    if (!persistedSquad || squadStatus?.locked) return;
    const newSquadPlayers = [...persistedSquad.squad_players];
    const idx1 = newSquadPlayers.findIndex(x => x.player_id === p1Id);
    const idx2 = newSquadPlayers.findIndex(x => x.player_id === p2Id);

    const tmpIsStarter = newSquadPlayers[idx1].is_starter;
    const tmpBenchOrder = newSquadPlayers[idx1].bench_order;

    newSquadPlayers[idx1].is_starter = newSquadPlayers[idx2].is_starter;
    newSquadPlayers[idx1].bench_order = newSquadPlayers[idx2].bench_order;

    newSquadPlayers[idx2].is_starter = tmpIsStarter;
    newSquadPlayers[idx2].bench_order = tmpBenchOrder;

    setPersistedSquad({ ...persistedSquad, squad_players: newSquadPlayers });

    try {
      await updateSquadArrangement(persistedSquad.id, newSquadPlayers.map(p => ({
        id: p.player_id,
        is_starter: p.is_starter,
        bench_order: p.bench_order,
        points_multiplier: p.points_multiplier
      })));
    } catch (err: any) {
      showError(err.message || "Failed to sync swap");
    }
  };

  const handleSetCaptain = async (playerId: string) => {
    if (!persistedSquad || squadStatus?.locked) return;
    const newSquadPlayers = persistedSquad.squad_players.map((p: any) => ({
      ...p,
      points_multiplier: p.player_id === playerId ? 2 : 1
    }));
    setPersistedSquad({ ...persistedSquad, squad_players: newSquadPlayers });
    try {
      await updateSquadArrangement(persistedSquad.id, newSquadPlayers.map((p: any) => ({
        id: p.player_id,
        is_starter: p.is_starter,
        bench_order: p.bench_order,
        points_multiplier: p.points_multiplier
      })));
      showSuccess("Captained!");
    } catch (err: any) {
      showError(err.message || "Failed to set captain");
    }
  };

  const handleResetForTest = async () => {
    if(!confirm("THIS WILL DELETE YOUR SQUAD FOR TESTING. Proceed?")) return;
    try {
       setLoading(true);
       if (persistedSquad) {
          await supabase.from("user_squads")
            .delete()
            .eq("id", persistedSquad.id);
       }
       setPersistedSquad(null);
       setDraft([]);
       setCurrentTab("market");
       showSuccess("Squad Reset for Testing!");
    } catch (err) {
       showError("Failed to reset");
    } finally {
       setLoading(false);
    }
  };

  const showError = (msg: string) => { setError(msg); setTimeout(() => setError(null), 3000); };
  const showSuccess = (msg: string) => { setSuccess(msg); setTimeout(() => setSuccess(null), 3000); };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#070B14] flex flex-col items-center justify-center gap-4 text-neon">
        <Loader2 className="animate-spin" size={40} />
        <span className="text-[10px] font-black uppercase tracking-[0.2em]">Synchronizing Data</span>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-[#070B14] pb-24">
      
      {/* Dynamic Header */}
      <div className="sticky top-0 z-50 bg-[#0c121e]/80 backdrop-blur-xl border-b border-white/5 py-4 px-5 shadow-2xl">
        <div className="max-w-4xl mx-auto">
          {!persistedSquad ? (
            /* Draft Mode Header */
            <div className="flex flex-col gap-4">
               <div className="flex justify-between items-center text-neon">
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-gray-500 text-[9px] font-black tracking-widest uppercase">Budget</span>
                      {testMode && <span className="bg-orange-500/10 text-orange-500 text-[8px] font-black px-1.5 py-0.5 rounded border border-orange-500/20">TEST MODE</span>}
                    </div>
                    <span className={cn("text-4xl font-black tracking-tighter transition-all", remainingBudget < 0 && !testMode ? "text-red-500" : "text-neon")}>
                      {remainingBudget.toFixed(1)}M
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-3">
                    <button 
                      onClick={() => setTestMode(!testMode)}
                      className={cn(
                        "p-2 rounded-xl border transition-all",
                        testMode ? "bg-orange-500 text-black border-orange-600 shadow-lg" : "bg-white/5 text-gray-500 border-white/5"
                      )}
                      title="Toggle Test Mode (Bypass Limits)"
                    >
                      <Bug size={18} />
                    </button>
                    <button 
                      onClick={handleResetForTest}
                      className="p-2 bg-red-500 text-white hover:bg-red-600 border border-red-500/20 rounded-lg transition-all shadow-lg active:scale-95"
                      title="Reset Squad (Test Only)"
                    >
                      <RefreshCcw size={16} />
                    </button>
                    <div className="bg-neon/10 px-4 py-2 rounded-2xl border border-neon/20 flex items-center gap-3">
                      <Users size={18} />
                      <span className="text-white font-black text-xl">{draft.length}<span className="text-gray-500 text-sm">/15</span></span>
                    </div>
                  </div>
               </div>
               <div className="grid grid-cols-4 gap-2">
                 {Object.keys(LIMITS).map(pos => (
                   <div key={pos} className="bg-white/[0.03] rounded-xl p-2 border border-white/5 flex flex-col items-center">
                     <span className="text-gray-500 text-[9px] font-black uppercase">{pos}</span>
                     <span className={cn(
                       "text-xs font-bold", 
                       counts[pos] === LIMITS[pos] && !testMode ? "text-neon" : "text-white"
                     )}>{counts[pos]}/{LIMITS[pos]}</span>
                   </div>
                 ))}
               </div>
            </div>
          ) : (
            /* Active Squad Header */
            <div className="flex justify-between items-center py-2">
               <div className="flex flex-col">
                  <span className="text-gray-500 text-[10px] font-black uppercase tracking-widest">Gameweek {squadStatus?.gameweek}</span>
                  <span className="text-white text-2xl font-black tracking-tighter">Your Squad</span>
               </div>
               <div className="flex items-center gap-3">
                  <button 
                    onClick={handleResetForTest}
                    className="p-2 bg-red-500 text-white hover:bg-red-600 border border-red-500/20 rounded-lg transition-all shadow-lg active:scale-95"
                    title="Reset Squad (Test Only)"
                  >
                    <RefreshCcw size={16} />
                  </button>
                  <div className="flex flex-col items-end">
                  <span className="text-gray-500 text-[9px] font-black uppercase tracking-widest leading-none mb-1">Status</span>
                  <div className={cn(
                    "px-3 py-1 rounded-full text-[10px] font-black uppercase",
                    squadStatus?.locked ? "bg-red-500/10 text-red-500 border border-red-500/20" : "bg-neon/10 text-neon border border-neon/20"
                  )}>
                    {squadStatus?.locked ? "LOCKED" : "OPEN"}
                  </div>
                </div>
             </div>
          </div>
           )}
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-5 mt-6 flex flex-col gap-6">
        
        {/* Tab Switcher */}
        <div className="flex bg-[#121A2B] p-1.5 rounded-2xl border border-white/5 self-center shadow-xl">
           {!persistedSquad && (
             <>
                <button onClick={() => setCurrentTab("market")} className={cn("px-8 py-2.5 rounded-xl text-sm font-bold transition-all", currentTab === "market" ? "bg-neon text-black" : "text-gray-400")}>Market</button>
                <button onClick={() => setCurrentTab("draft")} className={cn("px-8 py-2.5 rounded-xl text-sm font-bold transition-all", currentTab === "draft" ? "bg-neon text-black" : "text-gray-400")}>Pitch</button>
             </>
           )}
           {persistedSquad && (
             <>
                <button onClick={() => setCurrentTab("pitch")} className={cn("px-8 py-2.5 rounded-xl text-sm font-bold transition-all", currentTab === "pitch" ? "bg-neon text-black" : "text-gray-400")}>Pitch</button>
                <button className="px-8 py-2.5 rounded-xl text-sm font-bold text-gray-700 cursor-not-allowed" disabled>Transfers (Locked)</button>
             </>
           )}
        </div>

        {/* View Content */}
        {currentTab === "market" && !persistedSquad && (
          <div className="flex flex-col gap-4 animate-in slide-in-from-left-4 duration-300">
             <div className="flex flex-col sm:flex-row gap-3">
                <input 
                  type="text" placeholder="Search players..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
                  className="flex-1 bg-[#121A2B] border border-white/5 rounded-2xl py-3 px-5 text-white outline-none focus:border-neon/30 shadow-inner"
                />
                <select value={posFilter} onChange={(e) => setPosFilter(e.target.value)} className="bg-[#121A2B] border border-white/5 rounded-2xl px-4 py-3 text-white text-sm outline-none shadow-inner">
                  <option value="ALL">All Pos</option>
                  <option value="GK">GK</option>
                  <option value="DEF">DEF</option>
                  <option value="MID">MID</option>
                  <option value="FWD">FWD</option>
                </select>
                <select value={teamFilter} onChange={(e) => setTeamFilter(e.target.value)} className="bg-[#121A2B] border border-white/5 rounded-2xl px-4 py-3 text-white text-sm outline-none shadow-inner">
                  <option value="ALL">All Teams</option>
                  {teams.map(t => (
                    <option key={t.id} value={t.id}>{t.short_name}</option>
                  ))}
                </select>
             </div>

             <div className="bg-[#121A2B] border border-white/5 rounded-[32px] overflow-hidden divide-y divide-white/5 shadow-2xl">
                {filteredPlayers.map(p => {
                  const inDraft = !!draft.find(x => x.id === p.id);
                  return (
                    <div key={p.id} className="flex items-center justify-between p-4 group hover:bg-white/[0.02] transition-colors">
                       <div className="flex items-center gap-3">
                          <span className="text-[10px] font-black text-white/40 bg-white/5 px-2 py-0.5 rounded uppercase">{p.position}</span>
                          <div className="flex flex-col">
                            <span className="text-white font-bold group-hover:text-neon transition-colors">{p.name}</span>
                            <span className="text-gray-500 text-[10px] font-black uppercase tracking-widest">{teamMap[p.team_id]}</span>
                          </div>
                       </div>
                       <div className="flex items-center gap-4">
                          <span className="text-neon font-black tabular-nums">{p.price}M</span>
                          <button disabled={inDraft} onClick={() => addPlayer(p)} className={cn("w-10 h-10 rounded-xl flex items-center justify-center transition-all", inDraft ? "bg-white/5 text-gray-700" : "bg-neon/10 text-neon hover:bg-neon hover:text-black shadow-lg shadow-black/20")}>
                            {inDraft ? <CheckCircle2 size={18} /> : <Plus size={18} />}
                          </button>
                       </div>
                    </div>
                  );
                })}
             </div>
          </div>
        )}

        {currentTab === "draft" && !persistedSquad && (
           <div className="flex flex-col gap-8 animate-in slide-in-from-right-4 duration-300 pb-12">
              <div className="relative aspect-[3/4] w-full bg-[#0F172A] rounded-[40px] border-4 border-white/5 overflow-hidden shadow-2xl p-6 flex flex-col justify-between">
                 {/* Position Rows */}
                 {['FWD', 'MID', 'DEF', 'GK'].map(pos => (
                   <div key={pos} className="flex flex-wrap justify-center gap-4 flex-1 items-center">
                      {draft.filter(p => p.position === pos).map(p => (
                        <div key={p.id} className="relative group cursor-pointer" onClick={() => removePlayer(p.id)}>
                           <div className="w-12 h-12 flex flex-col items-center justify-center bg-[#1A2235] rounded-xl border-2 border-white/10 group-hover:border-red-500/50 transition-all shadow-xl">
                              <User size={20} className="text-gray-500 group-hover:text-red-500" />
                              <div className="absolute -top-1 -right-1 bg-red-500 text-white w-4 h-4 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 scale-75 transition-all">
                                <Trash2 size={10} />
                              </div>
                           </div>
                           <div className="flex flex-col items-center mt-1">
                              <span className="text-[9px] font-black text-white truncate max-w-[50px]">{p.name.split(' ').pop()}</span>
                              <div className="flex items-center gap-1">
                                 <span className="text-[7px] font-black text-gray-500 uppercase">{teamMap[p.team_id]}</span>
                                 <span className="text-[7px] font-black text-neon">{draftPoints[p.id] || 0}P</span>
                              </div>
                           </div>
                        </div>
                      ))}
                   </div>
                 ))}
                 
                 {draft.length === 0 && (
                    <div className="absolute inset-0 flex items-center justify-center text-gray-600 font-black uppercase text-xs tracking-widest opacity-20">Draft Empty</div>
                 )}
              </div>

              <div className="flex flex-col gap-4">
                 <div className="flex items-center gap-2 px-2">
                    <Info size={14} className="text-gray-500" />
                    <span className="text-gray-500 text-[9px] font-black uppercase tracking-widest">Saving will set first 11 as starters (GK-DEF-MID-FWD order)</span>
                 </div>
                 <button 
                  disabled={draft.length < 15 || saving} 
                  onClick={handleConfirmSquad}
                  className="w-full bg-neon text-black font-black py-4 rounded-[24px] shadow-2xl shadow-neon/10 flex items-center justify-center gap-3 active:scale-95 transition-all disabled:opacity-50 disabled:grayscale"
                >
                  {saving ? <Loader2 className="animate-spin" /> : <Shield size={20} />}
                  SAVE SQUAD ({draft.length}/15)
                </button>
              </div>
           </div>
        )}

        {currentTab === "pitch" && persistedSquad && (
          <PitchView 
            players={persistedSquad.squad_players} 
            onSwap={handleSwap} 
            onSetCaptain={handleSetCaptain}
            isLocked={!!squadStatus?.locked}
            pointsMap={draftPoints}
          />
        )}
      </div>

      {/* Notifications */}
      <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-3">
         {error && <div className="bg-red-500 text-white px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-2 animate-bounce border border-white/20"><AlertCircle size={18} />{error}</div>}
         {success && <div className="bg-neon text-black px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-2 font-black animate-pulse border border-black/10"><CheckCircle2 size={18} />{success}</div>}
      </div>

    </div>
  );
}
