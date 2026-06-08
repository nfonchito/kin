"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LayoutDashboard, Calendar, User, LogOut } from "lucide-react";
import { KinLogo } from "./KinLogo";
import { createClient } from "@/lib/supabase/client";
import { useState } from "react";

const nav = [
  { href: "/dashboard", label: "Home", icon: LayoutDashboard },
  { href: "/dashboard/calendar", label: "Calendar", icon: Calendar },
  { href: "/dashboard/profile", label: "Profile", icon: User },
];

interface MobileNavProps {
  family: { name: string } | null;
  userEmail: string;
}

export function MobileNav({ family }: MobileNavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut() {
    setSigningOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <>
      {/* Mobile top bar */}
      <header className="lg:hidden flex items-center justify-between px-4 py-3 border-b border-border bg-surface sticky top-0 z-20">
        <KinLogo size={26} showWordmark />
        <div className="flex items-center gap-2">
          <span className="text-xs text-text-muted">{family?.name}</span>
          <button
            onClick={handleSignOut}
            disabled={signingOut}
            className="p-1.5 text-text-muted hover:text-red-400 transition-colors"
          >
            <LogOut size={15} />
          </button>
        </div>
      </header>

      {/* Mobile bottom tab bar */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-20 bg-surface border-t border-border flex">
        {nav.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link
              key={href}
              href={href}
              className={`flex-1 flex flex-col items-center gap-1 py-2.5 text-xs transition-colors ${
                active ? "text-teal" : "text-text-muted"
              }`}
            >
              <Icon size={20} strokeWidth={active ? 2.2 : 1.8} />
              <span className="text-[10px]">{label}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
