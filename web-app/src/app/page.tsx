import { supabase } from '@/lib/supabase';
import { ArrowRight, ArrowRightLeft, Medal, BarChart3, TrendingUp, ChevronRight } from 'lucide-react';
import Link from 'next/link';

// Server component to fetch data
export default async function HomePage() {
  // Try to fetch the user's squad, though it will likely be empty due to RLS without Auth.
  let squadData = null;
  
  try {
    const { data, error } = await supabase
      .from('user_squads')
      .select('*')
      .limit(1)
      .single();
      
    if (!error && data) {
      squadData = data;
    }
  } catch (err) {
    console.error("No auth session found or missing data.", err);
  }

  // Fallback to dummy data if not authenticated/no squad yet
  const totalPoints = squadData?.total_points || 82;
  const overallRank = squadData?.overall_rank || "1,422";
  const teamName = squadData?.team_name || "Botola Masters League";

  return (
    <div className="px-5 pb-8 animate-in fade-in duration-500 flex flex-col gap-5">
      
      {/* Matchday Pill */}
      <div className="flex justify-center mt-2">
        <div className="bg-[#1A2235] rounded-full pl-0 pr-4 py-1.5 flex items-center font-bold text-[10px] tracking-widest text-gray-300 shadow-md border border-white/5 relative overflow-hidden">
          <div className="w-1 h-full bg-neon absolute left-0 rounded-l-full"></div>
          <span className="pl-4 uppercase">Matchday 28</span>
        </div>
      </div>

      {/* Main Total Points Card */}
      <div className="relative bg-[#121A2B] rounded-[32px] p-6 flex flex-col items-center shadow-xl border border-white/5 overflow-hidden">
        {/* Decorative faint ball pattern (mocked with CSS background) */}
        <div className="absolute -right-10 -bottom-10 w-48 h-48 border-[20px] border-white/[0.02] rounded-full pointer-events-none"></div>
        <div className="absolute right-10 bottom-10 w-24 h-24 border-[10px] border-white/[0.02] rounded-full pointer-events-none"></div>
        
        <h3 className="text-neon text-[10px] font-black tracking-[0.2em] mb-2 z-10">TOTAL POINTS</h3>
        
        <div className="flex items-baseline gap-1 z-10 mb-4">
          <span className="text-white text-7xl font-bold tracking-tighter leading-none">{totalPoints}</span>
          <span className="text-neon text-sm font-black tracking-widest">PTS</span>
        </div>

        <div className="flex flex-col items-center gap-1.5 z-10 mb-6">
          <div className="flex items-center gap-2 text-white">
            <TrendingUp size={16} className="text-gray-400" />
            <span className="text-lg">Rank: {overallRank}</span>
          </div>
          <span className="text-gray-400 text-xs font-semibold">Top 2% of Global Managers</span>
        </div>

        <button className="w-[85%] bg-neon text-[var(--background)] py-3.5 rounded-2xl font-bold flex items-center justify-center gap-2 shadow-[0_4px_14px_0_rgba(74,222,128,0.3)] hover:scale-105 transition-transform z-10">
          Analyze Squad
          <ArrowRight size={18} strokeWidth={2.5} />
        </button>
      </div>

      {/* Action Cards Grid */}
      <div className="grid grid-cols-2 gap-4">
        {/* Transfers Card */}
        <Link href="/squad" className="bg-[#121A2B] rounded-3xl p-5 border border-white/5 flex flex-col items-start shadow-lg group hover:border-white/10 transition-colors">
          <div className="bg-[#1A2235] p-2.5 rounded-2xl mb-4 group-hover:scale-110 transition-transform">
            <ArrowRightLeft className="text-neon" size={20} />
          </div>
          <h4 className="text-white font-bold text-sm mb-0.5">Transfers</h4>
          <span className="text-gray-400 text-[10px] pb-2">2 Free available</span>
          <div className="w-full flex justify-end mt-auto pt-2">
             <ChevronRight className="text-gray-600 group-hover:text-neon transition-colors" size={16} />
          </div>
        </Link>

        {/* Captain Card */}
        <div className="bg-[#121A2B] rounded-3xl p-5 border border-white/5 flex flex-col items-start shadow-lg relative overflow-hidden group">
           {/* Abstract shape to replace the pilot icon for now */}
           <div className="absolute -right-4 -bottom-4 w-20 h-20 bg-neon/5 rounded-full blur-xl group-hover:bg-neon/10 transition-colors"></div>
           
          <div className="bg-[#1A2235] p-2.5 rounded-2xl mb-4">
            <Medal className="text-pink-400" size={20} />
          </div>
          <h4 className="text-white font-bold text-sm mb-0.5 z-10">Captain</h4>
          <span className="text-gray-300 text-xs font-bold z-10">R. SLIM <span className="text-gray-500 font-normal">(18pts)</span></span>
        </div>
      </div>

      {/* League Card */}
      <Link href="/leagues" className="bg-[#121A2B] rounded-[24px] p-4 border border-white/5 flex items-center justify-between shadow-lg group hover:border-white/10 transition-colors">
        <div className="flex items-center gap-4">
          <div className="bg-[#1A2235] p-3 rounded-2xl">
            <BarChart3 className="text-neon" size={20} />
          </div>
          <div className="flex flex-col">
            <h4 className="text-white font-bold text-[13px]">{teamName}</h4>
            <span className="text-gray-400 text-[10px]">Pos: 4th • 12pts behind leader</span>
          </div>
        </div>
        <span className="text-neon text-[9px] font-black tracking-widest mr-2 uppercase">Details</span>
      </Link>

      {/* Next Match Section */}
      <div className="mt-2 flex flex-col gap-3">
        <div className="flex justify-between items-end px-1">
          <h3 className="text-white font-bold text-lg">Next Match</h3>
          <span className="text-neon text-[10px] font-bold tracking-widest uppercase cursor-pointer">View Schedule</span>
        </div>

        <div className="bg-[#121A2B] rounded-3xl py-6 px-4 border border-white/5 shadow-lg flex justify-around items-center">
          {/* Home Team */}
          <div className="flex flex-col items-center gap-3">
            <div className="w-14 h-14 bg-[#1A2235] rounded-full border border-white/10 flex items-center justify-center p-2">
               <div className="w-full h-full bg-gradient-to-tr from-red-600 to-red-400 rounded-full" />
            </div>
            <span className="text-white font-bold text-xs uppercase tracking-wider">FAR</span>
          </div>

          {/* VS info */}
          <div className="flex flex-col items-center gap-1">
            <span className="text-white font-black text-xl">VS</span>
            <span className="text-gray-400 text-[9px] font-bold tracking-widest uppercase">Sat 14:30</span>
          </div>

          {/* Away Team */}
          <div className="flex flex-col items-center gap-3">
            <div className="w-14 h-14 bg-[#1A2235] rounded-full border border-white/10 flex items-center justify-center p-2">
               <div className="w-full h-full bg-gradient-to-tr from-red-700 to-white rounded-full bg-clip-content border-2 border-red-700 border-dashed" />
            </div>
            <span className="text-white font-bold text-xs uppercase tracking-wider">WAC</span>
          </div>
        </div>
      </div>

    </div>
  );
}
