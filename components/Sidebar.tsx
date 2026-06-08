"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LayoutDashboard, Calendar, User, LogOut } from "lucide-react";
import { KinLogo } from "./KinLogo";
import { createClient } from "@/lib/supabase/client";

const nav = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/dashboard/calendar", label: "Calendar", icon: Calendar },
  { href: "/dashboard/profile", label: "Profile", icon: User },
];

interface SidebarProps {
  family: { name: string } | null;
  userEmail: string;
}

export function Sidebar({ family, userEmail }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <aside className="hidden lg:flex flex-col w-56 xl:w-60 h-full bg-surface border-r border-border shrink-0">
      {/* Logo */}
      <div className="px-4 py-5 border-b border-border">
        <KinLogo size={28} showWordmark />
      </div>

      {/* Family name */}
      <div className="px-4 py-3 border-b border-border">
        <p className="text-xs text-text-muted uppercase tracking-wider mb-0.5">Family</p>
        <p className="text-sm font-medium text-text-primary truncate">
          {family?.name ?? "My Family"}
        </p>
        <p className="text-xs text-text-muted mt-0.5">Northwest Hills · 78731</p>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-3 space-y-0.5">
        {nav.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                active
                  ? "bg-teal-muted text-teal font-medium"
                  : "text-text-secondary hover:text-text-primary hover:bg-surface-3"
              }`}
            >
              <Icon size={16} strokeWidth={active ? 2.2 : 1.8} />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* User / sign out */}
      <div className="px-2 py-3 border-t border-border">
        <div className="px-3 py-2 mb-1">
          <p className="text-xs text-text-secondary truncate">{userEmail}</p>
        </div>
        <button
          onClick={handleSignOut}
          className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm text-text-secondary hover:text-red-400 hover:bg-red-400/10 transition-colors"
        >
          <LogOut size={16} strokeWidth={1.8} />
          Sign out
        </button>
      </div>
    </aside>
  );
}
