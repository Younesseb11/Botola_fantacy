import { Bell, User } from "lucide-react";


export function TopNav() {
  return (
    <div className="flex items-center justify-between px-6 py-4 pt-10 sticky top-0 bg-transparent z-40 backdrop-blur-sm">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-[#1A2235] flex items-center justify-center overflow-hidden border-2 border-neon/30">
          {/* Defaulting to user icon for now */}
          <User className="text-gray-300" size={20} />
        </div>
        <span className="text-neon font-extrabold text-xl tracking-tight">ElMoudeer</span>
      </div>
      <button className="text-neon hover:text-green-300 transition-colors bg-neon/10 p-2 rounded-full">
        <Bell size={20} />
      </button>
    </div>
  );
}
