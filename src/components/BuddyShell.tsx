"use client";
import { NotificationBadge } from "@/components/NotificationBadge";
import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut } from "lucide-react";
import { signOut } from "@/lib/auth/actions";

const TABS = [
  { label: "My Tasks", href: "/buddy/dashboard" },
  { label: "Verification", href: "/buddy/vetting" },
  { label: "Earnings", href: "/buddy/earnings" },
  { label: "Payout Details", href: "/buddy/settings" },
  { label: "Profile", href: "/buddy/profile" },
  { label: "Notifications", href: "/buddy/notifications" },
];

export function BuddyShell({ children, unreadCount = 0 }: { children: React.ReactNode; unreadCount?: number }) {
  const pathname = usePathname();
  return (
    <div className="min-h-screen bg-bbb-bg">
      <header className="border-b border-bbb-border bg-white">
        <div className="mx-auto flex h-16 max-w-container items-center justify-between px-4">
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/images/logo.png" alt="Backhome Buddy" className="h-8 w-auto" />
            <span className="rounded-full bg-bbb-soft px-2.5 py-1 text-[11px] font-bold text-bbb-strong">Buddy Portal</span>
          </div>
          <form action={signOut}>
            <button className="flex items-center gap-2 rounded-xl border border-bbb-border px-3 py-2 text-xs font-bold text-bbb-slate hover:text-red-600"><LogOut className="h-3.5 w-3.5" />Logout</button>
          </form>
        </div>
        <nav className="mx-auto flex max-w-container gap-1 px-4 overflow-x-auto whitespace-nowrap">
          {TABS.map((t) => {
            const active = pathname?.startsWith(t.href);
            return (
              <Link key={t.href} href={t.href} className={`border-b-2 px-4 py-3 text-sm font-semibold ${active ? "border-bbb-strong text-bbb-charcoal" : "border-transparent text-bbb-slate hover:text-bbb-charcoal"}`}>
                {t.label}{t.label === "Notifications" && <NotificationBadge />}
              </Link>
            );
          })}
        </nav>
      </header>
      <main className="mx-auto max-w-container px-4 py-8">{children}</main>
    </div>
  );
}
