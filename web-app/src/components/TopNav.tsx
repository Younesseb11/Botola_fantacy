'use client';

import { Bell, User, LogOut } from "lucide-react";
import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { signout } from "@/app/login/actions";

export function TopNav() {
  const [user, setUser] = useState<any>(null);
  const supabase = createClient();

  useEffect(() => {
    async function getUser() {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
    }
    getUser();

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, [supabase]);

  return (
    <div className="flex items-center justify-between px-6 py-4 pt-10 sticky top-0 bg-transparent z-40 backdrop-blur-sm">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-[#1A2235] flex items-center justify-center overflow-hidden border-2 border-neon/30">
          {user ? (
            <img 
              src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${user.email}`} 
              alt="avatar" 
              className="w-full h-full object-cover"
            />
          ) : (
            <User className="text-gray-300" size={20} />
          )}
        </div>
        <div className="flex flex-col">
          <span className="text-gray-500 text-[9px] font-black uppercase tracking-widest">Manager</span>
          <span className="text-neon font-extrabold text-xl tracking-tight leading-none">
            {user ? user.email?.split('@')[0] : 'Guest'}
          </span>
        </div>
      </div>
      
      <div className="flex items-center gap-2">
        {user && (
          <form action={signout}>
            <button 
              type="submit"
              className="text-red-400 hover:text-red-300 transition-colors bg-red-400/10 p-2 rounded-full"
              title="Sign Out"
            >
              <LogOut size={20} />
            </button>
          </form>
        )}
        <button className="text-neon hover:text-green-300 transition-colors bg-neon/10 p-2 rounded-full">
          <Bell size={20} />
        </button>
      </div>
    </div>
  );
}
