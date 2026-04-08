"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Shield, BarChart2, User, Zap, type LucideIcon } from "lucide-react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type NavItem = { label: string; href: string; icon: LucideIcon; isLive?: boolean };

const navItems: NavItem[] = [
  { label: "HOME", href: "/", icon: Home },
  { label: "SQUAD", href: "/squad", icon: Shield },
  { label: "LIVE", href: "/live-points", icon: Zap, isLive: true },
  { label: "LEAGUES", href: "/leagues", icon: BarChart2 },
  { label: "PROFILE", href: "/profile", icon: User },
];

export function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 w-full max-w-md h-[88px] bg-[#0c121e] border-t border-[#1a2235] px-1 flex items-center justify-around z-50 pb-2">
      {navItems.map((item) => {
        const isActive = pathname === item.href;
        const Icon = item.icon;
        const isLive = item.isLive ?? false;

        return (
          <Link
            key={item.label}
            href={item.href}
            className="flex-1 flex flex-col items-center justify-center gap-1 pt-2 min-w-0"
          >
            <div
              className={cn(
                "p-2 rounded-2xl transition-all duration-300 ease-in-out relative",
                isActive && isLive
                  ? "bg-red-500/15 text-red-400"
                  : isActive
                  ? "bg-neon-bg/80 text-neon"
                  : isLive
                  ? "text-red-500/60 hover:text-red-400"
                  : "text-gray-500 hover:text-gray-300"
              )}
            >
              <Icon size={22} strokeWidth={isActive ? 2.5 : 2} />
              {isLive && (
                <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
              )}
            </div>
            <span
              className={cn(
                "text-[9px] font-bold tracking-widest transition-colors truncate w-full text-center",
                isActive && isLive
                  ? "text-red-400"
                  : isActive
                  ? "text-neon"
                  : isLive
                  ? "text-red-500/60"
                  : "text-gray-500"
              )}
            >
              {item.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
